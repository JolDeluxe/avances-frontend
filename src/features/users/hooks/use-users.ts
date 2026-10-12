import { useState, useEffect, useCallback, useTransition } from 'react';
import { useSearchParams } from 'react-router';
import { usersApi } from '../api/users-api';
import type { UsersListResponse, UserFilters, EstadoUsuario } from '../types/users.types';

export function useUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [, startTransition] = useTransition();

  const [data, setData] = useState<UsersListResponse>({
    total: 0,
    pagina: 1,
    limite: 50,
    totalPaginas: 1,
    items: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Read state from URL
  const busqueda = searchParams.get('busqueda') || '';
  const rolId = searchParams.get('rolId') ? Number(searchParams.get('rolId')) : undefined;
  const departamentoId = searchParams.get('departamentoId')
    ? Number(searchParams.get('departamentoId'))
    : undefined;
  const estado: EstadoUsuario =
    (searchParams.get('estado') as EstadoUsuario) === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO';
  const pagina = searchParams.get('pagina') ? Math.max(1, Number(searchParams.get('pagina'))) : 1;
  const limite = searchParams.get('limite') ? Number(searchParams.get('limite')) : 50;

  // Local search text for smooth typing before debounce
  const [searchTerm, setSearchTerm] = useState<string>(busqueda);

  // Sync searchTerm with URL if URL changes externally
  useEffect(() => {
    setSearchTerm(busqueda);
  }, [busqueda]);

  // Debounce search update to URL
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== busqueda) {
        startTransition(() => {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (searchTerm.trim()) {
              next.set('busqueda', searchTerm.trim());
            } else {
              next.delete('busqueda');
            }
            next.set('pagina', '1');
            return next;
          });
        });
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [searchTerm, busqueda, setSearchParams]);

  // Fetch users whenever filters change
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: UserFilters = {
        busqueda: busqueda || undefined,
        rolId,
        departamentoId,
        estado,
        pagina,
        limite,
      };

      const response = await usersApi.getUsers(filters);
      if (response.success && response.data) {
        setData(response.data);
      } else {
        setError(response.message || 'Error al obtener usuarios');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al cargar usuarios';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [busqueda, rolId, departamentoId, estado, pagina, limite]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // URL State Mutators
  const setEstado = useCallback(
    (nuevoEstado: EstadoUsuario) => {
      startTransition(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('estado', nuevoEstado);
          next.set('pagina', '1');
          return next;
        });
      });
    },
    [setSearchParams],
  );

  const setRolId = useCallback(
    (nuevoRolId?: number) => {
      startTransition(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (nuevoRolId) {
            next.set('rolId', String(nuevoRolId));
          } else {
            next.delete('rolId');
          }
          next.set('pagina', '1');
          return next;
        });
      });
    },
    [setSearchParams],
  );

  const setDepartamentoId = useCallback(
    (nuevoDeptoId?: number) => {
      startTransition(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (nuevoDeptoId) {
            next.set('departamentoId', String(nuevoDeptoId));
          } else {
            next.delete('departamentoId');
          }
          next.set('pagina', '1');
          return next;
        });
      });
    },
    [setSearchParams],
  );

  const setPagina = useCallback(
    (nuevaPagina: number) => {
      startTransition(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('pagina', String(nuevaPagina));
          return next;
        });
      });
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    startTransition(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams();
        const curEstado = prev.get('estado');
        if (curEstado) next.set('estado', curEstado);
        return next;
      });
    });
    setSearchTerm('');
  }, [setSearchParams]);

  return {
    users: data.items,
    total: data.total,
    pagina: data.pagina,
    limite: data.limite,
    totalPaginas: data.totalPaginas,
    statsPorRol: data.statsPorRol,
    isLoading,
    error,
    reloadUsers: fetchUsers,
    // Filters and controls
    searchTerm,
    setSearchTerm,
    estado,
    setEstado,
    rolId,
    setRolId,
    departamentoId,
    setDepartamentoId,
    setPagina,
    resetFilters,
  };
}
