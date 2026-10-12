import type { ReactNode } from 'react';
import type { AreaProduccion, EstadoRegistro } from '../types/lineas.types';

export interface LineaStatusBadgeProps {
  estado: EstadoRegistro;
  className?: string;
}

export function LineaStatusBadge({ estado, className = '' }: LineaStatusBadgeProps): ReactNode {
  const isActivo = estado === 'ACTIVO';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        isActivo
          ? 'bg-success/10 text-success border-success/20'
          : 'bg-text-muted/10 text-text-muted border-text-muted/20'
      } ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isActivo ? 'bg-success' : 'bg-text-muted'
        }`}
      />
      {isActivo ? 'Activa' : 'Inactiva'}
    </span>
  );
}

export interface LineaAreaBadgeProps {
  area: AreaProduccion;
  className?: string;
}

export function LineaAreaBadge({ area, className = '' }: LineaAreaBadgeProps): ReactNode {
  return (
    <span className={`text-sm text-text-secondary font-medium ${className}`}>
      {area === 'BOTA' ? 'Bota' : 'Accesorios'}
    </span>
  );
}
