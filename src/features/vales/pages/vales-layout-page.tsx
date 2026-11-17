import { type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { ValesNav } from '../components/vales-nav';

/**
 * Layout contenedor del módulo Vales.
 * Renderiza la navegación por pestañas entre submódulos (si el usuario tiene acceso a más de uno)
 * y el submódulo activo mediante `<Outlet />`.
 */
export function ValesLayoutPage(): ReactNode {
  return (
    <section className="space-y-2">
      <div className="sticky -top-6 -mt-6 pt-1 pb-0.5 z-20 bg-cuadra-arena/95 backdrop-blur-xs">
        <ValesNav />
      </div>
      <div>
        <Outlet />
      </div>
    </section>
  );
}
