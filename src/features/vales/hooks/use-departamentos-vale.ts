/**
 * use-departamentos-vale.ts — Hook para cargar catálogos operativos de Vales (Series, Departamentos y Áreas)
 */

import { useState, useEffect, useCallback } from 'react';
import { valesApi } from '../api/vales-api';
import type { AreaVale, DepartamentoValeRef, SerieValeRef } from '../types/vales.types';

export function useDepartamentosVale() {
  const [series, setSeries] = useState<SerieValeRef[]>([]);
  const [departamentosVale, setDepartamentosVale] = useState<DepartamentoValeRef[]>([]);
  const [areas, setAreas] = useState<AreaVale[]>(['BOTA', 'ACCESORIOS', 'OTRO']);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalogos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await valesApi.getCatalogos();
      setSeries(data.series ?? []);
      setDepartamentosVale(data.departamentosVale ?? []);
      if (data.areas?.length) {
        setAreas(data.areas);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar catálogos de vales.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCatalogos();
  }, [fetchCatalogos]);

  return {
    series,
    departamentosVale,
    areas,
    isLoading,
    error,
    reloadCatalogos: fetchCatalogos,
  };
}
