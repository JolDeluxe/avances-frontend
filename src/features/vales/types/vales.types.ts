/**
 * Tipos del módulo de Vales de Material.
 * Reflejan exactamente el contrato canónico del backend.
 */

// ─── Enums canónicos de dominio ────────────────────────────────────────────────

export type AreaVale = 'BOTA' | 'ACCESORIOS' | 'OTRO';

export type EstadoVale =
  | 'PENDIENTE'
  | 'SEPARADO'
  | 'ENTREGADO'
  | 'DESCONTADO'
  | 'CANCELADO';

export type AccionHistorialVale =
  | 'CREACION'
  | 'EDICION'
  | 'SEPARACION'
  | 'SEPARACION_Y_ENTREGA'
  | 'ENTREGA'
  | 'DESCUENTO'
  | 'RETROCESO'
  | 'CANCELACION';

export type ValeScopeView = 'general' | 'registrar' | 'almacen' | 'descontar' | 'auditoria';

export type BatchAccionVale = 'SEPARAR' | 'ENTREGAR' | 'SEPARAR_Y_ENTREGAR' | 'DESCONTAR';

// ─── Entidades base y catálogos ───────────────────────────────────────────────

export interface DepartamentoOrganizacionalSimple {
  id: number;
  codigo: string;
  nombre: string;
}

export interface SerieValeItem {
  id: number;
  codigo: string;
  esSistema: boolean;
  estado?: string;
}

export type SerieValeRef = SerieValeItem;

export interface DepartamentoValeItem {
  id: number;
  codigo: string;
  nombre: string;
  areaFija: AreaVale | null;
  requiereSeleccionArea: boolean;
  orden?: number;
  estado?: string;
  departamentoId?: number;
}

export type DepartamentoValeRef = DepartamentoValeItem;

export type ConteosPorEstadoVale = Record<EstadoVale, number>;
export type ConteosPorAreaVale = Record<AreaVale, number>;

export interface UsuarioValeSimple {
  id: number;
  usuario: string;
  nombre: string;
}

// ─── Trazabilidad e Historial de Movimientos ─────────────────────────────────

export interface CambioEdicionValeCampo {
  anterior?: string | number | boolean | null;
  nuevo?: string | number | boolean | null;
  antes?: string | number | boolean | null;
  despues?: string | number | boolean | null;
}

export interface HistorialEstadoValeItem {
  id: number;
  valeId: number;
  accion: AccionHistorialVale;
  estadoAnterior: EstadoVale | null;
  estadoNuevo: EstadoVale;
  usuarioId: number;
  motivo: string | null;
  cambios: Record<string, CambioEdicionValeCampo> | null;
  fechaCambio: string;
  usuario?: UsuarioValeSimple;
}

// ─── Ítem de Vale de Material ─────────────────────────────────────────────────

export interface ValeItem {
  id: number;
  departamentoId: number;
  serieId: number;
  folio: string;
  departamentoValeId: number;
  area: AreaVale;
  estado: EstadoVale;
  fechaSolicitud: string;
  horaSolicitud?: string | null;
  tieneHoraSolicitud: boolean;

  creadoPorId: number;
  fechaCreacion: string;
  fechaActualizacion: string;
  createdAt?: string;
  updatedAt?: string;

  separadoPorId: number | null;
  fechaSeparado: string | null;

  entregadoPorId: number | null;
  fechaEntregado: string | null;

  descontadoPorId: number | null;
  fechaDescontado: string | null;

  revertidoPorId: number | null;
  fechaRevertido: string | null;
  motivoReversion?: string | null;
  motivoRetroceso?: string | null;

  canceladoPorId: number | null;
  fechaCancelacion?: string | null;
  fechaCancelado?: string | null;
  motivoCancelacion: string | null;

  departamento: DepartamentoOrganizacionalSimple;
  serie: SerieValeItem;
  departamentoVale: DepartamentoValeItem;

  creadoPor: UsuarioValeSimple;
  separadoPor: UsuarioValeSimple | null;
  entregadoPor: UsuarioValeSimple | null;
  descontadoPor: UsuarioValeSimple | null;
  revertidoPor: UsuarioValeSimple | null;
  canceladoPor: UsuarioValeSimple | null;

  historialEstados?: HistorialEstadoValeItem[];
}

// ─── Respuestas paginadas y de catálogos ─────────────────────────────────────

export interface ValesListResponse {
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  conteosPorEstado: Record<EstadoVale, number>;
  conteosPorArea: Record<AreaVale, number>;
  items: ValeItem[];
}

export interface ValesCatalogosResponse {
  departamentoId: number;
  series: SerieValeItem[];
  departamentosVale: DepartamentoValeItem[];
  areas: AreaVale[];
}

// ─── Filtros de consulta ──────────────────────────────────────────────────────

export interface ValeFilters {
  departamentoId?: number;
  serieId?: number;
  departamentoValeId?: number;
  area?: AreaVale;
  estado?: EstadoVale | string;
  fechaDesde?: string;
  fechaHasta?: string;
  busqueda?: string;
  scopeView?: ValeScopeView;
  pagina?: number;
  limite?: number;
}

// ─── Inputs de mutación ───────────────────────────────────────────────────────

export interface CreateValeInput {
  departamentoId?: number;
  serieId?: number;
  nuevaSerie?: string;
  folio: string;
  departamentoValeId?: number;
  nuevoDepartamento?: string;
  area?: AreaVale;
  fechaSolicitud: string;
  horaSolicitud?: string | null;
  tieneHoraSolicitud?: boolean;
}

export interface UpdateValeInput {
  serieId?: number;
  nuevaSerie?: string;
  folio?: string;
  departamentoValeId?: number;
  nuevoDepartamento?: string;
  area?: AreaVale;
  fechaSolicitud?: string;
  horaSolicitud?: string | null;
  tieneHoraSolicitud?: boolean;
}

export interface SepararValeInput {
  entregarTambien?: boolean;
}

export type EntregarValeInput = Record<string, never>;

export type DescontarValeInput = Record<string, never>;

export interface RetrocederValeInput {
  estadoDestino?: 'PENDIENTE' | 'SEPARADO' | 'ENTREGADO';
  motivo: string;
}

export interface CancelarValeInput {
  motivo: string;
}

export interface BatchOperarValesInput {
  valeIds: number[];
  accion: BatchAccionVale;
}

export interface BatchOperarValesResponse {
  procesados: number;
  valeIds: number[];
  accion: BatchAccionVale;
  estadoAnterior: EstadoVale;
  estadoNuevo: EstadoVale;
  departamentoId: number;
  areasAfectadas: AreaVale[];
  deptosValeAfectados: number[];
}
