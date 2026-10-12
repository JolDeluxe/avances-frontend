import { useNavigate, useLocation } from 'react-router';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils/cn';
import type { NavItem } from '@/shared/types/navigation.types';

interface MobileBottomNavProps {
  navItems: NavItem[];
}

/**
 * Barra de navegación inferior para móvil.
 * Se muestra cuando el número de módulos ≤ 5.
 * Sin dependencia de stores — recibe navItems como prop.
 */
export function MobileBottomNav({ navItems }: MobileBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  if (navItems.length === 0) return null;

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'flex items-end justify-around px-2 pb-safe',
        'h-20 pt-2',
        'bg-app-surface/90 backdrop-blur-md border-t border-border shadow-md',
      )}
      aria-label="Navegación inferior"
    >
      {navItems.map((item) => {
        const isActive = location.pathname.startsWith(item.route);
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.route)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-md transition-all duration-200 min-w-0 flex-1',
              isActive
                ? 'text-brand-accent'
                : 'text-text-muted hover:text-text-secondary',
            )}
            aria-label={item.name}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              name={item.icon}
              size="24px"
              fill={isActive}
              weight={isActive ? 600 : 400}
            />
            <span className="text-[10px] font-semibold whitespace-nowrap truncate max-w-full">
              {item.name}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
