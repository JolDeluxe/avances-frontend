import { httpClient, type ApiResponse } from '@/lib/api/http-client';
import type {
  DepartamentoWithLineas,
  LineaProduccionItem,
  CreateLineaInput,
  UpdateLineaInput,
} from '../types/lineas.types';

export const lineasApi = {
  /**
   * Obtiene todos los departamentos con sus líneas asociadas.
   * Por defecto incluye líneas inactivas para administración completa.
   */
  getDepartamentosWithLineas: async (incluirInactivos = true): Promise<ApiResponse<DepartamentoWithLineas[]>> => {
    return httpClient.get<ApiResponse<DepartamentoWithLineas[]>>('/departments', {
      params: { incluirInactivos },
    });
  },

  /**
   * Crea una nueva línea de producción asignada a un departamento.
   */
  createLinea: async (
    departamentoId: number,
    input: Omit<CreateLineaInput, 'departamentoId'>,
  ): Promise<ApiResponse<LineaProduccionItem>> => {
    return httpClient.post<ApiResponse<LineaProduccionItem>>(`/departments/${departamentoId}/lines`, input);
  },

  /**
   * Actualiza el nombre, área o estado de una línea de producción existente.
   */
  updateLinea: async (
    lineId: number,
    input: UpdateLineaInput,
  ): Promise<ApiResponse<LineaProduccionItem>> => {
    return httpClient.put<ApiResponse<LineaProduccionItem>>(`/departments/lines/${lineId}`, input);
  },

  /**
   * Inactiva lógicamente una línea de producción (borrado lógico).
   */
  deleteLinea: async (lineId: number): Promise<ApiResponse<void>> => {
    return httpClient.delete<ApiResponse<void>>(`/departments/lines/${lineId}`);
  },

  /**
   * Reactiva una línea de producción previamente inactivada.
   */
  reactivateLinea: async (lineId: number): Promise<ApiResponse<LineaProduccionItem>> => {
    return httpClient.put<ApiResponse<LineaProduccionItem>>(`/departments/lines/${lineId}`, {
      estado: 'ACTIVO',
    });
  },

  /**
   * Reordena secuencialmente las líneas de producción.
   */
  reorderLineas: async (items: Array<{ id: number; orden: number }>): Promise<ApiResponse<{ mensaje: string }>> => {
    return httpClient.put<ApiResponse<{ mensaje: string }>>('/departments/lines/reorder', { items });
  },
};
