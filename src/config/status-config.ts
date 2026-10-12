import type {
  EstadoListado,
  EstadoFrenteMaterial,
  TipoFrenteMaterial,
} from '@/features/listados/types/listados.types';

export interface StatusVisualConfig {
  label: string;
  className: string;
  dot: string;
}

export interface FrenteTipoConfig {
  codigo: TipoFrenteMaterial;
  nombre: string;
  shortLabel: string;
}

/**
 * Configuración canónica para estados globales de Listado.
 * Respeta el sistema de diseño institucional de Cuadra.
 */
export const ESTADO_LISTADO_CONFIG: Record<EstadoListado, StatusVisualConfig> = {
  PENDIENTE: {
    label: 'Pendiente',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  EN_PROCESO: {
    label: 'En Proceso',
    className: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
    dot: 'bg-sky-500',
  },
  SEPARADO: {
    label: 'Separado',
    className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    dot: 'bg-indigo-500',
  },
  ENTREGADO_A_PRODUCCION: {
    label: 'Entregado a Producción',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  CANCELADO: {
    label: 'Cancelado',
    className: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    dot: 'bg-rose-500',
  },
  DESCONTADO: {
    label: 'Descontado en Sistema',
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    dot: 'bg-purple-600',
  },
};

/**
 * Configuración canónica para estados operativos de Frente.
 */
export const ESTADO_FRENTE_CONFIG: Record<EstadoFrenteMaterial, StatusVisualConfig> = {
  PENDIENTE: {
    label: 'Pendiente',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
  },
  SEPARADO: {
    label: 'Separado',
    className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    dot: 'bg-indigo-500',
  },
  ENTREGADO: {
    label: 'Entregado',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  DESCONTADO: {
    label: 'Descontado',
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    dot: 'bg-purple-600',
  },
};

/**
 * Configuración para los tipos de frente operativos.
 */
export const TIPO_FRENTE_CONFIG: Record<TipoFrenteMaterial, FrenteTipoConfig> = {
  DIRECTOS: {
    codigo: 'DIRECTOS',
    nombre: 'Materiales Directos',
    shortLabel: 'DIR',
  },
  INDIRECTOS: {
    codigo: 'INDIRECTOS',
    nombre: 'Materiales Indirectos',
    shortLabel: 'IND',
  },
  BOLSAS: {
    codigo: 'BOLSAS',
    nombre: 'Bolsas',
    shortLabel: 'BOL',
  },
};
