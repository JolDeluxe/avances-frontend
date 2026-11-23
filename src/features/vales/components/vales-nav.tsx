import { type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { ROUTES } from '@/app/router/route-paths';
import { cn } from '@/lib/utils/cn';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { useLayoutUI } from '@/layouts/use-layout-ui';

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
    to: ROUTES.VALES_ALMACEN,
  },
  pendientes: {
    id: 'pendientes',
    label: 'Pendientes',
    to: ROUTES.VALES_PENDIENTES,
  },
  administracion: {
    id: 'administracion',
    label: 'Agregar +',
    to: ROUTES.VALES_ADMINISTRACION,
  },
  auditoria: {
    id: 'auditoria',
    label: 'Auditoría',
    to: ROUTES.VALES_AUDITORIA,
  },
  historial: {
    id: 'historial',
    label: 'Historial',
    to: ROUTES.VALES_HISTORIAL,
    isSeparated: true,
  },
};

/**
 * Barra de navegación interna del módulo Vales.
 * Usa NavLink para que el tab activo se marque automáticamente.
 * Filtra los tabs según los permisos efectivos del usuario.
 * Estilos, tipografía, paddings y comportamiento exactamente idénticos a ListadosNav.
 */
export function ValesNav({ className }: { className?: string }): ReactNode {
  const { hasPermission, rol, isAdmin } = usePermissions();
  const { valesAuditoriaCount } = useLayoutUI();

  const canVer = hasPermission('vale:ver');
  const canCrear = hasPermission('vale:crear');
  const canDescontar = hasPermission('vale:descontar');

  // Si no tiene permiso de ver, no hay pestañas de navegación de vales
  if (!canVer) {
    return null;
  }

  const isAlmacenista = rol === 'ALMACENISTA';
  const isAuditor = rol === 'AUDITOR';
  const canVerAlmacen =
    !isAuditor &&
    (isAlmacenista || isAdmin || rol === 'VISUALIZADOR' || hasPermission('vale:separar') || hasPermission('vale:entregar'));
  const canAuditar = !isAlmacenista && (canDescontar || isAuditor || isAdmin || rol === 'VISUALIZADOR');

  // Orden canónico basado en permisos efectivos:
  // - Agregar +: Solo si tiene permiso de crear
  // - Almacén: Solo para almacén y administración (excluyendo estrictamente al auditor)
  // - Pendientes: Operativo / consulta
  // - Auditoría: Solo para roles / permisos de auditoría (excluyendo almacenistas)
  // - Historial: Disponible para consulta general con vale:ver
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
  tabIds.push('historial');

  const visibleTabs: TabItem[] = tabIds
    .map((id) => ALL_TABS[id])
    .filter((t): t is TabItem => Boolean(t));

  // Si solo hay un tab visible, se oculta la barra redundante
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
      <span className="inline-flex items-center gap-1.5">
        <span>{tab.label}</span>
        {tab.id === 'auditoria' && valesAuditoriaCount > 0 && (
          <span
            className="inline-flex items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 shadow-2xs leading-none"
            title={`${valesAuditoriaCount} listos para descontar en ERP`}
          >
            {valesAuditoriaCount > 10 ? '+10' : valesAuditoriaCount}
          </span>
        )}
      </span>
    </NavLink>
  );

  return (
    <nav
      role="tablist"
      aria-label="Secciones de Vales"
      className={cn('flex items-center justify-between border-b border-border', className)}
    >
      {/* Grupo principal: Administración, Auditoría, Pendientes */}
      <div className="flex gap-1 items-center">
        {mainTabs.map(renderTab)}
      </div>

      {/* Grupo a la derecha: Historial */}
      {separatedTabs.length > 0 && (
        <div className="flex gap-1 items-center ml-auto pl-6 border-l border-border/50">
          {separatedTabs.map(renderTab)}
        </div>
      )}
    </nav>
  );
}
