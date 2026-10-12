import { NavLink } from 'react-router';
import { ROUTES } from '@/app/router/route-paths';
import { cn } from '@/lib/utils/cn';
import { usePermissions } from '@/shared/hooks/use-permissions';

interface TabItem {
  id: string;
  label: string;
  to: string;
  allowedRoles?: string[];
  isSeparated?: boolean;
}

const LISTADOS_TABS: TabItem[] = [
  {
    id: 'administracion',
    label: 'Agregar +',
    to: ROUTES.LISTADOS_ADMINISTRACION,
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR', 'REGISTRADOR'],
  },
  {
    id: 'pendientes',
    label: 'Pendientes',
    to: ROUTES.LISTADOS_PENDIENTES,
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'ALMACENISTA'],
  },
  {
    id: 'auditoria',
    label: 'Auditoría',
    to: ROUTES.LISTADOS_AUDITORIA,
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'AUDITOR'],
  },
  {
    id: 'historial',
    label: 'Historial',
    to: ROUTES.LISTADOS_HISTORIAL,
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'],
    isSeparated: true,
  },
];

/**
 * Barra de navegación interna del módulo Listados.
 * Usa NavLink para que el tab activo se marque automáticamente.
 * Filtra los tabs según el rol del usuario (ej. ALMACENISTA solo ve Pendientes).
 * Historial se muestra ligeramente más alejado del grupo principal de tabs.
 */
export function ListadosNav({ className }: { className?: string }) {
  const { rol, isSuperAdmin } = usePermissions();

  const visibleTabs = LISTADOS_TABS.filter((tab) => {
    if (isSuperAdmin) return true;
    if (!tab.allowedRoles) return true;
    return tab.allowedRoles.includes(rol);
  });

  // Si solo hay un tab visible (ej. ALMACENISTA con solo Pendientes), se oculta la barra de tabs redundante
  if (visibleTabs.length <= 1) {
    return null;
  }

  const mainTabs = visibleTabs.filter((t) => !t.isSeparated);
  const separatedTabs = visibleTabs.filter((t) => t.isSeparated);

  const renderTab = (tab: TabItem) => (
    <NavLink
      key={tab.id}
      to={tab.to}
      end
      className={({ isActive }) =>
        cn(
          'relative px-3.5 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm md:text-base font-semibold transition-colors outline-none tracking-wide',
          'focus-visible:ring-2 focus-visible:ring-border-focus rounded-t-md',
          isActive
            ? 'text-text-primary after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-0.5 after:bg-marca-secundario after:rounded-full'
            : 'text-text-muted hover:text-text-secondary',
        )
      }
    >
      {tab.label}
    </NavLink>
  );

  return (
    <nav
      role="tablist"
      aria-label="Secciones de Listados"
      className={cn('flex items-center justify-between border-b border-border', className)}
    >
      {/* Grupo principal: Administración, Pendientes, Auditoría */}
      <div className="flex gap-1 items-center">
        {mainTabs.map(renderTab)}
      </div>

      {/* Grupo ligeramente más alejado / a la derecha: Historial */}
      {separatedTabs.length > 0 && (
        <div className="flex gap-1 items-center ml-auto pl-6 border-l border-border/50">
          {separatedTabs.map(renderTab)}
        </div>
      )}
    </nav>
  );
}

