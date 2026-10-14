import { useRef, useLayoutEffect, useMemo } from 'react';
import { useLocation } from 'react-router';
import { Icon } from '@/components/ui/icon';
import { useLayoutUI } from '../use-layout-ui';
import { UserMenu } from './user-menu';
import type { NavItem } from '@/shared/types/navigation.types';

interface NavbarProps {
  /** Todos los módulos para resolver el módulo activo */
  navItems: NavItem[];
  /** Usuario actual (viene del AuthProvider) */
  user: { nombre?: string; usuario?: string; rol?: string; imagen?: string } | null;
  onLogout: () => void;
}

const SYSTEM_ROUTES = [
  { route: '/perfil', name: 'Mi Perfil', icon: 'person' },
];

/**
 * Barra de navegación superior del dashboard (estilo institucional Cuadra).
 * Muestra: módulo activo (izquierda) | logo prominente (centro) | user-menu (derecha).
 */
export function Navbar({ navItems, user, onLogout }: NavbarProps) {
  const location = useLocation();
  const { sidebarExpanded } = useLayoutUI();
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty(
        '--navbar-real-height',
        `${el.getBoundingClientRect().height}px`,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => observer.disconnect();
  }, []);

  const activeModule = useMemo(() => {
    const all = [...navItems, ...SYSTEM_ROUTES];
    return all.find((m) => {
      if (m.route === location.pathname) return true;
      if (m.route !== '/' && location.pathname.startsWith(`${m.route}/`)) return true;
      if ('children' in m && m.children) {
        return (m.children as { route: string }[]).some(
          (c) => c.route === location.pathname || location.pathname.startsWith(`${c.route}/`),
        );
      }
      return false;
    }) as NavItem | undefined;
  }, [location.pathname, navItems]);

  return (
    <header
      ref={navRef}
      className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-[70]"
    >
      <div className="grid grid-cols-3 items-center px-4 py-2.5 sm:py-3 gap-4">

        {/* LEFT — botón toggle sidebar + módulo activo */}
        <div className="flex items-center gap-3 justify-self-start min-w-0">
          {activeModule && (
            <div className="flex items-center gap-2 min-w-0">
              <Icon
                name={activeModule.icon}
                size={!sidebarExpanded ? '28px' : '22px'}
                className="text-marca-acento shrink-0 transition-all duration-300"
              />
              <h1 className={`fuente-titulos text-marca-primario uppercase truncate transition-all duration-300 ${!sidebarExpanded ? 'text-lg sm:text-2xl' : 'text-base sm:text-lg'}`}>
                {activeModule.name}
              </h1>
            </div>
          )}
        </div>

        {/* CENTER — logo de Cuadra prominente y nítido */}
        <div className="flex items-center justify-center">
          <img
            src="/img/01_Cuadra.webp"
            alt="Almacén MBC"
            className="h-7 sm:h-12 md:h-14 max-h-10 w-auto object-contain drop-shadow-xs"
          />
        </div>

        {/* RIGHT — botón recarga/actualizar + user-menu */}
        <div className="flex items-center gap-2 sm:gap-3 justify-end">
          <button
            type="button"
            onClick={() => {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((regs) => {
                  regs.forEach((r) => void r.update());
                });
              }
              window.location.reload();
            }}
            title="Recargar y comprobar actualizaciones"
            aria-label="Recargar aplicación"
            className="group flex items-center justify-center h-9 w-9 rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:text-marca-primario hover:bg-slate-100 hover:border-slate-300 transition-all shadow-2xs active:scale-95"
          >
            <Icon
              name="refresh"
              size="20px"
              className="transition-transform duration-500 group-hover:rotate-180 group-active:animate-spin text-slate-600 group-hover:text-marca-primario"
            />
          </button>
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </div>
    </header>
  );
}
