/**
 * Shop catalog. `effect` values are added to the pet's stats (0–100).
 * `favorite` gives a happiness bonus when that species gets the item.
 */
export const ITEMS = [
  // ---- 사료 · 간식 (consumable) ----
  { id: 'kibble', category: 'food', name: '기본 사료', emoji: '🥣', price: 30, desc: '든든한 한 끼! 영양 가득 기본 사료', effect: { fullness: 45 } },
  { id: 'organic_kibble', category: 'food', name: '유기농 사료', emoji: '🌾', price: 60, desc: '친환경 농장에서 자란 재료로 만든 프리미엄 사료', effect: { fullness: 65, happiness: 5 }, eco: true },
  { id: 'sweet_potato', category: 'food', name: '고구마 말랭이', emoji: '🍠', price: 25, desc: '쫀득쫀득 달콤한 국산 고구마 간식', effect: { fullness: 15, happiness: 15 }, favorite: 'dog' },
  { id: 'chicken_jerky', category: 'food', name: '닭가슴살 육포', emoji: '🍗', price: 40, desc: '단백질 듬뿍! 강아지들의 최애 간식', effect: { fullness: 20, happiness: 20 }, favorite: 'dog' },
  { id: 'tuna_can', category: 'food', name: '참치 캔', emoji: '🥫', price: 45, desc: '고양이들이 사랑하는 촉촉한 참치', effect: { fullness: 30, happiness: 15 }, favorite: 'cat' },
  { id: 'salmon_treat', category: 'food', name: '연어 트릿', emoji: '🐟', price: 40, desc: '바삭한 연어 트릿, 털이 반짝반짝', effect: { fullness: 15, happiness: 20 }, favorite: 'cat' },
  { id: 'cheese', category: 'food', name: '치즈 큐브', emoji: '🧀', price: 30, desc: '반려동물 전용 저염 치즈', effect: { fullness: 15, happiness: 15 } },
  { id: 'carrot', category: 'food', name: '아삭 당근', emoji: '🥕', price: 15, desc: '로컬 푸드 당근으로 아삭하게', effect: { fullness: 10, happiness: 8 }, eco: true },
  { id: 'watermelon', category: 'food', name: '수박 한 조각', emoji: '🍉', price: 20, desc: '여름엔 역시 시원한 수박!', effect: { fullness: 10, happiness: 12 } },

  // ---- 옷 · 액세서리 (wearable, owned once) ----
  { id: 'ribbon', category: 'clothes', slot: 'head', name: '핑크 리본', emoji: '🎀', price: 150, desc: '사랑스러움 +100 핑크 리본' },
  { id: 'beanie', category: 'clothes', slot: 'head', name: '니트 비니', emoji: '🧶', price: 250, desc: '포근포근 겨울 니트 비니' },
  { id: 'straw_hat', category: 'clothes', slot: 'head', name: '밀짚모자', emoji: '👒', price: 300, desc: '산책 갈 때 딱! 햇빛 가리개' },
  { id: 'flower_crown', category: 'clothes', slot: 'head', name: '꽃 화관', emoji: '🌼', price: 400, desc: '들꽃으로 엮은 봄날의 화관' },
  { id: 'frog_hat', category: 'clothes', slot: 'head', name: '개구리 모자', emoji: '🐸', price: 500, desc: '개굴개굴 귀여움 폭발 모자' },
  { id: 'crown', category: 'clothes', slot: 'head', name: '반짝 왕관', emoji: '👑', price: 800, desc: '우리 집 최고 귀요미에게 왕관을' },
  { id: 'round_glasses', category: 'clothes', slot: 'face', name: '동글 안경', emoji: '👓', price: 200, desc: '똑똑해 보이는 동글동글 안경' },
  { id: 'heart_glasses', category: 'clothes', slot: 'face', name: '하트 선글라스', emoji: '💗', price: 350, desc: '힙한 하트 선글라스' },
  { id: 'bowtie', category: 'clothes', slot: 'neck', name: '나비 넥타이', emoji: '🎀', price: 150, desc: '특별한 날엔 나비 넥타이' },
  { id: 'bandana', category: 'clothes', slot: 'neck', name: '체크 반다나', emoji: '🧣', price: 180, desc: '산책룩 완성! 체크 반다나' },
  { id: 'bell_collar', category: 'clothes', slot: 'neck', name: '방울 목걸이', emoji: '🔔', price: 200, desc: '딸랑딸랑 방울 목걸이' },
  { id: 'stripe_tee', category: 'clothes', slot: 'body', name: '줄무늬 티셔츠', emoji: '👕', price: 300, desc: '마린룩 줄무늬 티셔츠' },
  { id: 'raincoat', category: 'clothes', slot: 'body', name: '노란 우비', emoji: '🧥', price: 450, desc: '비 오는 날 산책 필수템' },
  { id: 'eco_hoodie', category: 'clothes', slot: 'body', name: '업사이클 후드', emoji: '♻️', price: 600, desc: '페트병을 재활용한 원단으로 만든 후드', eco: true },

  // ---- 장난감 (owned once) ----
  { id: 'sock_toy', category: 'toy', name: '양말 인형', emoji: '🧦', price: 60, desc: '안 신는 양말로 만든 업사이클 인형', happiness: 12, eco: true },
  { id: 'ball', category: 'toy', name: '테니스공', emoji: '🎾', price: 80, desc: '던지면 신나게 달려가요', happiness: 15, favorite: 'dog' },
  { id: 'yarn', category: 'toy', name: '털실 뭉치', emoji: '🧶', price: 90, desc: '데굴데굴 굴러가는 털실', happiness: 15, favorite: 'cat' },
  { id: 'mouse', category: 'toy', name: '쥐돌이 인형', emoji: '🐭', price: 100, desc: '사냥 본능을 깨우는 쥐돌이', happiness: 18, favorite: 'cat' },
  { id: 'rope', category: 'toy', name: '터그 로프', emoji: '🪢', price: 120, desc: '천연 면으로 만든 당기기 장난감', happiness: 18, favorite: 'dog' },
  { id: 'feather_wand', category: 'toy', name: '깃털 낚싯대', emoji: '🪶', price: 120, desc: '살랑살랑 깃털 낚싯대', happiness: 20, favorite: 'cat' },
  { id: 'frisbee', category: 'toy', name: '원반', emoji: '🥏', price: 150, desc: '공원에서 원반 던지기!', happiness: 20, favorite: 'dog' },
  { id: 'plush', category: 'toy', name: '곰돌이 인형', emoji: '🧸', price: 200, desc: '꼭 끌어안고 자는 애착 인형', happiness: 22 },
];

export const ITEM_MAP = new Map(ITEMS.map((i) => [i.id, i]));

export const STARTER_PACK = [
  { itemId: 'kibble', qty: 3 },
  { itemId: 'sweet_potato', qty: 1 },
  { itemId: 'sock_toy', qty: 1 },
];

export const PET_COLORS = {
  dog: ['cream', 'choco', 'shiba'],
  cat: ['cheese', 'tuxedo', 'gray'],
};

export const MILESTONES = [
  { day: 7, reward: 100, title: '함께한 지 일주일' },
  { day: 30, reward: 300, title: '함께한 지 한 달' },
  { day: 50, reward: 500, title: '함께한 지 50일' },
  { day: 100, reward: 1000, title: '함께한 지 100일' },
  { day: 200, reward: 1500, title: '함께한 지 200일' },
  { day: 365, reward: 3000, title: '함께한 지 1년' },
];
