import { httpClient, type ApiResponse } from '@/lib/api/http-client';
import type {
  ValesListResponse,
  ValesCatalogosResponse,
  ValeFilters,
  ValeItem,
  CreateValeInput,
  UpdateValeInput,
  SepararValeInput,
  EntregarValeInput,
  DescontarValeInput,
  RetrocederValeInput,
  CancelarValeInput,
  BatchOperarValesInput,
  BatchOperarValesResponse,
} from '../types/vales.types';

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.message || 'Error en la operación de vales.');
  }
  return response.data;
}

export const valesApi = {
  // ─── Consulta ────────────────────────────────────────────────────────────────

  getVales: async (filters?: ValeFilters): Promise<ValesListResponse> => {
    return unwrap(
      httpClient.get<ApiResponse<ValesListResponse>>('/vales', {
        params: filters as Record<string, unknown> | undefined,
      }),
    );
  },

  getValeById: async (id: number): Promise<ValeItem> => {
    return unwrap(httpClient.get<ApiResponse<ValeItem>>(`/vales/${id}`));
  },

  getCatalogos: async (departamentoId?: number): Promise<ValesCatalogosResponse> => {
    return unwrap(
      httpClient.get<ApiResponse<ValesCatalogosResponse>>('/vales/catalogos', {
        params: departamentoId ? { departamentoId } : undefined,
      }),
    );
  },

  getAuditoriaCount: async (): Promise<number> => {
    const data = await unwrap(httpClient.get<ApiResponse<{ count: number }>>('/vales/auditoria/count'));
    return data.count;
  },

  // ─── Creación y edición (solo en PENDIENTE) ───────────────────────────────

  createVale: async (input: CreateValeInput): Promise<ValeItem> => {
    return unwrap(httpClient.post<ApiResponse<ValeItem>>('/vales', input));
  },

  updateVale: async (id: number, input: UpdateValeInput): Promise<ValeItem> => {
    return unwrap(httpClient.put<ApiResponse<ValeItem>>(`/vales/${id}`, input));
  },

  // ─── Transiciones operativas ──────────────────────────────────────────────

  separar: async (id: number, input?: SepararValeInput): Promise<ValeItem> => {
    return unwrap(httpClient.post<ApiResponse<ValeItem>>(`/vales/${id}/separar`, input ?? {}));
  },

  separarVale: async (id: number, input?: SepararValeInput): Promise<ValeItem> => {
    return unwrap(httpClient.post<ApiResponse<ValeItem>>(`/vales/${id}/separar`, input ?? {}));
  },

  entregar: async (id: number, input?: EntregarValeInput): Promise<ValeItem> => {
    return unwrap(httpClient.post<ApiResponse<ValeItem>>(`/vales/${id}/entregar`, input ?? {}));
  },

  entregarVale: async (id: number, input?: EntregarValeInput): Promise<ValeItem> => {
    return unwrap(httpClient.post<ApiResponse<ValeItem>>(`/vales/${id}/entregar`, input ?? {}));
  },

  descontar: async (id: number, input?: DescontarValeInput): Promise<ValeItem> => {
    return unwrap(httpClient.post<ApiResponse<ValeItem>>(`/vales/${id}/descontar`, input ?? {}));
  },

  descontarVale: async (id: number, input?: DescontarValeInput): Promise<ValeItem> => {
    return unwrap(httpClient.post<ApiResponse<ValeItem>>(`/vales/${id}/descontar`, input ?? {}));
  },

  // ─── Transiciones con motivo obligatorio ─────────────────────────────────

  retroceder: async (id: number, input: RetrocederValeInput): Promise<ValeItem> => {
    return unwrap(httpClient.post<ApiResponse<ValeItem>>(`/vales/${id}/retroceder`, input));
  },

  retrocederVale: async (id: number, input: RetrocederValeInput): Promise<ValeItem> => {
    return unwrap(httpClient.post<ApiResponse<ValeItem>>(`/vales/${id}/retroceder`, input));
  },

  cancelar: async (id: number, input: CancelarValeInput): Promise<ValeItem> => {
    return unwrap(httpClient.post<ApiResponse<ValeItem>>(`/vales/${id}/cancelar`, input));
  },

  cancelarVale: async (id: number, input: CancelarValeInput): Promise<ValeItem> => {
    return unwrap(httpClient.post<ApiResponse<ValeItem>>(`/vales/${id}/cancelar`, input));
  },

  /**
   * Operaciones masivas en lote (Todo-o-Nada)
   * POST /vales/batch-operar
   */
  batchOperar: async (input: BatchOperarValesInput): Promise<BatchOperarValesResponse> => {
    return unwrap(
      httpClient.post<ApiResponse<BatchOperarValesResponse>>('/vales/batch-operar', input),
    );
  },
};
