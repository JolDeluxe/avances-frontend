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

const ALL_TABS: Record<string, TabItem> = {
  almacen: {
    id: 'almacen',
    label: 'Almacén',
    to: ROUTES.LISTADOS_ALMACEN,
  },
  pendientes: {
    id: 'pendientes',
    label: 'Pendientes',
    to: ROUTES.LISTADOS_PENDIENTES,
  },
  administracion: {
    id: 'administracion',
    label: 'Agregar +',
    to: ROUTES.LISTADOS_ADMINISTRACION,
  },
  auditoria: {
    id: 'auditoria',
    label: 'Auditoría',
    to: ROUTES.LISTADOS_AUDITORIA,
  },
  historial: {
    id: 'historial',
    label: 'Historial',
    to: ROUTES.LISTADOS_HISTORIAL,
    isSeparated: true,
  },
};

/**
 * Barra de navegación interna del módulo Listados.
 * Usa NavLink para que el tab activo se marque automáticamente.
 * Filtra los tabs según los permisos efectivos del usuario.
 * Historial se muestra a la derecha, separado del bloque principal de tabs.
 */
export function ListadosNav({ className }: { className?: string }) {
  const { hasPermission, rol, isAdmin } = usePermissions();

  const canVer = hasPermission('listado:ver');
  const canCrear = hasPermission('listado:crear');
  const canDescontar = hasPermission('listado:descontar');

  // Si no tiene permiso de ver, no hay pestañas de navegación de listados
  if (!canVer) {
    return null;
  }

  const isAlmacenista = rol === 'ALMACENISTA';
  const isAuditor = rol === 'AUDITOR';
  const canVerAlmacen =
    !isAuditor &&
    (isAlmacenista || isAdmin || rol === 'VISUALIZADOR' || hasPermission('listado:separar') || hasPermission('listado:entregar'));
  const canAuditar = !isAlmacenista && (canDescontar || isAuditor || isAdmin || rol === 'VISUALIZADOR');

  // Orden canónico basado en permisos efectivos:
  // - Agregar +: Solo si tiene permiso de crear
  // - Almacén: Solo para almacén y administración (excluyendo estrictamente al auditor)
  // - Pendientes: Operativo / consulta
  // - Auditoría: Solo para roles / permisos de auditoría (excluyendo almacenistas)
  // - Historial: Para roles con acceso a historial (excluyendo almacenistas)
  const tabIds: string[] = [];
  if (canCrear) {
    tabIds.push('administracion');
  }
  if (canVerAlmacen) {
    tabIds.push('almacen');
  }
  tabIds.push('pendientes');
  if (canAuditar) {
    tabIds.push('auditoria');
  }
  if (!isAlmacenista) {
    tabIds.push('historial');
  }

  const visibleTabs: TabItem[] = tabIds
    .map((id) => ALL_TABS[id])
    .filter((t): t is TabItem => Boolean(t));

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
          'relative px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold transition-colors outline-none tracking-wide',
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

