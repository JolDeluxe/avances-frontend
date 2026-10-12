import { Icon } from '@/components/ui/icon';
import { Tooltip } from '@/components/ui/tooltip';
import { useLayoutUI } from '../use-layout-ui';

/**
 * Cabecera del sidebar: logo + botón de expandir/contraer.
 * Idéntico en proporciones, colores y bordes a 04_Proyecto_Mantenimiento.
 */
export function SidebarHeader() {
  const { sidebarExpanded, toggleSidebar } = useLayoutUI();
  const tooltipText = sidebarExpanded ? 'Contraer menú' : 'Expandir menú';

  return (
    <div className="sidebar-header relative border-b border-marca-primario/20 py-6 h-20 flex items-center justify-center shrink-0">
      <div className="flex items-center justify-center px-4 w-full h-full">
        {sidebarExpanded ? (
          <img
            src="/img/01_Cuadra.webp"
            alt="Materia Prima"
            className="sidebar-logo h-10 sm:h-11 w-auto max-h-12 object-contain animate-in fade-in zoom-in duration-300"
          />
        ) : (
          <img
            src="/img/02_Cuadra_C_Logo.webp"
            alt="Logo"
            className="sidebar-logo h-8 w-8 object-contain animate-in fade-in zoom-in duration-300"
          />
        )}
      </div>

      <Tooltip
        text={tooltipText}
        position="bottom"
        triggerClassName="absolute -right-3 top-1/2 -translate-y-1/2 z-10"
      >
        <button
          onClick={toggleSidebar}
          className="
            w-6 h-6 flex items-center justify-center
            bg-white rounded-full
            shadow-md hover:shadow-lg
            transition-all duration-200 ease-out
            hover:scale-110 active:scale-95
            border-2 border-marca-primario
            cursor-pointer text-marca-primario
            focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-secundario/30
          "
          aria-label={tooltipText}
        >
          <Icon
            name={sidebarExpanded ? 'chevron_left' : 'chevron_right'}
            size="16px"
            className="text-marca-primario font-bold"
          />
        </button>
      </Tooltip>
    </div>
  );
}
