import { useState, useMemo, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { useListados } from '../../hooks/use-listados';
import { useLineasProduccion } from '../../hooks/use-lineas-produccion';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ListadosPendientesParalelaTable } from '../../components/listados-pendientes-paralela-table';
import { ListadoDetailModal } from '../../components/listado-detail-modal';
import { ListadoTransitionModal, type TransitionAction } from '../../components/listado-transition-modal';
import { ListadoAccionModal, type AccionOperativaAlmacen } from '../../components/listado-accion-modal';
import { ListadoBatchAccionModal, type BatchAccionOperativa } from '../../components/listado-batch-accion-modal';
import { Button } from '@/components/ui/button';
import { listadosApi } from '../../api/listados-api';
import { clasificarListadosPorArea } from '../../utils/classify-listados';
import { TIPO_FRENTE_CONFIG } from '@/config/status-config';
import type { ListadoItem, TipoFrenteMaterial } from '../../types/listados.types';

/**
 * Formatea una fecha ISO/YYYY-MM-DD → dd/mm/aaaa sin UTC shift.
 */
function formatFecha(fechaStr: string): string {
  const solo = fechaStr.includes('T') ? fechaStr.slice(0, 10) : fechaStr;
  const [year, month, day] = solo.split('-');
  if (!year || !month || !day) return fechaStr;
  return `${day}/${month}/${year}`;
}

/**
 * Submódulo ALMACÉN de Listados.
 *
 * Tablero Operativo de Piso exclusivo para Almacenistas dividido en dos bloques paralelos:
 * - BOTA (Izquierda): NO | LISTADO | Fecha Req. | Estado | Línea | DIR | IND | Acciones
 * - ACCESORIOS (Derecha): NO | LISTADO | Fecha Req. | Estado | Línea | DIR | IND | BOL | Acciones
 */
