import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router';
import { Icon } from '@/components/ui/icon';
import { Tooltip } from '@/components/ui/tooltip';
import { useLayoutUI } from '../use-layout-ui';
import type { NavItem } from '@/shared/types/navigation.types';

interface SidebarItemProps {
  item: NavItem;
}

/**
 * Ítem individual del sidebar.
 * Estilos exactos de 04_Proyecto_Mantenimiento:
 * - Activo: bg-marca-acento text-white font-semibold shadow-lg rounded-sm
 * - Inactivo: text-white/80 hover:bg-marca-primario/30 hover:text-white
 * - Submenú con árbol visual: línea blanca sutil, punto marca-acento con glow
 */
export function SidebarItem({ item }: SidebarItemProps) {
  const { sidebarExpanded, closeMobileMenu } = useLayoutUI();
  const location = useLocation();
  const hasChildren = (item.children?.length ?? 0) > 0;
  const isActiveChild = hasChildren && (item.children ?? []).some(
    (child) => location.pathname.includes(child.route),
  );

  const [isOpen, setIsOpen] = useState(isActiveChild);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!sidebarExpanded) setIsOpen(false);
    else if (isActiveChild) setIsOpen(true);
  }, [sidebarExpanded, isActiveChild]);

  const handleParentClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (hasChildren) {
      if (!sidebarExpanded) {
        closeMobileMenu();
      } else {
        e.preventDefault();
        setIsOpen(!isOpen);
      }
    } else {
      closeMobileMenu();
    }
  };

  return (
    <li className="relative group flex flex-col">
      <Tooltip text={item.name} position="right" offset={12} disabled={sidebarExpanded}>
        <NavLink
          to={item.route}
          onClick={handleParentClick}
          className={({ isActive }) => `
            sidebar-item-link flex items-center px-4 py-3 rounded-sm transition-all duration-200 relative w-full
            ${(isActive && !hasChildren) || isActiveChild
              ? 'bg-marca-acento text-white font-semibold shadow-lg max-lg:border max-lg:border-white/20 max-lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]'
              : 'text-white/80 hover:bg-marca-primario/30 hover:text-white'
            }
          `}
        >
          <Icon name={item.icon} size="24px" className="sidebar-item-icon shrink-0" />

          <span
            className={`
              ml-3 text-sm text-left transition-all duration-300 ease-in-out whitespace-nowrap
              ${sidebarExpanded ? 'flex-1 opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-4 overflow-hidden'}
            `}
          >
            {item.name}
          </span>

          {hasChildren && sidebarExpanded && (
            <Icon
              name="expand_more"
              className={`shrink-0 ml-2 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
            />
          )}
        </NavLink>
      </Tooltip>

      {hasChildren && (
        <div
          className={`
            grid transition-all duration-300 ease-in-out overflow-hidden
            ${isOpen && sidebarExpanded
              ? 'grid-rows-[1fr] opacity-100 mt-1'
              : 'grid-rows-[0fr] opacity-0 mt-0 pointer-events-none'
            }
          `}
        >
          <ul className="sidebar-child-list min-h-0 flex flex-col gap-1 pl-11 pr-2 relative">
            <div className="sidebar-child-line absolute left-[23px] top-0 bottom-2 w-[1.5px] bg-white/10 rounded-full" />

            {(item.children ?? []).map((child) => (
              <li key={child.id} className="relative">
                <NavLink
                  to={child.route}
                  onClick={() => closeMobileMenu()}
                  className={({ isActive }) => `
                    sidebar-child-link flex items-center px-3 py-2 rounded-sm text-sm transition-all duration-200 relative
                    ${isActive
                      ? 'text-marca-acento font-bold bg-white/10 shadow-[inset_0_0_8px_rgba(255,255,255,0.05)]'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  {location.pathname.includes(child.route) && (
                    <div className="sidebar-child-dot absolute left-[-21px] w-3 h-[1.5px] bg-marca-acento shadow-[0_0_5px_var(--color-marca-acento)]" />
                  )}

                  <span className="whitespace-nowrap">{child.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
