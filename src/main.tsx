import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/main.css';
import { App } from '@/app/app';
import { registerPwaServiceWorker } from '@/pwa';
import { setupChunkErrorListener } from '@/app/errors/chunk-error-listener';

setupChunkErrorListener();
registerPwaServiceWorker();

/**
 * Punto de entrada de Vite / React DOM (SKILL.md §7).
 *
 * Responsabilidad única: montar la aplicación en el DOM.
 * Toda la composición real ocurre en app/app.tsx.
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    '[main] No se encontró el elemento #root en el DOM. ' +
      'Verifica que index.html contiene <div id="root"></div>.',
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
