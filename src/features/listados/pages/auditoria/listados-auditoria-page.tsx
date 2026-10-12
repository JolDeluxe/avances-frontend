import { useState, useMemo, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { useListados } from '../../hooks/use-listados';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ListadosAuditoriaParalelaTable } from '../../components/listados-auditoria-paralela-table';
import { ListadoDetailModal } from '../../components/listado-detail-modal';
import { ListadoTransitionModal, type TransitionAction } from '../../components/listado-transition-modal';
import { ListadoAccionModal } from '../../components/listado-accion-modal';
import { ListadoBatchAccionModal } from '../../components/listado-batch-accion-modal';
import { Button } from '@/components/ui/button';
import { listadosApi } from '../../api/listados-api';
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
 * Submódulo AUDITORÍA de Listados.
 *
 * Tablero Operativo de Auditoría dividido en dos bloques paralelos:
 * - DIRECTOS (Izquierda)
 * - INDIRECTOS (Derecha)
 *
 * Muestra solo aquellos listados cuyos frentes ya fueron ENTREGADOS a producción
 * (o están listos para validación/descuento en ERP).
 * La interacción se habilita según el rol/asignación del auditor (Directos, Indirectos o Ambos).
 */
export function ListadosAuditoriaPage(): ReactNode {
  const { user, hasPermission, isSuperAdmin, isAdmin } = usePermissions();
  const canVer = hasPermission('listado:ver');
  const canDescontar = hasPermission('listado:descontar');
  const canRetroceder = (isSuperAdmin || isAdmin) && hasPermission('listado:retroceder');

  // Solo traemos listados entregados a producción o en proceso con frentes entregados
  const {
    items,
    pagination,
    isLoading,
    error,
    reloadListados,
    setPage,
  } = useListados({ fixedEstado: 'ENTREGADO_A_PRODUCCION,EN_PROCESO' });

  // ─── Estado de modales y feedback ──────────────────────────────────────────
  const [selectedListado, setSelectedListado] = useState<ListadoItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isTransitionOpen, setIsTransitionOpen] = useState<boolean>(false);
  const [transitionAction, setTransitionAction] = useState<TransitionAction>('retroceder');
  const [transitionTipoFrente, setTransitionTipoFrente] = useState<TipoFrenteMaterial | undefined>(undefined);
  const [mutatingRows, setMutatingRows] = useState<Record<number, string | null>>({});
  const [descontandoListadoId, setDescontandoListadoId] = useState<number | number[] | null>(null);
  const [descontandoFrente, setDescontandoFrente] = useState<TipoFrenteMaterial | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // ─── Selección Múltiple y Descuento Masivo (Batch) ─────────────────────────
  const [selectedDirectosIds, setSelectedDirectosIds] = useState<number[]>([]);
  const [selectedIndirectosIds, setSelectedIndirectosIds] = useState<number[]>([]);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState<boolean>(false);
  const [batchModal, setBatchModal] = useState<{
    isOpen: boolean;
    columna: 'DIRECTOS' | 'INDIRECTOS';
    tipoFrente: TipoFrenteMaterial;
  }>({
    isOpen: false,
    columna: 'DIRECTOS',
    tipoFrente: 'DIRECTOS',
  });

  const handleToggleSelectDirectos = (id: number) => {
    setSelectedDirectosIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleToggleSelectIndirectos = (id: number) => {
    setSelectedIndirectosIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenDetail = (listado: ListadoItem) => {
    setSelectedListado(listado);
    setIsDetailOpen(true);
  };

  const handleOpenRetrocederFrente = (listado: ListadoItem, tipoFrente?: TipoFrenteMaterial) => {
    setSelectedListado(listado);
    setTransitionTipoFrente(tipoFrente);
    setTransitionAction('retroceder');
    setIsTransitionOpen(true);
  };

  // Función de validación según el rol y tipoMaterialAuditor del auditor
  const puedeOperarFrente = (tipoFrente: TipoFrenteMaterial): boolean => {
    if (isSuperAdmin || isAdmin) return true;
    const rol = user?.rol?.toUpperCase();
    if (rol === 'AUDITOR') {
      if (!user?.tipoMaterialAuditor) return true;
      const frentes = user.tipoMaterialAuditor.split(',').map((f) => f.trim().toUpperCase());
      return frentes.includes('TODOS') || frentes.includes(tipoFrente);
    }
    return false;
  };

  // ─── Desactivación / Atenuación visual de bloques en auditoría ──────────────
  // DIRECTOS Y BOLSAS está a la izquierda; INDIRECTOS está a la derecha.
  const { isDirectosDisabled, isIndirectosDisabled } = useMemo(() => {
    if (isSuperAdmin || isAdmin) {
      return { isDirectosDisabled: false, isIndirectosDisabled: false };
    }
    const rol = user?.rol?.toUpperCase();
    if (rol === 'AUDITOR') {
      const tipo = user?.tipoMaterialAuditor?.toUpperCase();
      if (!tipo) {
        return { isDirectosDisabled: false, isIndirectosDisabled: false };
      }
      const frentes = tipo.split(',').map((f) => f.trim());
      if (frentes.includes('TODOS')) {
        return { isDirectosDisabled: false, isIndirectosDisabled: false };
      }
      const hasDirectosOBolsas = frentes.includes('DIRECTOS') || frentes.includes('BOLSAS');
      const hasIndirectos = frentes.includes('INDIRECTOS');
      return {
        isDirectosDisabled: !hasDirectosOBolsas,
        isIndirectosDisabled: !hasIndirectos,
      };
    }
    return { isDirectosDisabled: false, isIndirectosDisabled: false };
  }, [isSuperAdmin, isAdmin, user?.rol, user?.tipoMaterialAuditor]);

  const [modalDescontar, setModalDescontar] = useState<{
    isOpen: boolean;
    listado: ListadoItem | null;
    tipoFrente: TipoFrenteMaterial;
  }>({
    isOpen: false,
    listado: null,
    tipoFrente: 'DIRECTOS',
  });

  const handleRequestDescontarFrente = (listado: ListadoItem, tipoFrente: TipoFrenteMaterial) => {
    setModalDescontar({
      isOpen: true,
      listado,
      tipoFrente,
    });
  };

  const handleConfirmDescontarFrente = async () => {
    if (!modalDescontar.listado) return;
    const { listado, tipoFrente } = modalDescontar;
    setMutatingRows((prev) => ({ ...prev, [listado.id]: 'descontar' }));
    try {
      const res = await listadosApi.descontar(listado.id, tipoFrente);
      if (res.success) {
        setModalDescontar((prev) => ({ ...prev, isOpen: false }));
        // Activamos parpadeo morado e icono de DESCONTADO durante 2 segundos antes de retirar la fila
        setDescontandoListadoId(listado.id);
        setDescontandoFrente(tipoFrente);
        showFeedback(
          'success',
          `${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente} de listado ${listado.numeroListado} descontado en sistema con éxito.`,
        );
        setTimeout(() => {
          setDescontandoListadoId((prev) => (prev === listado.id ? null : prev));
          setDescontandoFrente(null);
          reloadListados();
        }, 2000);
      } else {
        showFeedback('error', res.message || 'Error al descontar.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al descontar.';
      showFeedback('error', msg);
      reloadListados();
    } finally {
      setMutatingRows((prev) => ({ ...prev, [listado.id]: null }));
    }
  };

  // ─── Clasificación en DIRECTOS e INDIRECTOS ────────────────────────────────
  // Reglas Operativas de Auditoría:
  // 1. Cada material (DIR/BOL o IND) aparece en su respectiva columna de auditoría en cuanto
  //    es entregado a producción (estado === 'ENTREGADO'), de forma independiente.
  // 2. Al descontar un material en sistema, desaparece de su respectiva tabla.
  // 3. Bolsas se audita y descuenta en la columna de DIRECTOS / BOLSAS.
  // 4. Para consultar listados con materiales ya descontados o históricos, se hace en HISTORIAL.
  const { directosItems, indirectosItems } = useMemo(() => {
    const directos: ListadoItem[] = [];
    const indirectos: ListadoItem[] = [];

    items.forEach((item) => {
      if (item.estado === 'CANCELADO' || item.estado === 'DESCONTADO') return;

      const frentes = item.frentes ?? [];
      if (frentes.length === 0) return;

      const dirOBolsas = frentes.find(
        (f) => (f.tipoFrente === 'DIRECTOS' || f.tipoFrente === 'BOLSAS') && f.estado === 'ENTREGADO'
      );
      const ind = frentes.find((f) => f.tipoFrente === 'INDIRECTOS');

      // En la columna DIRECTOS / BOLSAS: aparece de inmediato si DIR o BOL ya fue entregado a producción
      if (dirOBolsas) {
        directos.push(item);
      }

      // En la columna INDIRECTOS: aparece de inmediato si IND ya fue entregado a producción
      if (ind && ind.estado === 'ENTREGADO') {
        indirectos.push(item);
      }
    });

    return { directosItems: directos, indirectosItems: indirectos };
  }, [items]);

  // Ítems seleccionados completos
  const selectedDirectosListados = useMemo(() => {
    return directosItems.filter((item) => selectedDirectosIds.includes(item.id));
  }, [directosItems, selectedDirectosIds]);

  const selectedIndirectosListados = useMemo(() => {
    return indirectosItems.filter((item) => selectedIndirectosIds.includes(item.id));
  }, [indirectosItems, selectedIndirectosIds]);

  const handleConfirmBatchDescontar = async ({
    tipoFrente,
    motivo,
  }: {
    tipoFrente: TipoFrenteMaterial;
    motivo?: string;
  }) => {
    const { columna } = batchModal;
    const selectedListados = columna === 'DIRECTOS' ? selectedDirectosListados : selectedIndirectosListados;

    // Solo los listados cuyo material esté en estado ENTREGADO son elegibles para descontar
    const listadosElegibles = selectedListados.filter((item) => {
      const f = item.frentes?.find((fr) => fr.tipoFrente === tipoFrente);
      return f && f.estado === 'ENTREGADO';
    });

    const ids = listadosElegibles.map((l) => l.id);
    if (ids.length === 0) {
      showFeedback('error', `Ninguno de los listados seleccionados puede ser descontado en ${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente}.`);
      setBatchModal((prev) => ({ ...prev, isOpen: false }));
      return;
    }

    setIsBatchSubmitting(true);
    try {
      const res = await listadosApi.batchOperar({
        ids,
        accion: 'descontar',
        tipoFrente,
        motivo,
      });

      if (!res.success || !res.data) {
        showFeedback('error', res.message || 'Error al descontar listados en lote.');
        return;
      }

      const { procesados, fallidosCount, fallidos } = res.data;
      if (fallidosCount === 0) {
        showFeedback(
          'success',
          `Se descontaron ${procesados} listados en sistema con éxito (${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente}).`,
        );
      } else {
        showFeedback(
          'warning' as 'error',
          `Descontados: ${procesados}. ${fallidosCount} omitidos: ${fallidos[0]?.error ?? ''}`,
        );
      }

      const exitososIds = res.data.exitosos.map((e) => e.id);

      if (columna === 'DIRECTOS') {
        setSelectedDirectosIds((prev) => prev.filter((id) => !exitososIds.includes(id)));
      } else {
        setSelectedIndirectosIds((prev) => prev.filter((id) => !exitososIds.includes(id)));
      }

      setBatchModal((prev) => ({ ...prev, isOpen: false }));
      if (exitososIds.length > 0) {
        setDescontandoListadoId(exitososIds);
        setDescontandoFrente(tipoFrente);
        setTimeout(() => {
          setDescontandoListadoId(null);
          setDescontandoFrente(null);
          reloadListados();
        }, 2000);
      } else {
        reloadListados();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al descontar en lote.';
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
          No tienes permiso para ver el módulo de Auditoría de Listados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      {/* <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Auditoría y Descuento en Sistema</h2>
          <p className="text-xs text-text-secondary font-lectura mt-0.5">
            Tablero de validación para frentes entregados a producción. Separado por Material Directo e Indirecto.
            {user?.tipoMaterialAuditor && (
              <span className="ml-2 inline-flex items-center gap-1 font-bold text-marca-secundario bg-cuadra-arena/60 px-2 py-0.5 rounded border border-border/60">
                <Icon name="badge" size="12px" />
                Asignación: {user.tipoMaterialAuditor}
              </span>
            )}
          </p>
        </div>
      </div> */}

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

      {/* Error de red */}
      {error && !isLoading && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger font-medium flex items-center gap-2">
          <Icon name="error" size="xs" />
          {error}
        </div>
      )}

      {/* ─── Barras Flotantes de Descuento Masivo (DIRECTOS e INDIRECTOS) ─── */}
      {(selectedDirectosIds.length > 0 || selectedIndirectosIds.length > 0) && (
        <div className="sticky top-12 z-20 grid grid-cols-1 md:grid-cols-2 gap-3 py-1 bg-cuadra-arena/80 backdrop-blur-xs rounded-xl">
          {/* Barra Lote DIRECTOS */}
          {selectedDirectosIds.length > 0 && (
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-app-surface border border-border/80 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 font-bold text-xs uppercase text-brand-primary tracking-wide">
                  <span>Directos</span>
                  <span className="text-[11px] font-mono font-bold bg-cuadra-arena/60 text-text-primary px-1.5 py-0.2 rounded border border-border/60">
                    {selectedDirectosIds.length}
                  </span>
                </span>
                <span className="text-border text-xs">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedDirectosIds([])}
                  className="text-xs text-text-muted hover:text-danger transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
              <div>
                {canDescontar && (
                  <Button
                    size="sm"
                    className="text-xs h-7 px-2.5 bg-purple-600 text-white hover:bg-purple-700 gap-1.5"
                    onClick={() => {
                      setBatchModal({
                        isOpen: true,
                        columna: 'DIRECTOS',
                        tipoFrente: 'DIRECTOS',
                      });
                    }}
                  >
                    <Icon name="done_all" size="12px" weight={700} />
                    Descontar en Sistema ({selectedDirectosIds.length})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Barra Lote INDIRECTOS */}
          {selectedIndirectosIds.length > 0 && (
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-app-surface border border-border/80 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 font-bold text-xs uppercase text-brand-secondary tracking-wide">
                  <span>Indirectos</span>
                  <span className="text-[11px] font-mono font-bold bg-cuadra-arena/60 text-text-primary px-1.5 py-0.2 rounded border border-border/60">
                    {selectedIndirectosIds.length}
                  </span>
                </span>
                <span className="text-border text-xs">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedIndirectosIds([])}
                  className="text-xs text-text-muted hover:text-danger transition-colors cursor-pointer"
                >
                  Limpiar
                </button>
              </div>
              <div>
                {canDescontar && (
                  <Button
                    size="sm"
                    className="text-xs h-7 px-2.5 bg-purple-600 text-white hover:bg-purple-700 gap-1.5"
                    onClick={() => {
                      setBatchModal({
                        isOpen: true,
                        columna: 'INDIRECTOS',
                        tipoFrente: 'INDIRECTOS',
                      });
                    }}
                  >
                    <Icon name="done_all" size="12px" weight={700} />
                    Descontar en Sistema ({selectedIndirectosIds.length})
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TABLA OPERATIVA PARALELA (DIRECTOS / INDIRECTOS) ─────────────── */}
      <ListadosAuditoriaParalelaTable
        directosItems={directosItems}
        indirectosItems={indirectosItems}
        formatFecha={formatFecha}
        isLoading={isLoading}
        isDirectosDisabled={isDirectosDisabled}
        isIndirectosDisabled={isIndirectosDisabled}
        descontandoListadoId={descontandoListadoId}
        descontandoFrente={descontandoFrente}
        selectedDirectosIds={selectedDirectosIds}
        selectedIndirectosIds={selectedIndirectosIds}
        onToggleSelectDirectos={handleToggleSelectDirectos}
        onToggleSelectIndirectos={handleToggleSelectIndirectos}
        emptyMessage="No hay materiales entregados a producción pendientes de descontar en sistema."
        pagination={{
          currentPage: pagination.page,
          totalPages: pagination.totalPages,
          totalItems: pagination.total,
          itemsPerPage: pagination.limit,
          onPageChange: setPage,
        }}
        acciones={{
          onVerDetalle: handleOpenDetail,
          onDescontarFrente: handleRequestDescontarFrente,
          onRetrocederFrente: handleOpenRetrocederFrente,
          mutatingRows,
          canDescontar,
          canRetroceder,
          puedeOperarFrente,
        }}
      />

      {/* Modales */}
      <ListadoDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        listado={selectedListado}
        onRequestRetroceder={(listado, tipoFrente) => {
          setIsDetailOpen(false);
          handleOpenRetrocederFrente(listado, tipoFrente);
        }}
        onListadoUpdated={() => {
          reloadListados();
        }}
      />

      <ListadoTransitionModal
        isOpen={isTransitionOpen}
        onClose={() => {
          setIsTransitionOpen(false);
          setTransitionTipoFrente(undefined);
        }}
        listado={selectedListado}
        action={transitionAction}
        tipoFrente={transitionTipoFrente}
        onSuccess={(updated) => {
          showFeedback('success', `Operación completada en listado ${updated.numeroListado}.`);
          reloadListados();
        }}
      />

      {/* Modal de confirmación para Descontar en Sistema (Individual) */}
      <ListadoAccionModal
        isOpen={modalDescontar.isOpen}
        onClose={() => setModalDescontar((prev) => ({ ...prev, isOpen: false }))}
        listado={modalDescontar.listado}
        tipoFrente={modalDescontar.tipoFrente}
        accion="descontar"
        onConfirm={handleConfirmDescontarFrente}
        isSubmitting={Boolean(modalDescontar.listado && mutatingRows[modalDescontar.listado.id])}
      />

      {/* Modal de confirmación para Descontar en Sistema (Masivo / Batch) */}
      <ListadoBatchAccionModal
        isOpen={batchModal.isOpen}
        onClose={() => setBatchModal((prev) => ({ ...prev, isOpen: false }))}
        selectedListados={batchModal.columna === 'DIRECTOS' ? selectedDirectosListados : selectedIndirectosListados}
        tipoFrente={batchModal.tipoFrente}
        availableFrentes={batchModal.columna === 'DIRECTOS' ? ['DIRECTOS', 'BOLSAS'] : ['INDIRECTOS']}
        accion="descontar"
        onConfirm={handleConfirmBatchDescontar}
        isSubmitting={isBatchSubmitting}
      />
    </div>
  );
}
