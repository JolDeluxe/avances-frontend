export type TipoFrenteSurtido = 'DIRECTOS' | 'INDIRECTOS' | 'BOLSAS';
export type TipoSurtidoAlmacen = 'DIRECTOS' | 'INDIRECTOS' | 'BOLSAS' | 'TODOS' | string;
export type TipoMaterialAuditor = 'DIRECTOS' | 'INDIRECTOS' | 'BOLSAS' | 'TODOS' | string;
export type AreaValeAuth = 'BOTA' | 'ACCESORIOS' | 'OTRO';

export interface DepartamentoValeAuthSimple {
  id: number;
  codigo: string;
  nombre: string;
  areaFija?: AreaValeAuth | null;
  requiereSeleccionArea?: boolean;
}

/** Indica si un valor multi-frente (ej. "DIRECTOS,BOLSAS" o "TODOS") autoriza el frente dado. Deny-by-default si no hay valor. */
export function frenteAutorizado(valor: string | null | undefined, frente: string): boolean {
  if (!valor || valor.trim() === '') return false;
  const lista = valor.split(',').map((s) => s.trim().toUpperCase());
  return lista.includes('TODOS') || lista.includes(frente.toUpperCase());
}

export interface UsuarioAuth {
  id: number;
  nombre: string;
  usuario: string;
  rolId?: number;
  rol?: string;
  departamentoId?: number;
  departamento?: { id: number; codigo: string; nombre: string };
  tipoSurtidoAlmacen?: TipoSurtidoAlmacen | null;
  tipoMaterialAuditor?: TipoMaterialAuditor | null;
  lineasAsignadas?: { id: number; codigo: string; nombre: string; area?: string }[];
  areasVale?: AreaValeAuth[];
  departamentosValeAsignados?: DepartamentoValeAuthSimple[];
  permisos?: string[];
  activo?: boolean;
  imagen?: string;
}

export interface BackendUsuarioPayload {
  id: number;
  nombre: string;
  usuario: string;
  rolId?: number;
  rol?: string | { id: number; codigo: string; nombre: string };
  departamentoId?: number;
  departamento?: { id: number; codigo: string; nombre: string };
  tipoSurtidoAlmacen?: TipoSurtidoAlmacen | null;
  tipoMaterialAuditor?: TipoMaterialAuditor | null;
  lineasAsignadas?: { id: number; codigo: string; nombre: string; area?: string }[];
  areasVale?: AreaValeAuth[];
  departamentosValeAsignados?: DepartamentoValeAuthSimple[];
  permisos?: string[];
  activo?: boolean;
  imagen?: string;
}

export interface LoginCredentials {
  usuario: string;
  password: string;
}

export interface LoginResponseData {
  usuario: UsuarioAuth;
  accessToken: string;
}

export interface UsuarioLoginItem {
  id: number;
  nombre: string;
  usuario: string;
  rol?: { codigo: string };
}

