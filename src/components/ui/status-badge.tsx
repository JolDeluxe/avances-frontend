import { type ReactNode } from 'react';
import {
  ESTADO_LISTADO_CONFIG,
  ESTADO_FRENTE_CONFIG,
  type StatusVisualConfig,
} from '@/config/status-config';
import type {
  EstadoListado,
  EstadoFrenteMaterial,
} from '@/features/listados/types/listados.types';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils/cn';

export interface StatusBadgeProps {
  /** Estado de listado */
  estadoListado?: EstadoListado;
  /** Estado de frente de material */
  estadoFrente?: EstadoFrenteMaterial;
  className?: string;
  showIcon?: boolean;
}

/**
 * Componente unificado para badges de estado (Listado y Frente).
 * Consume la configuración centralizada de src/config/status-config.ts.
 */
export function StatusBadge({
  estadoListado,
  estadoFrente,
  className,
  showIcon = true,
}: StatusBadgeProps): ReactNode {
  let config: StatusVisualConfig | undefined;

  if (estadoListado) {
    config = ESTADO_LISTADO_CONFIG[estadoListado];
  } else if (estadoFrente) {
    config = ESTADO_FRENTE_CONFIG[estadoFrente];
  }

  const resolved = config ?? {
    label: estadoListado ?? estadoFrente ?? 'Desconocido',
    className: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
    dot: 'bg-slate-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors',
        resolved.className,
        className,
      )}
    >
      {showIcon && resolved.icon ? (
        <Icon
          name={resolved.icon}
          fill={resolved.iconFill}
          size="14px"
          className="shrink-0"
        />
      ) : (
        <span className={cn('w-2 h-2 rounded-full shrink-0', resolved.dot)} />
      )}
      <span>{resolved.label}</span>
    </span>
  );
}

/**
 * Badge específico para estados globales de Listado.
 */
export function ListadoStatusBadge({
  estado,
  className,
}: {
  estado: EstadoListado;
  className?: string;
}): ReactNode {
  return <StatusBadge estadoListado={estado} className={className} />;
}

/**
 * Badge específico para estados operativos de Frente de Surtido.
 */
export function FrenteStatusBadge({
  estado,
  className,
}: {
  estado: EstadoFrenteMaterial;
  className?: string;
}): ReactNode {
  return <StatusBadge estadoFrente={estado} className={className} />;
}
