import type {
  TipoSurtidoAlmacen,
  TipoMaterialAuditor,
  AreaValeAuth,
} from '@/features/auth/types/auth.types';

export type { TipoSurtidoAlmacen, TipoMaterialAuditor, AreaValeAuth };

export type EstadoUsuario = 'ACTIVO' | 'INACTIVO';

export type AccionExcepcionPermiso = 'CONCEDER' | 'DENEGAR';

export interface RolSimple {
  id: number;
  codigo: string;
  nombre: string;
  permisosBase?: string[];
}

export interface LineaProduccionSimple {
  id: number;
  codigo: string;
  nombre: string;
  area?: string;
  orden?: number;
  departamentoId?: number;
}

export interface DepartamentoValeCatalogSimple {
  id: number;
  codigo: string;
  nombre: string;
  areaFija: AreaValeAuth | null;
  requiereSeleccionArea: boolean;
  departamentoId?: number;
}

export interface DepartamentoSimple {
  id: number;
  codigo: string;
  nombre: string;
  lineasProduccion?: LineaProduccionSimple[];
  departamentosVale?: DepartamentoValeCatalogSimple[];
}

export interface PermisoSimple {
  id: number;
  codigo: string;
  modulo: string;
  nombre?: string;
  descripcion: string;
}

export interface ExcepcionPermisoItem {
  id?: number;
  permisoId: number;
  codigo?: string;
  modulo?: string;
  descripcion?: string;
  accion: AccionExcepcionPermiso;
}

export interface UsuarioItem {
  id: number;
  usuario: string;
  nombre: string;
  rol: RolSimple;
  departamento: DepartamentoSimple | null;
  estado: EstadoUsuario;
  tipoSurtidoAlmacen?: TipoSurtidoAlmacen | null;
  tipoMaterialAuditor?: TipoMaterialAuditor | null;
  lineasAsignadas: LineaProduccionSimple[];
  areasVale?: AreaValeAuth[];
  departamentosValeAsignados?: DepartamentoValeCatalogSimple[];
  excepcionesPermiso?: ExcepcionPermisoItem[];
  permisosEfectivos?: string[];
  fechaCreacion?: string;
  fechaActualizacion?: string;
}

export interface UsersListResponse {
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  items: UsuarioItem[];
  statsPorRol?: Record<string, number>;
}

export interface UserFilters {
  departamentoId?: number;
  rolId?: number;
  estado?: EstadoUsuario;
  busqueda?: string;
  pagina?: number;
  limite?: number;
}

export interface CreateUserInput {
  usuario?: string;
  nombre: string;
  password?: string;
  rolId: number;
  departamentoId?: number;
  tipoSurtidoAlmacen?: TipoSurtidoAlmacen | null;
  tipoMaterialAuditor?: TipoMaterialAuditor | null;
  lineasAsignadas?: number[];
  lineaProduccionIds?: number[];
  areasVale?: AreaValeAuth[];
  departamentosValeIds?: number[];
  excepciones?: Array<{ permisoId: number; accion: AccionExcepcionPermiso }>;
}

export interface UpdateUserInput {
  nombre?: string;
  usuario?: string;
  password?: string;
  rolId?: number;
  departamentoId?: number;
  tipoSurtidoAlmacen?: TipoSurtidoAlmacen | null;
  tipoMaterialAuditor?: TipoMaterialAuditor | null;
  lineasAsignadas?: number[];
  lineaProduccionIds?: number[];
  areasVale?: AreaValeAuth[];
  departamentosValeIds?: number[];
  excepciones?: Array<{ permisoId: number; accion: AccionExcepcionPermiso }>;
  permisosOtorgados?: string[];
  permisosRevocados?: string[];
}

export interface ResetPasswordInput {
  newPassword?: string;
  passwordNueva?: string;
}

export interface UserCatalogs {
  roles: RolSimple[];
  departamentos: DepartamentoSimple[];
  permisos: PermisoSimple[];
}

export interface RevealedPasswordResponse {
  usuario: string;
  password?: string;
  passwordActual?: string;
}
