import { useState, useEffect, useCallback } from 'react';
import { usersApi } from '../api/users-api';
import type { UserCatalogs } from '../types/users.types';

export function useUserCatalogs() {
  const [catalogs, setCatalogs] = useState<UserCatalogs | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCatalogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await usersApi.getCatalogs();
      if (response.success && response.data) {
        setCatalogs(response.data);
      } else {
        setError(response.message || 'Error al cargar catálogos de usuarios');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al cargar catálogos';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogs();
  }, [fetchCatalogs]);

  return {
    catalogs,
    roles: catalogs?.roles || [],
    departamentos: catalogs?.departamentos || [],
    permisos: catalogs?.permisos || [],
    isLoading,
    error,
    reloadCatalogs: fetchCatalogs,
  };
}
