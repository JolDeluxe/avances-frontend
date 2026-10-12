import { useState, useEffect, useCallback } from 'react';
import { listadosApi } from '../api/listados-api';
import type { DepartamentoConLineas, LineaProduccionConEstado } from '../types/listados.types';

interface UseLineasProduccionResult {
  departamentos: DepartamentoConLineas[];
  todasLasLineas: LineaProduccionConEstado[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para cargar el catálogo de departamentos y sus líneas de producción.
 * Usa GET /api/v1/departments (requiere departamento:ver).
 * Si el usuario no tiene ese permiso, el backend devuelve 403 y el hook
 * expone un array vacío sin romper la UI.
 */
export function useLineasProduccion(): UseLineasProduccionResult {
  const [departamentos, setDepartamentos] = useState<DepartamentoConLineas[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDepartamentos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await listadosApi.getDepartamentos();
      if (response.success && response.data) {
        // El backend devuelve un array directamente en data
        const data = Array.isArray(response.data) ? response.data : [];
        setDepartamentos(data);
      } else {
        setError(response.message || 'Error al obtener departamentos');
        setDepartamentos([]);
      }
    } catch (err: unknown) {
      // 403: usuario sin permiso departamento:ver — silencia error en UI, devuelve vacío
      const msg = err instanceof Error ? err.message : 'Error inesperado al cargar departamentos';
      setError(msg);
      setDepartamentos([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartamentos();
  }, [fetchDepartamentos]);

  // Aplanar todas las líneas de todos los departamentos
  const todasLasLineas: LineaProduccionConEstado[] = departamentos.flatMap(
    (d) => d.lineasProduccion,
  );

  return { departamentos, todasLasLineas, isLoading, error };
}
