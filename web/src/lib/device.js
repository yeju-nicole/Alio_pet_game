/** Phone hardware helpers: motion sensor, screen wake lock, haptics, photos. */

export function hasMotionSensor() {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
}

/** iOS needs an explicit permission prompt, triggered from a tap. */
export async function requestMotionPermission() {
  const DME = window.DeviceMotionEvent;
  if (DME && typeof DME.requestPermission === 'function') {
    try {
      return (await DME.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return hasMotionSensor();
}

/**
 * Peak-detection pedometer on the accelerometer magnitude. A step is a rise
 * above a moving baseline followed by a fall, at most ~3.5 steps a second.
 */
export function startPedometer(onStep) {
  let baseline = 9.8;
  let smoothed = 9.8;
  let rising = false;
  let peak = 0;
  let lastStep = 0;
  let gotData = false;

  function onMotion(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    gotData = true;
    const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    smoothed = smoothed * 0.6 + mag * 0.4;
    // Slow baseline (~1.5s) so it follows posture changes but not individual steps.
    baseline = baseline * 0.99 + mag * 0.01;
    const now = performance.now();
    if (smoothed > baseline + 0.9) {
      rising = true;
      peak = Math.max(peak, smoothed);
    } else if (rising && smoothed < baseline + 0.1) {
      rising = false;
      const interval = now - lastStep;
      if (peak - baseline > 1.0 && interval > 280) {
        lastStep = now;
        onStep();
      }
      peak = 0;
    }
  }

  window.addEventListener('devicemotion', onMotion);
  return {
    stop: () => window.removeEventListener('devicemotion', onMotion),
    get receiving() {
      return gotData;
    },
  };
}

export async function keepScreenOn() {
  try {
    if ('wakeLock' in navigator) {
      const lock = await navigator.wakeLock.request('screen');
      return () => lock.release().catch(() => {});
    }
  } catch {
    /* not allowed (e.g. low battery mode) */
  }
  return () => {};
}

export function buzz(pattern = 15) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

/** Shrinks a camera photo to ≤1024px JPEG before upload. */
export function photoToDataUrl(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지를 읽을 수 없어요'));
    };
    img.src = url;
  });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
