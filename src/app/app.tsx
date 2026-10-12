import { RouterProvider } from 'react-router';
import { router } from './router/router';
import { AppProviders } from './providers/app-providers';

/**
 * Componente raíz de la aplicación (SKILL.md §8).
 *
 * Responsabilidad: componer providers y el router principal.
 * Patrón: main.tsx → app.tsx → AppProviders → RouterProvider → routes
 */
export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
