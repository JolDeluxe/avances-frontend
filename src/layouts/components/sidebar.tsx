import { useLayoutUI } from '../use-layout-ui';
import { SidebarHeader } from './sidebar-header';
import { SidebarItem } from './sidebar-item';
import type { NavItem } from '@/shared/types/navigation.types';

interface SidebarProps {
  /** Ítems de navegación pasados desde el DashboardLayout */
  navItems: NavItem[];
  /** Nombre de la aplicación mostrado en el footer del sidebar (expandido) */
  appName?: string;
  /** Versión de la aplicación mostrada en el footer (expandido) */
  appVersion?: string;
}

/**
 * Sidebar de navegación lateral institucional (Desktop / Mobile).
 * Estilos y colores calcados de 04_Proyecto_Mantenimiento:
 * - Desktop: lg:bg-marca-secundario (#846768)
 * - Mobile: max-lg:bg-marca-secundario/80 max-lg:backdrop-blur-2xl
 * - Footer con badge bg-marca-primario/50 text-cuadra-arena
 */
export function Sidebar({ navItems, appName = 'Almacén MBC', appVersion = 'v.desarrollo' }: SidebarProps) {
  const { sidebarExpanded } = useLayoutUI();

  return (
    <aside
      className={`
        h-full flex flex-col relative
        transition-all duration-300 ease-in-out shrink-0
        ${sidebarExpanded ? 'w-72' : 'w-20'}
        bg-marca-secundario shadow-md border-r border-marca-primario/20
      `}
    >
      <SidebarHeader />

      <nav className="sidebar-nav flex-1 overflow-y-auto min-h-0 py-4 px-2 custom-scrollbar" aria-label="Navegación principal">
        <ul className="space-y-1 relative">
          {navItems.map((item, index) => {
            if (item.isDivider) {
              return <li key={item.id ?? `div-${index}`} className="h-px bg-white/10 my-4 mx-2" />;
            }
            return (
              <SidebarItem key={item.id} item={item} />
            );
          })}
        </ul>
      </nav>

      {/* Footer del sidebar — visible solo cuando está expandido */}
      <div
        className={`
          p-4 border-t border-marca-primario/30 mt-auto flex flex-col items-center
          transition-all duration-300 overflow-hidden
          sidebar-footer
          ${sidebarExpanded ? 'opacity-100' : 'opacity-0 hidden'}
        `}
      >
        <p className="sidebar-footer-title fuente-titulos text-white text-xl tracking-wide whitespace-nowrap">
          {appName}
        </p>
        <p className="sidebar-footer-version font-codigo text-[10px] bg-marca-primario/50 text-cuadra-arena px-2 py-0.5 rounded-sm mt-1 mb-3 whitespace-nowrap shadow-inner">
          {appVersion}
        </p>
        <p className="sidebar-footer-credit text-[10px] text-white/50 text-center leading-tight">
          Desarrollado por el equipo de <br />
          <span className="font-bold text-white/80">Procesos Tecnológicos</span>
        </p>
      </div>
    </aside>
  );
}
