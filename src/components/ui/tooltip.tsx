import { useState, useRef, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
type TooltipVariant = 'default' | 'dark';

const VARIANTS: Record<TooltipVariant, string> = {
  default: 'bg-brand-primary text-white',
  dark:    'bg-text-primary text-white',
};

const ARROW_COLORS: Record<TooltipVariant, Record<TooltipPosition, string>> = {
  default: {
    top:    'border-t-brand-primary',
    bottom: 'border-b-brand-primary',
    left:   'border-l-brand-primary',
    right:  'border-r-brand-primary',
  },
  dark: {
    top:    'border-t-text-primary',
    bottom: 'border-b-text-primary',
    left:   'border-l-text-primary',
    right:  'border-r-text-primary',
  },
};

const ARROW_POSITIONS: Record<TooltipPosition, string> = {
  top:    'top-full left-1/2 -translate-x-1/2',
  bottom: 'bottom-full left-1/2 -translate-x-1/2',
  left:   'left-full top-1/2 -translate-y-1/2',
  right:  'right-full top-1/2 -translate-y-1/2',
};

const TOOLTIP_OFFSETS: Record<TooltipPosition, string> = {
  top:    '-translate-x-1/2 -translate-y-full',
  bottom: '-translate-x-1/2',
  left:   '-translate-y-1/2 -translate-x-full',
  right:  '-translate-y-1/2',
};

export interface TooltipProps {
  children: ReactNode;
  text: string;
  position?: TooltipPosition;
  variant?: TooltipVariant;
  offset?: number;
  delay?: number;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

/**
 * Tooltip accesible con portal y posicionamiento por getBoundingClientRect.
 * Envuelve el trigger con un contenedor inline seguro para cualquier elemento.
 */
export function Tooltip({
  children,
  text,
  position = 'top',
  variant = 'default',
  offset = 8,
  delay = 200,
  className,
  triggerClassName,
  disabled = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const calculatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const positions: Record<TooltipPosition, { top: number; left: number }> = {
      top:    { top: rect.top - offset,            left: rect.left + rect.width / 2 },
      bottom: { top: rect.bottom + offset,         left: rect.left + rect.width / 2 },
      left:   { top: rect.top + rect.height / 2,  left: rect.left - offset         },
      right:  { top: rect.top + rect.height / 2,  left: rect.right + offset        },
    };
    setCoords(positions[position]);
  };

  const handleMouseEnter = () => {
    if (disabled) return;
    calculatePosition();
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const handleClick = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <>
      <span
        ref={triggerRef}
        className={cn('inline-flex', triggerClassName ?? 'w-full')}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {children}
      </span>

      {isVisible && !disabled && createPortal(
        <div
          className={cn(
            'fixed px-2.5 py-1 rounded-sm whitespace-nowrap text-xs font-semibold shadow-lg pointer-events-none z-[200]',
            'animate-in fade-in zoom-in-95 duration-200',
            TOOLTIP_OFFSETS[position],
            VARIANTS[variant],
            className,
          )}
          style={{ top: coords.top, left: coords.left }}
        >
          {text}
          <div
            className={cn(
              'absolute border-[5px] border-transparent',
              ARROW_POSITIONS[position],
              ARROW_COLORS[variant][position],
            )}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
