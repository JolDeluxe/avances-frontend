import { httpClient, type ApiResponse } from '@/lib/api/http-client';
import type {
  ListadosListResponse,
  ListadoFilters,
  ListadoItem,
  CreateListadoInput,
  UpdateListadoInput,
  TipoFrenteMaterial,
  RetrocederFrenteInput,
  CancelarListadoInput,
  MotivoInput,
  DepartamentosResponse,
  BatchOperarInput,
  BatchOperarResponse,
} from '../types/listados.types';

export const listadosApi = {
  // ─── Consulta ────────────────────────────────────────────────────────────────

  getListados: async (filters?: ListadoFilters): Promise<ApiResponse<ListadosListResponse>> => {
    return httpClient.get<ApiResponse<ListadosListResponse>>('/listados', {
      params: filters as Record<string, unknown> | undefined,
    });
  },

  getListadoById: async (id: number): Promise<ApiResponse<ListadoItem>> => {
    return httpClient.get<ApiResponse<ListadoItem>>(`/listados/${id}`);
  },

  getAnios: async (): Promise<ApiResponse<number[]>> => {
    return httpClient.get<ApiResponse<number[]>>('/listados/anios');
  },

  // ─── Creación y edición (solo en PENDIENTE) ───────────────────────────────

  createListado: async (input: CreateListadoInput): Promise<ApiResponse<ListadoItem>> => {
    return httpClient.post<ApiResponse<ListadoItem>>('/listados', input);
  },

  updateListado: async (id: number, input: UpdateListadoInput): Promise<ApiResponse<ListadoItem>> => {
    return httpClient.patch<ApiResponse<ListadoItem>>(`/listados/${id}`, input);
  },

  // ─── Transiciones operativas por frente ───────────────────────────────────

  /**
   * PENDIENTE → SEPARADO (por frente)
   * POST /listados/:id/separar con { tipoFrente, motivo? }
   */
  separar: async (
    id: number,
    tipoFrente?: TipoFrenteMaterial,
    motivo?: string,
  ): Promise<ApiResponse<ListadoItem>> => {
    return httpClient.post<ApiResponse<ListadoItem>>(`/listados/${id}/separar`, {
      tipoFrente,
      motivo,
    });
  },

  /**
   * SEPARADO → ENTREGADO (por frente)
   * POST /listados/:id/entregar con { tipoFrente, motivo? }
   */
  entregar: async (
    id: number,
    tipoFrente?: TipoFrenteMaterial,
    motivo?: string,
  ): Promise<ApiResponse<ListadoItem>> => {
    return httpClient.post<ApiResponse<ListadoItem>>(`/listados/${id}/entregar`, {
      tipoFrente,
      motivo,
    });
  },

  // ─── Transiciones con motivo obligatorio ─────────────────────────────────

  /**
   * ENTREGADO → SEPARADO  |  SEPARADO → PENDIENTE (por frente)
   * POST /listados/:id/retroceder con { tipoFrente, motivo }
   */
  retroceder: async (
    id: number,
    input: RetrocederFrenteInput | MotivoInput,
  ): Promise<ApiResponse<ListadoItem>> => {
    return httpClient.post<ApiResponse<ListadoItem>>(`/listados/${id}/retroceder`, input);
  },

  /**
   * Cancelación de listado (global)
   * POST /listados/:id/cancelar con { motivo }
   */
  cancelar: async (
    id: number,
    input: CancelarListadoInput | MotivoInput,
  ): Promise<ApiResponse<ListadoItem>> => {
    return httpClient.post<ApiResponse<ListadoItem>>(`/listados/${id}/cancelar`, input);
  },

  /**
   * ENTREGADO → DESCONTADO (Fase 2 arquitectura)
   * POST /listados/:id/descontar con { tipoFrente, motivo? }
   */
  descontar: async (
    id: number,
    tipoFrente: TipoFrenteMaterial,
    motivo?: string,
  ): Promise<ApiResponse<ListadoItem>> => {
    return httpClient.post<ApiResponse<ListadoItem>>(`/listados/${id}/descontar`, {
      tipoFrente,
      motivo,
    });
  },

  /**
   * Operaciones masivas en lote (separar, entregar, descontar)
   * POST /listados/batch-operar
   */
  batchOperar: async (input: BatchOperarInput): Promise<ApiResponse<BatchOperarResponse>> => {
    return httpClient.post<ApiResponse<BatchOperarResponse>>('/listados/batch-operar', input);
  },

  // ─── Catálogos ────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/departments
   * Requiere permiso departamento:ver.
   * Devuelve departamentos activos con sus líneas de producción y sus áreas (BOTA / ACCESORIOS).
   */
  getDepartamentos: async (): Promise<ApiResponse<DepartamentosResponse>> => {
    return httpClient.get<ApiResponse<DepartamentosResponse>>('/departments');
  },
};
