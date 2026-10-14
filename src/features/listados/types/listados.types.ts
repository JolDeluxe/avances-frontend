/**
 * Tipos del módulo de Listados de Materia Prima.
 * Reflejan exactamente el contrato canónico del backend (Fase 1).
 * La fuente de verdad para los frentes es la entidad relacional ListadoSurtidoFrente.
 * No incluye lógica de ERP, cantidades, inventario ni auditoría Fase 2.
 */

// ─── Enums canónicos de dominio ────────────────────────────────────────────────

export type TipoFrenteMaterial = 'DIRECTOS' | 'INDIRECTOS' | 'BOLSAS';

export type EstadoFrenteMaterial =
  | 'PENDIENTE'
  | 'SEPARADO'
  | 'ENTREGADO'
  | 'DESCONTADO';

export type EstadoListado =
  | 'PENDIENTE'
  | 'EN_PROCESO'
  | 'SEPARADO'
  | 'ENTREGADO_A_PRODUCCION'
  | 'CANCELADO'
  | 'DESCONTADO';

export type AreaProduccion = 'BOTA' | 'ACCESORIOS';

// ─── Entidades base ────────────────────────────────────────────────────────────

export interface LineaProduccionSimple {
  id: number;
  codigo: string;
  nombre: string;
  area?: AreaProduccion;
  orden?: number;
  estado?: string;
}

export interface DepartamentoSimple {
  id: number;
  codigo: string;
  nombre: string;
  estado?: string;
}

export interface UsuarioSimple {
  id: number;
  usuario: string;
  nombre: string;
}

// ─── Trazabilidad por frente y por listado ─────────────────────────────────────

export interface HistorialEstadoFrente {
  id: number;
  listadoSurtidoFrenteId: number;
  estadoAnterior: EstadoFrenteMaterial;
  estadoNuevo: EstadoFrenteMaterial;
  cambiadoPorUsuarioId: number;
  fechaCambio: string;
  motivo: string | null;
  cambiadoPorUsuario?: UsuarioSimple;
}

export interface HistorialEstadoListado {
  id: number;
  listadoMaterialId?: number;
  estadoAnterior: EstadoListado | null;
  estadoNuevo: EstadoListado;
  motivo: string | null;
  fechaCambio: string;
  cambiadoPorUsuario: UsuarioSimple;
}

// ─── Frentes Operativos (Fuente de verdad del backend) ─────────────────────────

export interface ListadoSurtidoFrente {
  id: number;
  listadoMaterialId: number;
  tipoFrente: TipoFrenteMaterial;
  estado: EstadoFrenteMaterial;
  separadoPorId?: number | null;
  fechaSeparado?: string | null;
  entregadoPorId?: number | null;
  fechaEntregado?: string | null;
  validadoPorId?: number | null;
  fechaValidado?: string | null;
  descontadoPorId?: number | null;
  fechaDescontado?: string | null;
  separadoPor?: UsuarioSimple | null;
  entregadoPor?: UsuarioSimple | null;
  validadoPor?: UsuarioSimple | null;
  descontadoPor?: UsuarioSimple | null;
  historialEstados?: HistorialEstadoFrente[];
}

// ─── Ítem de Listado ───────────────────────────────────────────────────────────

export interface ListadoItem {
  id: number;
  numeroListado: string;
  fechaRequerida: string; // ISO string o YYYY-MM-DD
  estado: EstadoListado;
  departamento: DepartamentoSimple;
  lineaProduccion: LineaProduccionSimple;
  creadoPorUsuario: UsuarioSimple;
  fechaCreacion?: string;
  fechaActualizacion?: string;
  createdAt?: string; // compatibilidad
  updatedAt?: string; // compatibilidad
  frentes: ListadoSurtidoFrente[];
  historialEstados?: HistorialEstadoListado[];
}

// ─── Paginación (contrato real del backend) ───────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ListadosListResponse {
  items: ListadoItem[];
  pagination: PaginationMeta;
}

// ─── Filtros de consulta ───────────────────────────────────────────────────────

export interface ListadoFilters {
  estado?: EstadoListado | string;
  lineaProduccionId?: number;
  departamentoId?: number;
  numeroListado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  limit?: number;
  pagina?: number;
  porPagina?: number;
  modoGlobal?: boolean;
}

// ─── Inputs de mutación ────────────────────────────────────────────────────────

export interface CreateListadoInput {
  numeroListado: string;
  fechaRequerida: string; // YYYY-MM-DD
  lineaProduccionId: number;
}

export interface UpdateListadoInput {
  numeroListado?: string;
  fechaRequerida?: string; // YYYY-MM-DD
  lineaProduccionId?: number;
}

/** Mutación de frente: Separar / Entregar (motivo opcional) */
export interface TransicionFrenteInput {
  tipoFrente: TipoFrenteMaterial;
  motivo?: string;
}

/** Retroceso de frente: requiere motivo obligatorio */
export interface RetrocederFrenteInput {
  tipoFrente: TipoFrenteMaterial;
  motivo: string; // 1–500 caracteres
}

/** Cancelación de listado: global, requiere motivo obligatorio */
export interface CancelarListadoInput {
  motivo: string; // 1–500 caracteres
}

export interface MotivoInput {
  motivo: string;
  tipoFrente?: TipoFrenteMaterial;
}

// ─── Catálogo de departamentos con sus líneas de producción ───────────────────

export interface LineaProduccionConEstado extends LineaProduccionSimple {
  estado: string;
  area?: AreaProduccion;
}

export interface DepartamentoConLineas {
  id: number;
  codigo: string;
  nombre: string;
  estado: string;
  lineasProduccion: LineaProduccionConEstado[];
}

export type DepartamentosResponse = DepartamentoConLineas[];

// ─── Operaciones en Lote (Batch) ──────────────────────────────────────────────

export interface BatchOperarInput {
  ids: number[];
  accion: 'separar' | 'entregar' | 'descontar';
  tipoFrente?: TipoFrenteMaterial;
  motivo?: string;
}

export interface BatchOperarResponse {
  total: number;
  procesados: number;
  fallidosCount: number;
  exitosos: Array<{ id: number; numeroListado: string }>;
  fallidos: Array<{ id: number; error: string; numeroListado?: string }>;
}
