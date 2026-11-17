import { type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/app/router/route-paths';
import { usePermissions } from '@/shared/hooks/use-permissions';
import type { PermisoCodigo } from '@/config/permissions';

interface SubModuleTab {
  label: string;
  route: string;
  requiredPermissions: PermisoCodigo[];
}

/**
 * Pestañas operativas principales del módulo de Vales (a la izquierda).
 */
const MAIN_TABS: SubModuleTab[] = [
  {
    label: 'Almacén',
    route: ROUTES.VALES_ALMACEN,
    requiredPermissions: ['vale:separar', 'vale:entregar'],
  },
  {
    label: 'Agregar +',
    route: ROUTES.VALES_ADMINISTRACION,
    requiredPermissions: ['vale:crear', 'vale:editar'],
  },
  {
    label: 'Auditoría',
    route: ROUTES.VALES_AUDITORIA,
    requiredPermissions: ['vale:descontar'],
  },
  {
    label: 'Pendientes',
    route: ROUTES.VALES_PENDIENTES,
    requiredPermissions: ['vale:ver'],
  },
];

/**
 * Pestaña de consulta histórica (ubicada en el extremo derecho).
 */
const HISTORIAL_TAB: SubModuleTab = {
  label: 'Historial',
  route: ROUTES.VALES_HISTORIAL,
  requiredPermissions: ['vale:ver'],
};

/**
 * Barra de navegación interna entre los submódulos de Vales.
 * Solo muestra las pestañas para las que el usuario tiene al menos uno de los permisos requeridos.
 * Si el usuario solo tiene acceso a una pestaña en total, no se muestra la barra.
 */
export function ValesNav(): ReactNode {
  const { hasAnyPermission } = usePermissions();

  const visibleMainTabs = MAIN_TABS.filter((tab) =>
    hasAnyPermission(tab.requiredPermissions),
  );
  const isHistorialVisible = hasAnyPermission(HISTORIAL_TAB.requiredPermissions);

  const totalVisible = visibleMainTabs.length + (isHistorialVisible ? 1 : 0);

  if (totalVisible <= 1) {
    return null;
  }

  return (
    <div className="border-b border-border">
      <nav
        className="flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar"
        aria-label="Submódulos de Vales"
      >
        {/* Pestañas operativas a la izquierda */}
        <div className="flex items-center gap-0.5">
          {visibleMainTabs.map((tab) => (
            <NavLink
              key={tab.route}
              to={tab.route}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-2 px-4 py-2 text-xs transition-colors whitespace-nowrap select-none',
                  'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-t-full after:transition-all',
                  isActive
                    ? 'font-bold text-marca-primario after:bg-marca-secundario'
                    : 'font-medium text-text-muted hover:text-text-primary after:bg-transparent hover:after:bg-border-strong',
                )
              }
            >
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>

        {/* Pestaña de Historial separada a la derecha */}
        {isHistorialVisible && (
          <div className="flex items-center shrink-0">
            <NavLink
              to={HISTORIAL_TAB.route}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-2 px-4 py-2 text-xs transition-colors whitespace-nowrap select-none',
                  'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-t-full after:transition-all',
                  isActive
                    ? 'font-bold text-marca-primario after:bg-marca-secundario'
                    : 'font-medium text-text-muted hover:text-text-primary after:bg-transparent hover:after:bg-border-strong',
                )
              }
            >
              <span>{HISTORIAL_TAB.label}</span>
            </NavLink>
          </div>
        )}
      </nav>
    </div>
  );
}
