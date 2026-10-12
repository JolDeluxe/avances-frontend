import { Outlet } from 'react-router';
import { useIsDesktop } from '@/shared/hooks/use-media-query';
import { LayoutUIProvider } from './layout-ui-context';
import { Sidebar } from './components/sidebar';
import { Navbar } from './components/navbar';
import { MobileHeader } from './components/mobile-header';
import { MobileSidebar } from './components/mobile-sidebar';
import { MobileBottomNav } from './components/mobile-bottom-nav';
import { Footer } from './components/footer';
import { DEFAULT_NAV_ITEMS } from '@/config/navigation';
import { useAuthSession } from '@/app/providers/auth-provider';
import { usePermissions } from '@/shared/hooks/use-permissions';
import type { NavItem } from '@/shared/types/navigation.types';
import { cn } from '@/lib/utils/cn';

export interface DashboardLayoutProps {
  navItems?: NavItem[];
  user?: { nombre?: string; usuario?: string; rol?: string; imagen?: string } | null;
  onLogout?: () => void;
}

/**
 * Contenido interno del layout que consume useIsDesktop y el estado UI.
 * Sigue la estructura y fondo bg-cuadra-arena exactos de 04_Proyecto_Mantenimiento.
 */
function DashboardLayoutContent({
  navItems: navItemsProp,
  user: userProp,
  onLogout: onLogoutProp,
}: DashboardLayoutProps) {
  const isDesktop = useIsDesktop();
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

  const showBottomNav = !isDesktop && navItems.length > 0 && navItems.length <= 5;
  const showBurger = !isDesktop && navItems.length > 5;

  if (isDesktop) {
    return (
      <div className="h-dvh w-full flex bg-cuadra-arena">
        {/* Barra lateral izquierda */}
        <div className="relative z-30 shrink-0 shadow-lg h-full">
          <Sidebar navItems={navItems} />
        </div>

        {/* Contenedor principal derecho */}
        <div className="flex-1 flex flex-col min-w-0 h-full relative z-10 transition-opacity">
          <div className="shrink-0">
            <Navbar navItems={navItems} user={user} onLogout={onLogout} />
          </div>

          <main className="flex-1 overflow-y-auto bg-transparent p-6 custom-scrollbar">
            <Outlet />
          </main>

          <div className="shrink-0">
            <Footer />
          </div>
        </div>
      </div>
    );
  }

  // Vista Móvil / Tablet (< 1024px)
  return (
    <div className="h-dvh w-full flex flex-col bg-cuadra-arena overflow-hidden relative">
      {/* Header móvil */}
      <div className="shrink-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs relative">
        <MobileHeader user={user} onLogout={onLogout} showBurger={showBurger} />
      </div>

      {/* Menú lateral drawer (para cuando hay > 5 módulos) */}
      <MobileSidebar navItems={navItems} />

      {/* Contenido principal */}
      <main
        className={cn(
          'flex-1 overflow-y-auto p-4 bg-transparent custom-scrollbar relative z-10',
          showBottomNav ? 'pb-24' : 'pb-4',
        )}
      >
        <Outlet />
      </main>

      {/* Barra de navegación inferior fija (cuando hay ≤ 5 módulos) */}
      {showBottomNav && <MobileBottomNav navItems={navItems} />}
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
