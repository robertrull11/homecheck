import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);

// Service worker: permite instalar la app y abrirla sin conexión.
if ('serviceWorker' in navigator && !window.__PREVIEW__ && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW', e));
  });
}
