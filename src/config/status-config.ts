import type {
  EstadoListado,
  EstadoFrenteMaterial,
  TipoFrenteMaterial,
} from '@/features/listados/types/listados.types';
import type {
  EstadoVale,
  AreaVale,
} from '@/features/vales/types/vales.types';

export interface StatusVisualConfig {
  label: string;
  className: string;
  dot: string;
  dotClass?: string;
  textClass?: string;
  bgClass?: string;
  icon?: string;
  iconFill?: boolean;
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
    className: 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20',
    dot: 'bg-zinc-400',
    icon: 'more_horiz',
  },
  EN_PROCESO: {
    label: 'En Proceso',
    className: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
    dot: 'bg-sky-500',
    icon: 'hourglass_empty',
  },
  SEPARADO: {
    label: 'Separado',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
    icon: 'circle',
    iconFill: true,
  },
  ENTREGADO_A_PRODUCCION: {
    label: 'Entregado a Producción',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
    icon: 'check',
  },
  CANCELADO: {
    label: 'Cancelado',
    className: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    dot: 'bg-rose-500',
    icon: 'cancel',
  },
  DESCONTADO: {
    label: 'Descontado en Sistema',
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    dot: 'bg-purple-600',
    icon: 'done_all',
  },
};

/**
 * Configuración canónica para estados operativos de Frente.
 */
export const ESTADO_FRENTE_CONFIG: Record<EstadoFrenteMaterial, StatusVisualConfig> = {
  PENDIENTE: {
    label: 'Materiales Pendientes',
    className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    dot: 'bg-zinc-400',
    icon: 'more_horiz',
  },
  SEPARADO: {
    label: 'Separado en Almacén',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
    icon: 'circle',
    iconFill: true,
  },
  ENTREGADO: {
    label: 'Entregado a Producción',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
    icon: 'check',
  },
  DESCONTADO: {
    label: 'Descontado en Sistema',
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    dot: 'bg-purple-600',
    icon: 'done_all',
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

/**
 * Configuración canónica para estados del módulo de Vales.
 */
export const ESTADO_VALE_CONFIG: Record<EstadoVale, StatusVisualConfig> = {
  PENDIENTE: {
    label: 'Materiales Pendientes',
    className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    dot: 'bg-zinc-400',
    dotClass: 'bg-zinc-400',
    textClass: 'text-zinc-600 dark:text-zinc-400',
    bgClass: 'bg-zinc-500/10',
    icon: 'more_horiz',
  },
  SEPARADO: {
    label: 'Separado en Almacén',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700 dark:text-amber-400',
    bgClass: 'bg-amber-500/10',
    icon: 'circle',
    iconFill: true,
  },
  ENTREGADO: {
    label: 'Entregado a Producción',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    icon: 'check',
  },
  DESCONTADO: {
    label: 'Descontado en Sistema',
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
    dot: 'bg-purple-600',
    dotClass: 'bg-purple-600',
    textClass: 'text-purple-700 dark:text-purple-400',
    bgClass: 'bg-purple-500/10',
    icon: 'done_all',
  },
  CANCELADO: {
    label: 'Cancelado',
    className: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    dot: 'bg-rose-500',
    dotClass: 'bg-rose-500',
    textClass: 'text-rose-700 dark:text-rose-400',
    bgClass: 'bg-rose-500/10',
    icon: 'cancel',
  },
};

export interface AreaValeVisualConfig {
  codigo: AreaVale;
  nombre: string;
  label: string;
  shortLabel: string;
  className: string;
  bgClass: string;
  textClass: string;
}

export const AREA_VALE_CONFIG: Record<AreaVale, AreaValeVisualConfig> = {
  BOTA: {
    codigo: 'BOTA',
    nombre: 'Bota',
    label: 'Bota',
    shortLabel: 'BOTA',
    className: 'bg-marca-primario/10 text-marca-primario border-marca-primario/25',
    bgClass: 'bg-marca-primario/10',
    textClass: 'text-marca-primario',
  },
  ACCESORIOS: {
    codigo: 'ACCESORIOS',
    nombre: 'Accesorios',
    label: 'Accesorios',
    shortLabel: 'ACC',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  OTRO: {
    codigo: 'OTRO',
    nombre: 'Otro',
    label: 'Otro',
    shortLabel: 'OTRO',
    className: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/25',
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-700 dark:text-slate-300',
  },
};
