import { Outlet } from 'react-router';
import { LayoutUIProvider } from './layout-ui-context';
import { Sidebar } from './components/sidebar';
import { Navbar } from './components/navbar';
import { Footer } from './components/footer';
import { DEFAULT_NAV_ITEMS } from '@/config/navigation';
import { useAuthSession } from '@/app/providers/auth-provider';
import { usePermissions } from '@/shared/hooks/use-permissions';
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
  // No hay layout móvil separado: la barra lateral y superior se mantienen siempre visibles y adaptables.
  return (
    <div className="h-dvh w-full flex bg-cuadra-arena overflow-hidden">
      {/* Barra lateral izquierda continua */}
      <div className="relative z-30 shrink-0 shadow-lg h-full">
        <Sidebar navItems={navItems} />
      </div>

      {/* Contenedor principal derecho con barra superior */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative z-10 transition-opacity">
        <div className="shrink-0">
          <Navbar navItems={navItems} user={user} onLogout={onLogout} />
        </div>

        <main className="flex-1 overflow-y-auto bg-transparent p-3 sm:p-4 md:p-6 custom-scrollbar">
          <Outlet />
        </main>

        <div className="shrink-0">
          <Footer />
        </div>
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
