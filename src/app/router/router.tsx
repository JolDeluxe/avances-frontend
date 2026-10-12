import { createBrowserRouter } from 'react-router';
import { routes } from './routes';

/**
 * Instancia compilada del enrutador (SKILL.md §9).
 * Consumida por <RouterProvider /> en app.tsx.
 */
export const router = createBrowserRouter(routes);
