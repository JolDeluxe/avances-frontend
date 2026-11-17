/**
 * use-vales.ts — Hook de estado, paginación y animaciones reactivas para Vales de Material
 *
 * Incluye:
 *   - Filtros sincronizados con URL (estado, serie, departamento, área, búsqueda, fechas, página)
 *   - Soporte para parámetros fijos por vista (scopeView, fixedEstado, fixedFechaDesde, fixedFechaHasta, customLimit)
 *   - Debounce de 350ms en el buscador
 *   - Suscripción automática a eventos SSE con actualización in-place y animaciones de parpadeo
 *     (amarillo al crear/editar/separar/retroceder, verde al entregar, morado al descontar)
 *     respetando los 2.2s de animación antes de refrescar la lista desde el servidor.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { valesApi } from '../api/vales-api';
import { useValesStreamListener } from '../context/vales-stream-context';
import type {
  AreaVale,
  ConteosPorAreaVale,
  ConteosPorEstadoVale,
  EstadoVale,
  ValeFilters,
  ValeItem,
} from '../types/vales.types';
import type { ValeEventoPayload } from '../types/vales-events.types';

const DEFAULT_CONTEOS_ESTADO: ConteosPorEstadoVale = {
  PENDIENTE: 0,
  SEPARADO: 0,
  ENTREGADO: 0,
  DESCONTADO: 0,
  CANCELADO: 0,
};

const DEFAULT_CONTEOS_AREA: ConteosPorAreaVale = {
  BOTA: 0,
  ACCESORIOS: 0,
  OTRO: 0,
};

export interface UseValesOptions {
  scopeView?: ValeFilters['scopeView'];
  customLimit?: number;
  fixedEstado?: EstadoVale | string;
  fixedFechaDesde?: string;
  fixedFechaHasta?: string;
}

export function useVales(
  scopeOrOptions?: ValeFilters['scopeView'] | UseValesOptions,
  defaultLimit = 500,
) {
  const opts: UseValesOptions =
    typeof scopeOrOptions === 'string' || scopeOrOptions === undefined
      ? { scopeView: scopeOrOptions, customLimit: defaultLimit }
      : scopeOrOptions;

  const effectiveScopeView = opts.scopeView;
  const effectiveLimit = Math.min(opts.customLimit ?? defaultLimit, 500);
  const fixedEstado = opts.fixedEstado;
  const fixedFechaDesde = opts.fixedFechaDesde;
  const fixedFechaHasta = opts.fixedFechaHasta;

  const [searchParams, setSearchParams] = useSearchParams();

  const [items, setItems] = useState<ValeItem[]>([]);
  const [conteosPorEstado, setConteosPorEstado] =
    useState<ConteosPorEstadoVale>(DEFAULT_CONTEOS_ESTADO);
  const [conteosPorArea, setConteosPorArea] =
    useState<ConteosPorAreaVale>(DEFAULT_CONTEOS_AREA);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: effectiveLimit,
    total: 0,
    totalPages: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Estados de animación de parpadeo (idénticos a Listados) ───────────────
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
    }, 2000);
  }, []);

  const triggerDescontando = useCallback((idOrIds: number | number[], onComplete?: () => void) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (ids.length === 0) return;
    setDescontandoIds((prev) => Array.from(new Set([...prev, ...ids])));
    setTimeout(() => {
      setDescontandoIds((prev) => prev.filter((item) => !ids.includes(item)));
      onComplete?.();
    }, 2000);
  }, []);

  // Parseo de URL params
  const pageParam = Number(searchParams.get('pagina')) || 1;
  const estadoParam = (searchParams.get('estado') as EstadoVale | string) || '';
  const serieParam = searchParams.get('serieId');
  const serieId = serieParam ? Number(serieParam) : '';
  const deptoParam = searchParams.get('departamentoValeId');
  const departamentoValeId = deptoParam ? Number(deptoParam) : '';
  const areaParam = (searchParams.get('area') as AreaVale) || '';
  const busquedaParam = searchParams.get('busqueda') || '';
  const fechaDesdeParam = searchParams.get('fechaDesde') || '';
  const fechaHastaParam = searchParams.get('fechaHasta') || '';

  // Estado local del input de búsqueda para debounce
  const [searchTerm, setSearchTerm] = useState(busquedaParam);

  useEffect(() => {
    setSearchTerm(busquedaParam);
  }, [busquedaParam]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== busquedaParam) {
        setSearchParams(
          (prev) => {
            if (searchTerm.trim()) {
              prev.set('busqueda', searchTerm.trim());
            } else {
              prev.delete('busqueda');
            }
            prev.set('pagina', '1');
            return prev;
          },
          { replace: true },
        );
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [searchTerm, busquedaParam, setSearchParams]);

  const fetchVales = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      setError(null);
      try {
        const filters: ValeFilters = {
          pagina: pageParam,
          limite: effectiveLimit,
          scopeView: effectiveScopeView,
        };
        const resolvedEstado = fixedEstado ?? estadoParam;
        const resolvedFechaDesde = fixedFechaDesde ?? fechaDesdeParam;
        const resolvedFechaHasta = fixedFechaHasta ?? fechaHastaParam;

        if (resolvedEstado) filters.estado = resolvedEstado;
        if (serieId) filters.serieId = serieId;
        if (departamentoValeId) filters.departamentoValeId = departamentoValeId;
        if (areaParam) filters.area = areaParam;
        if (busquedaParam) filters.busqueda = busquedaParam;
        if (resolvedFechaDesde) filters.fechaDesde = resolvedFechaDesde;
        if (resolvedFechaHasta) filters.fechaHasta = resolvedFechaHasta;

        const data = await valesApi.getVales(filters);
        setItems(data.items ?? []);
        setConteosPorEstado(data.conteosPorEstado ?? DEFAULT_CONTEOS_ESTADO);
        setConteosPorArea(data.conteosPorArea ?? DEFAULT_CONTEOS_AREA);
        setPagination({
          page: data.pagina ?? pageParam,
          limit: data.limite ?? effectiveLimit,
          total: data.total ?? 0,
          totalPages: data.totalPaginas ?? 0,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar los vales.');
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [
      pageParam,
      estadoParam,
      fixedEstado,
      serieId,
      departamentoValeId,
      areaParam,
      busquedaParam,
      fechaDesdeParam,
      fechaHastaParam,
      fixedFechaDesde,
      fixedFechaHasta,
      effectiveScopeView,
      effectiveLimit,
    ],
  );

  useEffect(() => {
    void fetchVales();
  }, [fetchVales]);

  const fetchRef = useRef(fetchVales);
  useEffect(() => {
    fetchRef.current = fetchVales;
  }, [fetchVales]);

  /**
   * Listener SSE:
   * - Actualiza in-place el estado del vale para que el ícono cambie de inmediato.
   * - Activa la animación correspondiente (amarillo, verde o morado).
   * - Si la transición es de entrega o descuento (que retira la fila de la vista actual),
   *   pospone el refetch silencioso 2000ms para que el parpadeo se vea completo.
   */
  const handleStreamEvent = useCallback(
    (evento: ValeEventoPayload) => {
      // 1. Evento masivo por lote
      if (evento.tipo === 'VALES_LOTE_OPERADO' && evento.valeIds && evento.valeIds.length > 0) {
        const loteIds = evento.valeIds;
        const nuevoEstado = evento.estadoNuevo;

        if (nuevoEstado) {
          setItems((prev) =>
            prev.map((item) =>
              loteIds.includes(item.id) ? { ...item, estado: nuevoEstado } : item,
            ),
          );
        }

        if (nuevoEstado === 'DESCONTADO') {
          triggerDescontando(loteIds, () => {
            void fetchRef.current(true);
          });
        } else if (nuevoEstado === 'ENTREGADO') {
          triggerEntregando(loteIds, () => {
            void fetchRef.current(true);
          });
        } else {
          triggerHighlight(loteIds);
          void fetchRef.current(true);
        }
        return;
      }

      // 2. Evento individual
      if (evento.valeId) {
        const id = evento.valeId;
        const nuevoEstado = evento.estadoNuevo;

        setItems((prev) => {
          const exists = prev.some((item) => item.id === id);
          if (!exists) return prev;

          return prev.map((item) => {
            if (item.id !== id) return item;
            return {
              ...item,
              estado: nuevoEstado ?? item.estado,
              folio: evento.folio ?? item.folio,
              area: evento.area ?? item.area,
              fechaSolicitud: evento.fechaSolicitud ?? item.fechaSolicitud,
              horaSolicitud:
                evento.horaSolicitud !== undefined ? evento.horaSolicitud : item.horaSolicitud,
              tieneHoraSolicitud:
                evento.tieneHoraSolicitud !== undefined
                  ? evento.tieneHoraSolicitud
                  : item.tieneHoraSolicitud,
              motivoCancelacion:
                evento.motivoCancelacion !== undefined
                  ? evento.motivoCancelacion
                  : item.motivoCancelacion,
              motivoRetroceso:
                evento.motivoRetroceso !== undefined
                  ? evento.motivoRetroceso
                  : item.motivoRetroceso,
              fechaSeparado:
                evento.fechaSeparado !== undefined ? evento.fechaSeparado : item.fechaSeparado,
              fechaEntregado:
                evento.fechaEntregado !== undefined ? evento.fechaEntregado : item.fechaEntregado,
              fechaDescontado:
                evento.fechaDescontado !== undefined
                  ? evento.fechaDescontado
                  : item.fechaDescontado,
              fechaRevertido:
                evento.fechaRevertido !== undefined ? evento.fechaRevertido : item.fechaRevertido,
              fechaCancelado:
                evento.fechaCancelado !== undefined ? evento.fechaCancelado : item.fechaCancelado,
              separadoPor:
                evento.separadoPor !== undefined ? evento.separadoPor : item.separadoPor,
              entregadoPor:
                evento.entregadoPor !== undefined ? evento.entregadoPor : item.entregadoPor,
              descontadoPor:
                evento.descontadoPor !== undefined ? evento.descontadoPor : item.descontadoPor,
              revertidoPor:
                evento.revertidoPor !== undefined ? evento.revertidoPor : item.revertidoPor,
              canceladoPor:
                evento.canceladoPor !== undefined ? evento.canceladoPor : item.canceladoPor,
            };
          });
        });

        if (evento.tipo === 'VALE_DESCONTADO' || nuevoEstado === 'DESCONTADO') {
          triggerDescontando(id, () => {
            void fetchRef.current(true);
          });
        } else if (
          evento.tipo === 'VALE_ENTREGADO' ||
          evento.tipo === 'VALE_SEPARADO_Y_ENTREGADO' ||
          nuevoEstado === 'ENTREGADO'
        ) {
          triggerEntregando(id, () => {
            void fetchRef.current(true);
          });
        } else {
          triggerHighlight(id);
          void fetchRef.current(true);
        }
        return;
      }

      void fetchRef.current(true);
    },
    [triggerHighlight, triggerEntregando, triggerDescontando],
  );

  useValesStreamListener(handleStreamEvent);

  const setFilter = useCallback(
    (
      key:
        | 'estado'
        | 'serieId'
        | 'departamentoValeId'
        | 'area'
        | 'fechaDesde'
        | 'fechaHasta',
      value: string | number | undefined,
    ) => {
      setSearchParams((prev) => {
        if (value) {
          prev.set(key, String(value));
        } else {
          prev.delete(key);
        }
        prev.set('pagina', '1');
        return prev;
      });
    },
    [setSearchParams],
  );

  const setEstado = useCallback(
    (nuevoEstado: EstadoVale | undefined) => {
      setFilter('estado', nuevoEstado);
    },
    [setFilter],
  );

  const setPage = useCallback(
    (newPage: number) => {
      setSearchParams((prev) => {
        prev.set('pagina', String(newPage));
        return prev;
      });
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setSearchParams({});
  }, [setSearchParams]);

  return {
    items,
    setItems,
    conteosPorEstado,
    conteosPorArea,
    pagination,
    isLoading,
    error,
    estado: (estadoParam || undefined) as EstadoVale | undefined,
    setEstado,
    searchTerm,
    setSearchTerm,
    filters: {
      estado: estadoParam,
      serieId,
      departamentoValeId,
      area: areaParam,
      searchTerm,
      fechaDesde: fechaDesdeParam,
      fechaHasta: fechaHastaParam,
    },
    setFilter,
    setPage,
    resetFilters,
    reload: fetchVales,
    // Estados y disparadores de animación de filas
    highlightedIds,
    entregandoIds,
    descontandoIds,
    triggerHighlight,
    triggerEntregando,
    triggerDescontando,
  };
}
