import { NavLink } from 'react-router';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils/cn';
import { useLayoutUI } from '../use-layout-ui';
import type { NavItem } from '@/shared/types/navigation.types';

interface MobileSidebarProps {
  navItems: NavItem[];
}

/**
 * Menú lateral drawer para móvil (estilo institucional Cuadra).
 */
export function MobileSidebar({ navItems }: MobileSidebarProps) {
  const { mobileMenuOpen, closeMobileMenu } = useLayoutUI();

  if (!mobileMenuOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-marca-primario/40 backdrop-blur-xs z-40 animate-in fade-in duration-200"
        onClick={closeMobileMenu}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full w-4/5 max-w-xs bg-white backdrop-blur-xl border-l border-slate-200 z-50 animate-in slide-in-from-right duration-300 shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Navegación móvil"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
          <span className="fuente-titulos text-marca-primario text-lg tracking-wider uppercase font-bold">
            Almacén MBC
          </span>
          <button
            onClick={closeMobileMenu}
            className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600 active:scale-95 cursor-pointer"
            aria-label="Cerrar menú"
          >
            <Icon name="close" size="20px" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar">
          <ul className="space-y-1.5">
            {navItems.map((item, index) => {
              if (item.isDivider) {
                return <li key={item.id ?? `div-${index}`} className="h-px bg-slate-100 my-2 mx-2" />;
              }

              return (
                <li key={item.id}>
                  <NavLink
                    to={item.route}
                    onClick={closeMobileMenu}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3.5 py-3 rounded-sm transition-all font-medium text-sm',
                        isActive
                          ? 'bg-marca-primario text-white shadow-xs'
                          : 'text-slate-800 hover:bg-slate-50',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          name={item.icon}
                          size="22px"
                          className={isActive ? 'text-white' : 'text-slate-500'}
                        />
                        <span className="truncate">{item.name}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-100 shrink-0 text-center bg-slate-50">
          <p className="font-codigo text-[10px] text-slate-400 tracking-widest font-semibold uppercase">
            Almacén MBC
          </p>
        </div>
      </div>
    </>
  );
}
