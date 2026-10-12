import { useState, useEffect, useCallback, useTransition } from 'react';
import { useSearchParams } from 'react-router';
import { listadosApi } from '../api/listados-api';
import type {
  ListadoItem,
  ListadoFilters,
  EstadoListado,
  PaginationMeta,
} from '../types/listados.types';

const DEFAULT_PAGINATION: PaginationMeta = {
  page: 1,
  limit: 60,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

/**
 * Hook principal del módulo de Listados.
 *
 * Sincroniza filtros y paginación con URL params (patrón del módulo de usuarios).
 * El filtro de búsqueda aplica debounce de 350ms para no saturar el backend.
 *
 * Paginación: usa las claves reales del backend: page / limit / total / totalPages.
 */
interface UseListadosOptions {
  fixedEstado?: EstadoListado | string;
  excludeEstado?: EstadoListado;
  customLimit?: number;
}

export function useListados(options?: UseListadosOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [, startTransition] = useTransition();

  const [items, setItems] = useState<ListadoItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(DEFAULT_PAGINATION);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Leer estado desde URL o fixedEstado ──────────────────────────────────

  const estado = options?.fixedEstado ?? ((searchParams.get('estado') as EstadoListado | string) || undefined);
  const excludeEstado = options?.excludeEstado;
  const lineaProduccionId = searchParams.get('lineaProduccionId')
    ? Number(searchParams.get('lineaProduccionId'))
    : undefined;
  const departamentoId = searchParams.get('departamentoId')
    ? Number(searchParams.get('departamentoId'))
    : undefined;
  const numeroListado = searchParams.get('numeroListado') || '';
  const fechaDesde = searchParams.get('fechaDesde') || undefined;
  const fechaHasta = searchParams.get('fechaHasta') || undefined;
  const page = searchParams.get('page') ? Math.max(1, Number(searchParams.get('page'))) : 1;

  // ─── Búsqueda local con debounce ─────────────────────────────────────────

  const [searchTerm, setSearchTerm] = useState<string>(numeroListado);

  // Sincronizar searchTerm con URL si la URL cambia externamente
  useEffect(() => {
    setSearchTerm(numeroListado);
  }, [numeroListado]);

  // Debounce: actualizar URL solo cuando el usuario deja de escribir
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== numeroListado) {
        startTransition(() => {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (searchTerm.trim()) {
              next.set('numeroListado', searchTerm.trim());
            } else {
              next.delete('numeroListado');
            }
            next.set('page', '1');
            return next;
          });
        });
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [searchTerm, numeroListado, setSearchParams]);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchListados = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters: ListadoFilters = {
        estado,
        lineaProduccionId,
        departamentoId,
        numeroListado: numeroListado || undefined,
        fechaDesde,
        fechaHasta,
        page,
        limit: options?.customLimit ?? 60,
      };

      const response = await listadosApi.getListados(filters);
      if (response.success && response.data) {
        let loadedItems = response.data.items ?? [];
        let loadedPagination = response.data.pagination ?? DEFAULT_PAGINATION;

        // Si se configuró excludeEstado (ej: excluir CANCELADO en vista general) y no hay filtro de estado explícito
        if (excludeEstado && !estado) {
          loadedItems = loadedItems.filter((it) => it.estado !== excludeEstado);
        }

        setItems(loadedItems);
        setPagination(loadedPagination);
      } else {
        setError(response.message || 'Error al obtener listados');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al cargar listados';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [estado, excludeEstado, lineaProduccionId, departamentoId, numeroListado, fechaDesde, fechaHasta, page, options?.customLimit]);

  useEffect(() => {
    fetchListados();
  }, [fetchListados]);

  // ─── Mutadores de URL ─────────────────────────────────────────────────────

  const setEstado = useCallback(
    (nuevoEstado?: EstadoListado) => {
      startTransition(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (nuevoEstado) {
            next.set('estado', nuevoEstado);
          } else {
            next.delete('estado');
          }
          next.set('page', '1');
          return next;
        });
      });
    },
    [setSearchParams],
  );

  const setLineaProduccionId = useCallback(
    (id?: number) => {
      startTransition(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (id) {
            next.set('lineaProduccionId', String(id));
          } else {
            next.delete('lineaProduccionId');
          }
          next.set('page', '1');
          return next;
        });
      });
    },
    [setSearchParams],
  );

  const setDepartamentoId = useCallback(
    (id?: number) => {
      startTransition(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (id) {
            next.set('departamentoId', String(id));
          } else {
            next.delete('departamentoId');
          }
          next.set('page', '1');
          return next;
        });
      });
    },
    [setSearchParams],
  );

  const setFechaDesde = useCallback(
    (fecha?: string) => {
      startTransition(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (fecha) {
            next.set('fechaDesde', fecha);
          } else {
            next.delete('fechaDesde');
          }
          next.set('page', '1');
          return next;
        });
      });
    },
    [setSearchParams],
  );

  const setFechaHasta = useCallback(
    (fecha?: string) => {
      startTransition(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (fecha) {
            next.set('fechaHasta', fecha);
          } else {
            next.delete('fechaHasta');
          }
          next.set('page', '1');
          return next;
        });
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (nuevaPagina: number) => {
      startTransition(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('page', String(nuevaPagina));
          return next;
        });
      });
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    startTransition(() => {
      setSearchParams(new URLSearchParams());
    });
    setSearchTerm('');
  }, [setSearchParams]);

  return {
    // Datos
    items,
    pagination,
    isLoading,
    error,
    reloadListados: fetchListados,

    // Filtros actuales
    estado,
    lineaProduccionId,
    departamentoId,
    searchTerm,
    setSearchTerm,
    fechaDesde,
    fechaHasta,
    page,

    // Mutadores
    setEstado,
    setLineaProduccionId,
    setDepartamentoId,
    setFechaDesde,
    setFechaHasta,
    setPage,
    resetFilters,
  };
}
