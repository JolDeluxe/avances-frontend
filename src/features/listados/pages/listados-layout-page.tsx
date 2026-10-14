import { Outlet } from 'react-router';
import { ListadosNav } from '../components/listados-nav';

/**
 * Layout del módulo Listados.
 *
 * Patrón: nav de submódulos + <Outlet /> para el contenido del submódulo activo.
 * La ruta /listados renderiza este layout.
 * Los submódulos se anidan como hijos en el router.
 */
export function ListadosLayoutPage() {
  return (
    <section className="space-y-2">
      <div className="sticky -top-6 -mt-6 pt-1 pb-0.5 z-20 bg-cuadra-arena/95 backdrop-blur-xs">
        <ListadosNav />
      </div>
      <div>
        <Outlet />
      </div>
    </section>
  );
}