export function ListadosAlmacenPage(): ReactNode {
  const { user, hasPermission, isSuperAdmin, isAdmin } = usePermissions();
  const canVer = hasPermission('listado:ver');
  const canSeparar = hasPermission('listado:separar');
  const canEntregar = hasPermission('listado:entregar');
  const canRetroceder = (isSuperAdmin || isAdmin) && hasPermission('listado:retroceder');
  const canCancelar = hasPermission('listado:cancelar');

  const {
    items,
    pagination,
    isLoading,
    error,
    reloadListados,
    setPage,
  } = useListados({ fixedEstado: 'PENDIENTE,EN_PROCESO' });

  const { todasLasLineas } = useLineasProduccion();

  // ─── Frentes Operativos según perfil (Almacén) ─────────────────────────────
  const operativeFrentes = useMemo(() => {
    if (isSuperAdmin || isAdmin) return null;
    if (!user?.tipoSurtidoAlmacen || user.tipoSurtidoAlmacen === 'TODOS') return null;
    const parts = user.tipoSurtidoAlmacen.split(',').map((p) => p.trim().toUpperCase());
    const valid = parts.filter(
      (p): p is TipoFrenteMaterial => p === 'DIRECTOS' || p === 'INDIRECTOS' || p === 'BOLSAS',
    );
    return valid.length > 0 ? valid : null;
  }, [isSuperAdmin, isAdmin, user?.tipoSurtidoAlmacen]);

  // ─── Desactivación / Atenuación visual de bloques por línea asignada ────────
  const { isBotaDisabled, isAccesoriosDisabled } = useMemo(() => {
    if (isSuperAdmin || isAdmin) {
      return { isBotaDisabled: false, isAccesoriosDisabled: false };
    }
    const lineas = user?.lineasAsignadas ?? [];
    if (lineas.length === 0) {
      return { isBotaDisabled: false, isAccesoriosDisabled: false };
    }
    const hasBota = lineas.some((l) => l.area === 'BOTA');
    const hasAccesorios = lineas.some((l) => l.area === 'ACCESORIOS');
    return {
      isBotaDisabled: !hasBota,
      isAccesoriosDisabled: !hasAccesorios,
    };
  }, [isSuperAdmin, isAdmin, user?.lineasAsignadas]);

  // ─── Estado de modales y feedback ──────────────────────────────────────────
  const [selectedListado, setSelectedListado] = useState<ListadoItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isTransitionOpen, setIsTransitionOpen] = useState<boolean>(false);
  const [transitionAction, setTransitionAction] = useState<TransitionAction>('retroceder');
  const [transitionTipoFrente, setTransitionTipoFrente] = useState<TipoFrenteMaterial | undefined>(undefined);
  const [mutatingRows, setMutatingRows] = useState<Record<number, string | null>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [highlightedListadoId, setHighlightedListadoId] = useState<number | number[] | null>(null);
  const [entregandoListadoId, setEntregandoListadoId] = useState<number | number[] | null>(null);
  const [entregandoFrente, setEntregandoFrente] = useState<TipoFrenteMaterial | null>(null);

  const triggerHighlight = (id: number | number[]) => {
    setHighlightedListadoId(id);
    // El destello en amarillo se desvanece suavemente a los 4.5 segundos
    setTimeout(() => {
      setHighlightedListadoId((curr) => {
        if (Array.isArray(id) && Array.isArray(curr)) {
          return curr.filter((i) => !id.includes(i));
        }
        return curr === id ? null : curr;
      });
    }, 4500);
  };

  // ─── Selección Múltiple y Operaciones Masivas (Batch) ────────────────────
  const [selectedBotaIds, setSelectedBotaIds] = useState<number[]>([]);
  const [selectedAccesoriosIds, setSelectedAccesoriosIds] = useState<number[]>([]);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState<boolean>(false);
  const [batchModal, setBatchModal] = useState<{
    isOpen: boolean;
    area: 'BOTA' | 'ACCESORIOS';
    accion: BatchAccionOperativa;
    tipoFrente: TipoFrenteMaterial;
  }>({
    isOpen: false,
    area: 'BOTA',
    accion: 'separar',
    tipoFrente: 'DIRECTOS',
  });

  const handleToggleSelectBota = (id: number) => {
    setSelectedBotaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleToggleSelectAccesorios = (id: number) => {
    setSelectedAccesoriosIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Modal operativo de Almacén (Separar / Entregar con checkbox condicional)
  const [modalAccion, setModalAccion] = useState<{
    isOpen: boolean;
    listado: ListadoItem | null;
    tipoFrente: TipoFrenteMaterial;
    accion: AccionOperativaAlmacen;
  }>({
    isOpen: false,
    listado: null,
    tipoFrente: 'DIRECTOS',
    accion: 'separar',
  });

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const [shouldReopenDetailOnTransitionClose, setShouldReopenDetailOnTransitionClose] = useState<boolean>(false);

  const handleOpenDetail = (listado: ListadoItem) => {
    setSelectedListado(listado);
    setIsDetailOpen(true);
  };

  const handleOpenRetrocederFrente = (listado: ListadoItem, tipoFrente?: TipoFrenteMaterial, fromDetail = false) => {
    setSelectedListado(listado);
    setTransitionTipoFrente(tipoFrente);
    setTransitionAction('retroceder');
    setShouldReopenDetailOnTransitionClose(fromDetail);
    setIsTransitionOpen(true);
  };

  const handleOpenCancelarListado = (listado: ListadoItem) => {
    setSelectedListado(listado);
    setTransitionTipoFrente(undefined);
    setTransitionAction('cancelar');
    setIsTransitionOpen(true);
  };

  // Apertura de modal de confirmación en vez de ejecución directa
  const handleRequestSepararFrente = (listado: ListadoItem, tipoFrente: TipoFrenteMaterial) => {
    setModalAccion({
      isOpen: true,
      listado,
      tipoFrente,
      accion: 'separar',
    });
  };

  const handleRequestEntregarFrente = (listado: ListadoItem, tipoFrente: TipoFrenteMaterial) => {
    setModalAccion({
      isOpen: true,
      listado,
      tipoFrente,
      accion: 'entregar',
    });
  };

  // Confirmación desde el modal
  const handleConfirmAccionOperativa = async ({ entregarTambien }: { entregarTambien?: boolean }) => {
    const { listado, tipoFrente, accion } = modalAccion;
    if (!listado) return;

    setMutatingRows((prev) => ({ ...prev, [listado.id]: accion }));
    try {
      if (accion === 'separar') {
        const resSeparar = await listadosApi.separar(listado.id, tipoFrente);
        if (!resSeparar.success) {
          showFeedback('error', resSeparar.message || 'Error al separar el frente.');
          return;
        }

        if (entregarTambien) {
          const resEntregar = await listadosApi.entregar(listado.id, tipoFrente);
          if (!resEntregar.success) {
            showFeedback(
              'error',
              `Se separaron los materiales, pero ocurrió un error al entregarlos: ${resEntregar.message || 'Error al entregar.'}`,
            );
          } else {
            showFeedback(
              'success',
              `${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente} de listado ${listado.numeroListado} separado y entregado a producción inmediatamente.`,
            );
          }
        } else {
          showFeedback(
            'success',
            `${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente} de listado ${listado.numeroListado} separado correctamente.`,
          );
        }
      } else {
        // accion === 'entregar'
        const res = await listadosApi.entregar(listado.id, tipoFrente);
        if (res.success) {
          showFeedback(
            'success',
            `${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente} de listado ${listado.numeroListado} entregado a producción.`,
          );
        } else {
          showFeedback('error', res.message || 'Error al entregar.');
        }
      }

      setModalAccion((prev) => ({ ...prev, isOpen: false }));

      const isEntrega = accion === 'entregar' || Boolean(entregarTambien);
      if (isEntrega) {
        // La fila parpadea en verde y se desvanece suavemente antes de desaparecer de la lista
        // Además actualiza de inmediato el indicador del frente entregado a ENTREGADO (🟡 ✔️)
        setEntregandoListadoId(listado.id);
        setEntregandoFrente(tipoFrente);
        setTimeout(() => {
          setEntregandoListadoId((curr) => (curr === listado.id ? null : curr));
          setEntregandoFrente((curr) => (curr === tipoFrente ? null : curr));
          reloadListados();
        }, 2000);
      } else {
        triggerHighlight(listado.id);
        reloadListados();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al ejecutar la acción.';
      showFeedback('error', msg);
      reloadListados();
    } finally {
      setMutatingRows((prev) => ({ ...prev, [listado.id]: null }));
    }
  };

  // ─── Regla de Negocio PENDIENTES ──────────────────────────────────────────
  // En PENDIENTES solo se ven hasta que TODOS los frentes operativos del usuario
  // hayan sido entregados a producción. Si el almacenista terminó sus frentes,
  // el listado desaparece de su vista para evitar confusiones.
  // IMPORTANTE: Si el listado se encuentra en animación de entrega (entregandoListadoId),
  // se conserva visible temporalmente para que parpadee en verde y se desvanezca antes de retirarse.
  const itemsPendientes = useMemo(() => {
    return items.filter((item) => {
      const isCurrentlyEntregando = Array.isArray(entregandoListadoId)
        ? entregandoListadoId.includes(item.id)
        : entregandoListadoId === item.id;

      if (isCurrentlyEntregando) {
        return true;
      }

      if (item.estado === 'CANCELADO' || item.estado === 'ENTREGADO_A_PRODUCCION' || item.estado === 'DESCONTADO') {
        return false;
      }
      if (item.frentes && item.frentes.length > 0) {
        // Si el usuario tiene frentes operativos restringidos (ej. Almacenista sólo DIRECTOS):
        if (operativeFrentes && operativeFrentes.length > 0) {
          const misFrentes = item.frentes.filter((f) => operativeFrentes.includes(f.tipoFrente));
          // Si el listado no involucra ninguno de mis frentes, no me pertenece
          if (misFrentes.length === 0) return false;
          // Permanece en PENDIENTES solo si al menos uno de MIS frentes está en PENDIENTE o SEPARADO
          return misFrentes.some((f) => f.estado === 'PENDIENTE' || f.estado === 'SEPARADO');
        }

        // Para usuarios globales (admin) o con TODOS los frentes:
        return item.frentes.some((f) => f.estado === 'PENDIENTE' || f.estado === 'SEPARADO');
      }
      return item.estado === 'PENDIENTE' || item.estado === 'EN_PROCESO';
    });
  }, [items, operativeFrentes, entregandoListadoId]);

  // Clasificación dinámica de registros en BOTA y ACCESORIOS desde el catálogo del backend
  const { botaItems, accesoriosItems, noClasificados } = useMemo(() => {
    return clasificarListadosPorArea(itemsPendientes, todasLasLineas);
  }, [itemsPendientes, todasLasLineas]);

  // Ítems seleccionados completos
  const selectedBotaListados = useMemo(() => {
    return botaItems.filter((item) => selectedBotaIds.includes(item.id));
  }, [botaItems, selectedBotaIds]);

  const selectedAccesoriosListados = useMemo(() => {
    return accesoriosItems.filter((item) => selectedAccesoriosIds.includes(item.id));
  }, [accesoriosItems, selectedAccesoriosIds]);

  // Conteo de elegibilidad dinámica para las barras de lote
  const botaEligibles = useMemo(() => {
    const frentesToCheck = operativeFrentes ?? (['DIRECTOS', 'INDIRECTOS'] as TipoFrenteMaterial[]);
    let canSepararCount = 0;
    let canEntregarCount = 0;

    selectedBotaListados.forEach((item) => {
      const frentes = (item.frentes ?? []).filter((f) => frentesToCheck.includes(f.tipoFrente));
      if (frentes.some((f) => f.estado === 'PENDIENTE')) {
        canSepararCount++;
      }
      if (frentes.some((f) => f.estado === 'SEPARADO')) {
        canEntregarCount++;
      }
    });

    return { canSepararCount, canEntregarCount };
  }, [selectedBotaListados, operativeFrentes]);

  const accesoriosEligibles = useMemo(() => {
    const frentesToCheck = operativeFrentes ?? (['DIRECTOS', 'INDIRECTOS', 'BOLSAS'] as TipoFrenteMaterial[]);
    let canSepararCount = 0;
    let canEntregarCount = 0;

    selectedAccesoriosListados.forEach((item) => {
      const frentes = (item.frentes ?? []).filter((f) => frentesToCheck.includes(f.tipoFrente));
      if (frentes.some((f) => f.estado === 'PENDIENTE')) {
        canSepararCount++;
      }
      if (frentes.some((f) => f.estado === 'SEPARADO')) {
        canEntregarCount++;
      }
    });

    return { canSepararCount, canEntregarCount };
  }, [selectedAccesoriosListados, operativeFrentes]);

  // Handler de confirmación del modal masivo
  const handleConfirmBatchAccion = async ({
    tipoFrente,
    entregarTambien,
    motivo,
  }: {
    tipoFrente: TipoFrenteMaterial;
    entregarTambien?: boolean;
    motivo?: string;
  }) => {
    const { area, accion } = batchModal;
    const selectedListados = area === 'BOTA' ? selectedBotaListados : selectedAccesoriosListados;

    // Filtrar solo los que realmente son elegibles para la acción solicitada
    const listadosElegibles = selectedListados.filter((item) => {
      const f = item.frentes?.find((fr) => fr.tipoFrente === tipoFrente);
      if (!f) return false;
      if (accion === 'separar') return f.estado === 'PENDIENTE';
      if (accion === 'entregar') return f.estado === 'SEPARADO';
      return false;
    });

    const ids = listadosElegibles.map((l) => l.id);
    if (ids.length === 0) {
      showFeedback('error', `Ninguno de los listados seleccionados puede transicionar (${accion.toUpperCase()}) en ${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente}.`);
      setBatchModal((prev) => ({ ...prev, isOpen: false }));
      return;
    }

    setIsBatchSubmitting(true);
    try {
      const res = await listadosApi.batchOperar({
        ids,
        accion,
        tipoFrente,
        motivo,
      });

      if (!res.success || !res.data) {
        showFeedback('error', res.message || 'Error al procesar la operación en lote.');
        return;
      }

      const { procesados, fallidosCount, fallidos } = res.data;

      // Si además se marcó "entregarTambien" en acción 'separar'
      if (accion === 'separar' && entregarTambien && procesados > 0) {
        const exitososIds = res.data.exitosos.map((e) => e.id);
        const resEntregar = await listadosApi.batchOperar({
          ids: exitososIds,
          accion: 'entregar',
          tipoFrente,
          motivo,
        });

        if (resEntregar.success && resEntregar.data) {
          showFeedback(
            'success',
            `Lote completado: ${resEntregar.data.procesados} listados separados y entregados a producción (${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente}).`,
          );
        } else {
          showFeedback(
            'error',
            `Se separaron ${procesados} listados, pero hubo error al entregarlos a producción.`,
          );
        }
      } else {
        if (fallidosCount === 0) {
          showFeedback(
            'success',
            `Operación completada: ${procesados} listados actualizados en ${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente}.`,
          );
        } else {
          showFeedback(
            'warning' as 'error',
            `Procesados: ${procesados}. ${fallidosCount} omitidos: ${fallidos[0]?.error ?? ''}`,
          );
        }
      }

      const exitososIds = res.data.exitosos.map((e) => e.id);

      // Retirar de la selección ÚNICAMENTE los listados procesados con éxito
      // para conservar los demás que aún tienen acciones pendientes (ej. separar)
      if (area === 'BOTA') {
        setSelectedBotaIds((prev) => prev.filter((id) => !exitososIds.includes(id)));
      } else {
        setSelectedAccesoriosIds((prev) => prev.filter((id) => !exitososIds.includes(id)));
      }

      setBatchModal((prev) => ({ ...prev, isOpen: false }));

      const isEntregaBatch = accion === 'entregar' || Boolean(entregarTambien);

      if (isEntregaBatch && exitososIds.length > 0) {
        setEntregandoListadoId(exitososIds);
        setEntregandoFrente(tipoFrente);
        setTimeout(() => {
          setEntregandoListadoId(null);
          setEntregandoFrente(null);
          reloadListados();
        }, 2000);
      } else if (exitososIds.length > 0) {
        triggerHighlight(exitososIds);
        reloadListados();
      } else {
        reloadListados();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado en lote.';
      showFeedback('error', msg);
      reloadListados();
    } finally {
      setIsBatchSubmitting(false);
    }
  };

  // ─── Sin permiso ──────────────────────────────────────────────────────────
  if (!canVer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
          <Icon name="lock" size="lg" className="text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Acceso restringido</h2>
        <p className="text-sm text-text-secondary max-w-sm">
          No tienes permiso para ver el módulo de Listados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Feedback flotante */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-xs ${
            feedback.type === 'success'
              ? 'bg-success-subtle border-success/30 text-success-text'
              : 'bg-danger/10 border-danger/30 text-danger'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <Icon name={feedback.type === 'success' ? 'check_circle' : 'error'} size="sm" />
            {feedback.message}
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-current opacity-70 hover:opacity-100">
            <Icon name="close" size="xs" />
          </button>
        </div>
      )}


      {/* Discrepancias / No clasificados de Almacén MBC */}
      {noClasificados.length > 0 && !isLoading && (
        <div className="p-3 bg-warning-subtle border border-warning/30 rounded-xl text-xs text-warning-text flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="warning" size="xs" className="shrink-0" />
            <span>
              Hay {noClasificados.length} listado(s) de Almacén MBC con línea sin área asignada en el catálogo ({noClasificados.map((i) => i.lineaProduccion.codigo).join(', ')}). No se enviaron a ningún bloque para evitar clasificaciones erróneas.
            </span>
          </div>
        </div>
      )}

      {/* Error de red */}
      {error && !isLoading && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger font-medium flex items-center gap-2">
          <Icon name="error" size="xs" />
          {error}
        </div>
      )}

      {/* ─── Barras Flotantes de Operaciones en Lote (BOTA y ACCESORIOS) ─── */}
      {(selectedBotaIds.length > 0 || selectedAccesoriosIds.length > 0) && (
        <div className="sticky top-12 z-20 grid grid-cols-1 md:grid-cols-2 gap-3 py-1 bg-cuadra-arena/80 backdrop-blur-xs rounded-xl">
          {/* Barra Lote BOTA */}
          {selectedBotaIds.length > 0 && (
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-app-surface border border-border/80 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 font-bold text-xs uppercase text-brand-primary tracking-wide">
                  <span>Bota</span>
                  <span className="text-[11px] font-mono font-bold bg-cuadra-arena/60 text-text-primary px-1.5 py-0.2 rounded border border-border/60">
                    {selectedBotaIds.length}
                  </span>
                </span>
                <span className="text-border text-xs">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedBotaIds([])}
                  className="text-xs text-text-muted hover:text-danger transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canSeparar && botaEligibles.canSepararCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2.5 bg-app-surface text-amber-700 border-amber-300 hover:bg-amber-50 font-medium"
                    onClick={() => {
                      setBatchModal({
                        isOpen: true,
                        area: 'BOTA',
                        accion: 'separar',
                        tipoFrente: operativeFrentes?.[0] ?? 'DIRECTOS',
                      });
                    }}
                  >
                    Separar ({botaEligibles.canSepararCount})
                  </Button>
                )}
                {canEntregar && botaEligibles.canEntregarCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2.5 bg-app-surface text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-medium"
                    onClick={() => {
                      setBatchModal({
                        isOpen: true,
                        area: 'BOTA',
                        accion: 'entregar',
                        tipoFrente: operativeFrentes?.[0] ?? 'DIRECTOS',
                      });
                    }}
                  >
                    Entregar ({botaEligibles.canEntregarCount})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Barra Lote ACCESORIOS */}
          {selectedAccesoriosIds.length > 0 && (
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-app-surface border border-border/80 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 font-bold text-xs uppercase text-brand-secondary tracking-wide">
                  <span>Accesorios</span>
                  <span className="text-[11px] font-mono font-bold bg-cuadra-arena/60 text-text-primary px-1.5 py-0.2 rounded border border-border/60">
                    {selectedAccesoriosIds.length}
                  </span>
                </span>
                <span className="text-border text-xs">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedAccesoriosIds([])}
                  className="text-xs text-text-muted hover:text-danger transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canSeparar && accesoriosEligibles.canSepararCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2.5 bg-app-surface text-amber-700 border-amber-300 hover:bg-amber-50 font-medium"
                    onClick={() => {
                      setBatchModal({
                        isOpen: true,
                        area: 'ACCESORIOS',
                        accion: 'separar',
                        tipoFrente: operativeFrentes?.[0] ?? 'DIRECTOS',
                      });
                    }}
                  >
                    Separar ({accesoriosEligibles.canSepararCount})
                  </Button>
                )}
                {canEntregar && accesoriosEligibles.canEntregarCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2.5 bg-app-surface text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-medium"
                    onClick={() => {
                      setBatchModal({
                        isOpen: true,
                        area: 'ACCESORIOS',
                        accion: 'entregar',
                        tipoFrente: operativeFrentes?.[0] ?? 'DIRECTOS',
                      });
                    }}
                  >
                    Entregar ({accesoriosEligibles.canEntregarCount})
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TABLA OPERATIVA PARALELA (BOTA / ACCESORIOS) ────────────────── */}
      <ListadosPendientesParalelaTable
        botaItems={botaItems}
        accesoriosItems={accesoriosItems}
        formatFecha={formatFecha}
        isLoading={isLoading}
        page={pagination.page}
        limit={pagination.limit}
        emptyMessage="No hay listados de Almacén MBC pendientes de entrega."
        frentesPermitidos={operativeFrentes}
        isBotaDisabled={isBotaDisabled}
        isAccesoriosDisabled={isAccesoriosDisabled}
        highlightedListadoId={highlightedListadoId}
        entregandoListadoId={entregandoListadoId}
        entregandoFrente={entregandoFrente}
        allowSelection={true}
        selectedBotaIds={selectedBotaIds}
        selectedAccesoriosIds={selectedAccesoriosIds}
        onToggleSelectBota={handleToggleSelectBota}
        onToggleSelectAccesorios={handleToggleSelectAccesorios}
        pagination={{
          currentPage: pagination.page,
          totalPages: pagination.totalPages,
          totalItems: pagination.total,
          itemsPerPage: pagination.limit,
          onPageChange: setPage,
        }}
        acciones={{
          onVerDetalle: handleOpenDetail,
          onSepararFrente: handleRequestSepararFrente,
          onEntregarFrente: handleRequestEntregarFrente,
          onRetrocederFrente: handleOpenRetrocederFrente,
          onCancelar: handleOpenCancelarListado,
          mutatingRows,
          canSeparar,
          canEntregar,
          canRetroceder,
          canCancelar,
        }}
      />

      {/* Modales */}
      <ListadoDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        listado={selectedListado}
        onRequestRetroceder={(listado, tipoFrente) => {
          setIsDetailOpen(false);
          handleOpenRetrocederFrente(listado, tipoFrente, true);
        }}
        onListadoUpdated={(updated, meta) => {
          if (meta?.accion === 'entregar' && updated?.id) {
            setEntregandoListadoId(updated.id);
            setEntregandoFrente(meta.tipoFrente ?? null);
            setTimeout(() => {
              setEntregandoListadoId((curr) => (curr === updated.id ? null : curr));
              setEntregandoFrente((curr) => (curr === meta.tipoFrente ? null : curr));
              reloadListados();
            }, 2000);
          } else {
            if (updated?.id) {
              triggerHighlight(updated.id);
            } else if (selectedListado?.id) {
              triggerHighlight(selectedListado.id);
            }
            reloadListados();
          }
        }}
      />

      <ListadoTransitionModal
        isOpen={isTransitionOpen}
        onClose={() => {
          setIsTransitionOpen(false);
          setTransitionTipoFrente(undefined);
          if (shouldReopenDetailOnTransitionClose) {
            setShouldReopenDetailOnTransitionClose(false);
            setIsDetailOpen(true);
          }
        }}
        listado={selectedListado}
        action={transitionAction}
        tipoFrente={transitionTipoFrente}
        onSuccess={(updated) => {
          setShouldReopenDetailOnTransitionClose(false);
          showFeedback('success', `Operación completada en listado ${updated.numeroListado}.`);
          if (updated?.id) {
            triggerHighlight(updated.id);
          }
          reloadListados();
        }}
      />

      <ListadoAccionModal
        isOpen={modalAccion.isOpen}
        onClose={() => setModalAccion((prev) => ({ ...prev, isOpen: false }))}
        listado={modalAccion.listado}
        tipoFrente={modalAccion.tipoFrente}
        accion={modalAccion.accion}
        onConfirm={handleConfirmAccionOperativa}
        isSubmitting={Boolean(modalAccion.listado && mutatingRows[modalAccion.listado.id])}
      />

      {/* Modal de Operaciones Masivas (Batch) */}
      <ListadoBatchAccionModal
        isOpen={batchModal.isOpen}
        onClose={() => setBatchModal((prev) => ({ ...prev, isOpen: false }))}
        selectedListados={batchModal.area === 'BOTA' ? selectedBotaListados : selectedAccesoriosListados}
        tipoFrente={batchModal.tipoFrente}
        availableFrentes={
          operativeFrentes ??
          (batchModal.area === 'BOTA'
            ? ['DIRECTOS', 'INDIRECTOS']
            : ['DIRECTOS', 'INDIRECTOS', 'BOLSAS'])
        }
        accion={batchModal.accion}
        onConfirm={handleConfirmBatchAccion}
        isSubmitting={isBatchSubmitting}
      />
    </div>
  );
}
