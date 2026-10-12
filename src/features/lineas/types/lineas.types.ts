export type AreaProduccion = 'BOTA' | 'ACCESORIOS';

export type EstadoRegistro = 'ACTIVO' | 'INACTIVO';

export interface LineaProduccionItem {
  id: number;
  codigo: string;
  nombre: string;
  departamentoId: number;
  area: AreaProduccion;
  orden?: number;
  estado: EstadoRegistro;
  departamentoNombre?: string;
  departamentoCodigo?: string;
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

export interface ReorderLineasInput {
  items: Array<{ id: number; orden: number }>;
}

export interface DepartamentoWithLineas {
  id: number;
  codigo: string;
  nombre: string;
  estado: EstadoRegistro;
  lineasProduccion: LineaProduccionItem[];
}

export interface CreateLineaInput {
  codigo?: string;
  nombre: string;
  departamentoId: number;
  area: AreaProduccion;
}

export interface UpdateLineaInput {
  nombre?: string;
  area?: AreaProduccion;
  estado?: EstadoRegistro;
}

export interface LineaFilters {
  busqueda?: string;
  departamentoId?: number | 'TODOS';
  area?: AreaProduccion | 'TODOS';
  estado?: EstadoRegistro | 'TODOS';
}
