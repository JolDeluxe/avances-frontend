import { useState, useEffect, useCallback, useMemo } from 'react';
import { lineasApi } from '../api/lineas-api';
import type {
  DepartamentoWithLineas,
  LineaProduccionItem,
  LineaFilters,
  CreateLineaInput,
  UpdateLineaInput,
} from '../types/lineas.types';

export function useLineas() {
  const [departamentos, setDepartamentos] = useState<DepartamentoWithLineas[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<LineaFilters>({
    busqueda: '',
    departamentoId: 'TODOS',
    area: 'TODOS',
    estado: 'TODOS',
  });

  const fetchDepartamentos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await lineasApi.getDepartamentosWithLineas(true);
      if (res.success && res.data) {
        setDepartamentos(res.data);
      } else {
        setError(res.message || 'Error al consultar departamentos y líneas.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado de conexión con el servidor.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartamentos();
  }, [fetchDepartamentos]);

  // Aplanar todas las líneas agregando contexto del departamento
  const allLines = useMemo(() => {
    const lines: LineaProduccionItem[] = [];
    for (const depto of departamentos) {
      if (depto.lineasProduccion && Array.isArray(depto.lineasProduccion)) {
        for (const lin of depto.lineasProduccion) {
          lines.push({
            ...lin,
            departamentoId: depto.id,
            departamentoNombre: depto.nombre,
            departamentoCodigo: depto.codigo,
          });
        }
      }
    }
    // Ordenar alfabéticamente por código
    return lines.sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [departamentos]);

  // Métricas y conteos
  const metrics = useMemo(() => {
    const total = allLines.length;
    const activas = allLines.filter((l) => l.estado === 'ACTIVO').length;
    const inactivas = allLines.filter((l) => l.estado === 'INACTIVO').length;
    const bota = allLines.filter((l) => l.area === 'BOTA').length;
    const accesorios = allLines.filter((l) => l.area === 'ACCESORIOS').length;
    return { total, activas, inactivas, bota, accesorios };
  }, [allLines]);

  // Filtrado reactivo en cliente
  const filteredLines = useMemo(() => {
    return allLines.filter((line) => {
      // Filtro de búsqueda por texto
      if (filters.busqueda && filters.busqueda.trim() !== '') {
        const query = filters.busqueda.toLowerCase().trim();
        const matchCodigo = line.codigo.toLowerCase().includes(query);
        const matchNombre = line.nombre.toLowerCase().includes(query);
        const matchDepto = (line.departamentoNombre || '').toLowerCase().includes(query);
        if (!matchCodigo && !matchNombre && !matchDepto) return false;
      }

      // Filtro por departamento
      if (filters.departamentoId !== 'TODOS' && filters.departamentoId !== undefined) {
        if (line.departamentoId !== filters.departamentoId) return false;
      }

      // Filtro por área
      if (filters.area !== 'TODOS' && filters.area !== undefined) {
        if (line.area !== filters.area) return false;
      }

      // Filtro por estado
      if (filters.estado !== 'TODOS' && filters.estado !== undefined) {
        if (line.estado !== filters.estado) return false;
      }

      return true;
    });
  }, [allLines, filters]);

  const updateFilters = (newFilters: Partial<LineaFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters({
      busqueda: '',
      departamentoId: 'TODOS',
      area: 'TODOS',
      estado: 'TODOS',
    });
  };

  const createLinea = async (input: CreateLineaInput) => {
    const res = await lineasApi.createLinea(input.departamentoId, {
      codigo: input.codigo,
      nombre: input.nombre,
      area: input.area,
    });
    if (res.success) {
      await fetchDepartamentos();
    }
    return res;
  };

  const updateLinea = async (lineId: number, input: UpdateLineaInput) => {
    const res = await lineasApi.updateLinea(lineId, input);
    if (res.success) {
      await fetchDepartamentos();
    }
    return res;
  };

  const deleteLinea = async (lineId: number) => {
    const res = await lineasApi.deleteLinea(lineId);
    if (res.success) {
      await fetchDepartamentos();
    }
    return res;
  };

  const reactivateLinea = async (lineId: number) => {
    const res = await lineasApi.reactivateLinea(lineId);
    if (res.success) {
      await fetchDepartamentos();
    }
    return res;
  };

  const reorderLineas = async (items: Array<{ id: number; orden: number }>) => {
    // Actualización optimista local
    const ordenMap = new Map(items.map((i) => [i.id, i.orden]));
    setDepartamentos((prev) =>
      prev.map((d) => ({
        ...d,
        lineasProduccion: d.lineasProduccion
          .map((l) => (ordenMap.has(l.id) ? { ...l, orden: ordenMap.get(l.id)! } : l))
          .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.id - b.id),
      })),
    );

    const res = await lineasApi.reorderLineas(items);
    if (!res.success) {
      // Revertir en caso de error
      await fetchDepartamentos();
    }
    return res;
  };

  return {
    departamentos,
    allLines,
    filteredLines,
    metrics,
    filters,
    isLoading,
    error,
    updateFilters,
    resetFilters,
    createLinea,
    updateLinea,
    deleteLinea,
    reactivateLinea,
    reorderLineas,
    refresh: fetchDepartamentos,
  };
}
