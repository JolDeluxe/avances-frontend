import { Outlet } from 'react-router';
import { LayoutUIProvider } from './layout-ui-context';
import { useLayoutUI } from './use-layout-ui';
import { Sidebar } from './components/sidebar';
import { Navbar } from './components/navbar';
import { Footer } from './components/footer';
import { DEFAULT_NAV_ITEMS } from '@/config/navigation';
import { useAuthSession } from '@/app/providers/auth-provider';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { cn } from '@/lib/utils/cn';
import type { NavItem } from '@/shared/types/navigation.types';

export interface DashboardLayoutProps {
  navItems?: NavItem[];
  user?: { nombre?: string; usuario?: string; rol?: string; imagen?: string } | null;
  onLogout?: () => void;
}

/**
 * Contenido interno del layout que consume el estado UI.
 * Sigue la estructura y fondo bg-cuadra-arena exactos de 04_Proyecto_Mantenimiento.
 */
function DashboardLayoutContent({
  navItems: navItemsProp,
  user: userProp,
  onLogout: onLogoutProp,
}: DashboardLayoutProps) {
  const session = useAuthSession();

  const { can, rol } = usePermissions();
  const { fullscreenMode } = useLayoutUI();

  const user = userProp !== undefined ? userProp : session.user;
  const onLogout = onLogoutProp ?? session.logout;

  const navItems = (navItemsProp ?? DEFAULT_NAV_ITEMS).filter((item) => {
    if (item.permission && !can(item.permission)) {
      return false;
    }
    if (item.allowedRoles && (!rol || !item.allowedRoles.includes(rol))) {
      return false;
    }
    return true;
  });

  // Diseño de layout unificado permanente (Sidebar + Navbar + Main + Footer)
  // Cuando fullscreenMode está activo (proyección en planta), oculta Sidebar y Navbar para abarcar el 100%.
  return (
    <div
      className={cn(
        'h-dvh w-full flex overflow-hidden',
        fullscreenMode ? 'bg-app-surface' : 'bg-cuadra-arena',
      )}
    >
      {/* Barra lateral izquierda continua */}
      {!fullscreenMode && (
        <div className="relative z-30 shrink-0 shadow-lg h-full">
          <Sidebar navItems={navItems} />
        </div>
      )}

      {/* Contenedor principal derecho con barra superior */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative z-10 transition-opacity">
        {!fullscreenMode && (
          <div className="shrink-0">
            <Navbar navItems={navItems} user={user} onLogout={onLogout} />
          </div>
        )}

        <main
          className={cn(
            'flex-1 overflow-y-auto custom-scrollbar',
            fullscreenMode ? 'p-2 sm:p-4 bg-transparent' : 'p-3 sm:p-4 md:p-6 bg-transparent',
          )}
        >
          <Outlet />
        </main>

        {!fullscreenMode && (
          <div className="shrink-0">
            <Footer />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * DashboardLayout unificado para Materia Prima.
 */
export function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <LayoutUIProvider>
      <DashboardLayoutContent {...props} />
    </LayoutUIProvider>
  );
}
