import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameProvider } from './store.jsx';
import App from './App.jsx';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@fontsource/jua/korean-400.css';
import '@fontsource/jua/latin-400.css';
import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
