import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
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
 * Animaciones en tiempo real:
 *   - Destello amarillo (highlight) al registrar, crear o separar materiales.
 *   - Destello verde de entrega al entregar materiales a producción.
 *   - Destello morado de descuento al descontar materiales en sistema.
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

  // ─── Estados de animación de parpadeo reactivo (idéntico a Vales) ──────────
  const [highlightedIds, setHighlightedIds] = useState<number[]>([]);
  const [entregandoIds, setEntregandoIds] = useState<number[]>([]);
  const [descontandoIds, setDescontandoIds] = useState<number[]>([]);

  const triggerHighlight = useCallback((idOrIds: number | number[]) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (ids.length === 0) return;
    setHighlightedIds((prev) => Array.from(new Set([...prev, ...ids])));
    setTimeout(() => {
      setHighlightedIds((prev) => prev.filter((item) => !ids.includes(item)));
    }, 4500);
  }, []);

  const triggerEntregando = useCallback((idOrIds: number | number[], onComplete?: () => void) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (ids.length === 0) return;
    setEntregandoIds((prev) => Array.from(new Set([...prev, ...ids])));
    setTimeout(() => {
      setEntregandoIds((prev) => prev.filter((item) => !ids.includes(item)));
      onComplete?.();
    }, 2200);
  }, []);

  const triggerDescontando = useCallback((idOrIds: number | number[], onComplete?: () => void) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (ids.length === 0) return;
    setDescontandoIds((prev) => Array.from(new Set([...prev, ...ids])));
    setTimeout(() => {
      setDescontandoIds((prev) => prev.filter((item) => !ids.includes(item)));
      onComplete?.();
    }, 2200);
  }, []);

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

  const fetchRef = useRef(fetchListados);
  useEffect(() => {
    fetchRef.current = fetchListados;
  }, [fetchListados]);

  // Debounce para refetches en background tras recibir ráfagas de eventos SSE
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleFetch = useCallback(() => {
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => {
      void fetchRef.current(true);
    }, 120);
  }, []);

  // ─── Sincronización en Tiempo Real (SSE) ──────────────────────────────────
  useListadosStreamListener(
    useCallback(
      (evento: ListadoEventoPayload) => {
        // 1. Manejo de lotes operados masivamente (LOTE_TRANSICIONADO)
        if (evento.tipo === 'LOTE_TRANSICIONADO' && evento.idsAfectados && evento.idsAfectados.length > 0) {
          const ids = evento.idsAfectados;
          if (evento.estadoGlobal === 'DESCONTADO') {
            triggerDescontando(ids, () => scheduleFetch());
          } else if (evento.estadoGlobal === 'ENTREGADO_A_PRODUCCION') {
            triggerEntregando(ids, () => scheduleFetch());
          } else {
            triggerHighlight(ids);
            scheduleFetch();
          }
          return;
        }

        // 2. Creación de listado (LISTADO_CREADO): resalta y recarga la lista
        if (evento.tipo === 'LISTADO_CREADO' && evento.listadoId) {
          triggerHighlight(evento.listadoId);
          scheduleFetch();
          return;
        }

        // 3. Eventos individuales de frentes / estados
        if (evento.listadoId) {
          const id = evento.listadoId;

          // Actualización in-place inmediata para que los íconos/indicadores cambien al instante
          setItems((currentItems) => {
            const index = currentItems.findIndex((it) => it.id === id);
            if (index === -1) return currentItems;
            const existingItem = currentItems[index];

            const updatedFrentes = existingItem.frentes.map((frente) => {
              const matchingFrente = evento.frentes?.find((ef) => ef.tipoFrente === frente.tipoFrente);
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
              estado: evento.estadoGlobal ?? existingItem.estado,
              frentes: updatedFrentes,
              updatedAt: evento.timestamp,
              fechaActualizacion: evento.timestamp,
            };

            const nextItems = [...currentItems];
            nextItems[index] = updatedItem;
            return nextItems;
          });

          // Disparar animación de parpadeo según el avance de estado
          if (evento.tipo === 'FRENTE_DESCONTADO' || evento.estadoGlobal === 'DESCONTADO') {
            triggerDescontando(id, () => {
              scheduleFetch();
            });
          } else if (
            evento.tipo === 'FRENTE_ENTREGADO' ||
            evento.estadoGlobal === 'ENTREGADO_A_PRODUCCION'
          ) {
            triggerEntregando(id, () => {
              scheduleFetch();
            });
          } else {
            // FRENTE_SEPARADO, FRENTE_RETROCEDIDO, LISTADO_ACTUALIZADO
            triggerHighlight(id);
            scheduleFetch();
          }
          return;
        }

        scheduleFetch();
      },
      [scheduleFetch, triggerDescontando, triggerEntregando, triggerHighlight],
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
    (newPage: number) => {
      startTransition(() => {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('page', String(newPage));
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
  }, [setSearchParams]);

  return {
    // Datos
    items,
    setItems,
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

    // Animaciones y parpadeo reactivo
    highlightedIds,
    entregandoIds,
    descontandoIds,
    triggerHighlight,
    triggerEntregando,
    triggerDescontando,
  };
}
