import { useState, useEffect, useCallback, useTransition } from 'react';
import { useSearchParams } from 'react-router';
import { listadosApi } from '../api/listados-api';
import { useListadosStreamListener } from '../context/listados-stream-context';
import type { ListadoEventoPayload } from '../types/listados-events.types';
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
  fixedFechaDesde?: string;
  fixedFechaHasta?: string;
  customLimit?: number;
  modoGlobal?: boolean;
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
  const fechaDesde = options?.fixedFechaDesde ?? (searchParams.get('fechaDesde') || undefined);
  const fechaHasta = options?.fixedFechaHasta ?? (searchParams.get('fechaHasta') || undefined);
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

  const fetchListados = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setIsLoading(true);
    }
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
        modoGlobal: options?.modoGlobal,
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
      if (!silencioso) {
        setIsLoading(false);
      }
    }
  }, [estado, excludeEstado, lineaProduccionId, departamentoId, numeroListado, fechaDesde, fechaHasta, page, options?.customLimit, options?.modoGlobal]);

  useEffect(() => {
    fetchListados();
  }, [fetchListados]);

  // ─── Sincronización en Tiempo Real (SSE) ──────────────────────────────────
  useListadosStreamListener(
    useCallback(
      (evento: ListadoEventoPayload) => {
        // 1. Si el evento afecta a un ítem actualmente visible en la lista
        setItems((currentItems) => {
          const index = currentItems.findIndex((it) => it.id === evento.listadoId);
          if (index !== -1) {
            // El listado está en la vista: actualizar in-place
            const existingItem = currentItems[index];

            // Si hay filtro de estado activo y el nuevo estadoGlobal no encaja con el filtro:
            if (estado) {
              const estadosPermitidos = estado.split(',').map((s) => s.trim());
              if (!estadosPermitidos.includes(evento.estadoGlobal)) {
                // Programar recarga y remoción con un breve delay (2200ms) para permitir
                // que las animaciones visuales (verde de entrega / morado de descuento) completen
                setTimeout(() => {
                  fetchListados(true);
                  setItems((prev) => prev.filter((it) => it.id !== evento.listadoId));
                }, 2200);
              }
            }

            // Si hay excludeEstado y el nuevo estado coincide con excludeEstado:
            if (excludeEstado && evento.estadoGlobal === excludeEstado) {
              setTimeout(() => {
                fetchListados(true);
                setItems((prev) => prev.filter((it) => it.id !== evento.listadoId));
              }, 2200);
            }

            // Actualizar frentes y estado global del ítem
            const updatedFrentes = existingItem.frentes.map((frente) => {
              const matchingFrente = evento.frentes.find((ef) => ef.tipoFrente === frente.tipoFrente);
              if (matchingFrente) {
                return {
                  ...frente,
                  estado: matchingFrente.estado,
                };
              }
              return frente;
            });

            const updatedItem: ListadoItem = {
              ...existingItem,
              estado: evento.estadoGlobal,
              frentes: updatedFrentes,
              updatedAt: evento.timestamp,
              fechaActualizacion: evento.timestamp,
            };

            const nextItems = [...currentItems];
            nextItems[index] = updatedItem;
            return nextItems;
          }

          // 2. Si es una creación (LISTADO_CREADO) o lote de transiciones donde el listado no estaba visible
          // Si califica para la vista actual (departamento, línea, estado), refrescar en segundo plano sin congelar UI
          if (evento.tipo === 'LISTADO_CREADO' || evento.tipo === 'LOTE_TRANSICIONADO') {
            fetchListados(true);
          }

          return currentItems;
        });
      },
      [estado, excludeEstado, fetchListados],
    ),
  );

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
