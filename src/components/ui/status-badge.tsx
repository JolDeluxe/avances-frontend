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
import { cn } from '@/lib/utils/cn';

export interface StatusBadgeProps {
  /** Estado de listado */
  estadoListado?: EstadoListado;
  /** Estado de frente de material */
  estadoFrente?: EstadoFrenteMaterial;
  className?: string;
}

/**
 * Componente unificado para badges de estado (Listado y Frente).
 * Consume la configuración centralizada de src/config/status-config.ts.
 */
export function StatusBadge({
  estadoListado,
  estadoFrente,
  className,
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
        'inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-semibold border transition-colors',
        resolved.className,
        className,
      )}
    >
      <span className={cn('w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0', resolved.dot)} />
      {resolved.label}
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
