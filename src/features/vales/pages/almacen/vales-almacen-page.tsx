import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useVales } from '../../hooks/use-vales';
import { useDepartamentosVale } from '../../hooks/use-departamentos-vale';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ValesPendientesParalelaTable } from '../../components/vales-pendientes-paralela-table';
import { ValeDetailModal } from '../../components/vale-detail-modal';
import { ValeFormModal } from '../../components/vale-form-modal';
import { ValeTransitionModal, type TransitionAction } from '../../components/vale-transition-modal';
import { ValeAccionModal, type TipoAccionVale } from '../../components/vale-accion-modal';
import { ValeBatchAccionModal } from '../../components/vale-batch-accion-modal';
import { classifyVales, getValesColumnDisabledFlags, canOperateValeItem } from '../../utils/classify-vales';
import type { ValeItem } from '../../types/vales.types';

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
 * Submódulo ALMACÉN de Vales:
 *
 * - Vista paralela de BOTA y ACCESORIOS para trabajo de almacén (Separar y Entregar).
 * - Un vale permanece en esta vista mientras esté en estado PENDIENTE o SEPARADO.
 * - Cuando es entregado a producción (`ENTREGADO`), sale de Almacén y pasa a Auditoría.
 */
export function ValesAlmacenPage(): ReactNode {
  const { user, hasPermission } = usePermissions();

  const canVer = hasPermission('vale:ver');
  const canSeparar = hasPermission('vale:separar');
  const canEntregar = hasPermission('vale:entregar');
  const canEditar = hasPermission('vale:editar');
  const canCancelar = hasPermission('vale:cancelar');
  const canRetroceder = hasPermission('vale:retroceder');

  const canInteract = canSeparar || canEntregar;

  // Desactivación / Atenuación visual de bloques por alcance asignado
  const { isBotaDisabled, isAccesoriosDisabled, isOtroDisabled } = useMemo(
    () => getValesColumnDisabledFlags(user),
    [user],
  );

  // Hook principal filtrado por scopeView='almacen' (PENDIENTE y SEPARADO)
  const {
    items,
    setItems,
    pagination,
    isLoading,
    error,
    reload,
    highlightedIds,
    entregandoIds,
    descontandoIds,
    triggerHighlight,
    triggerEntregando,
  } = useVales({
    scopeView: 'almacen',
    customLimit: 500,
  });

  const { series, departamentosVale, reloadCatalogos } = useDepartamentosVale();

  // ─── Estado de modales y feedback ──────────────────────────────────────────
  const [selectedVale, setSelectedVale] = useState<ValeItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isTransitionOpen, setIsTransitionOpen] = useState<boolean>(false);
  const [transitionAction, setTransitionAction] = useState<TransitionAction>('retroceder');
  const [accionState, setAccionState] = useState<{
    isOpen: boolean;
    vale: ValeItem | null;
    accion: TipoAccionVale | null;
  }>({ isOpen: false, vale: null, accion: null });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [shouldReopenDetailOnTransitionClose, setShouldReopenDetailOnTransitionClose] =
    useState<boolean>(false);

  // ─── Selección múltiple por columna (BOTA y ACCESORIOS independientes) ────
  const [selectedBotaIds, setSelectedBotaIds] = useState<number[]>([]);
  const [selectedAccesoriosIds, setSelectedAccesoriosIds] = useState<number[]>([]);

  // Modal de operación por lote (Batch)
  const [batchModalConfig, setBatchModalConfig] = useState<{
    isOpen: boolean;
    side: 'bota' | 'accesorios';
    accion: TipoAccionVale;
  } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Mantener vales en PENDIENTE o SEPARADO (o aquellos en animación de entrega)
  const itemsAlmacen = useMemo(() => {
    return items.filter((item) => {
      if (entregandoIds.includes(item.id)) return true;
      return item.estado === 'PENDIENTE' || item.estado === 'SEPARADO';
    });
  }, [items, entregandoIds]);

  // Clasificación en BOTA, ACCESORIOS y OTRO
  const { botaItems, accesoriosItems, otroItems } = useMemo(() => {
    return classifyVales(itemsAlmacen);
  }, [itemsAlmacen]);

  // Verificador estricto de si un vale es operable en almacén por el usuario según su estado y alcance
  const isValeOperable = useCallback(
    (v: ValeItem): boolean => {
      if (!canOperateValeItem(user, v)) return false;
      if (v.estado === 'PENDIENTE') return canSeparar;
      if (v.estado === 'SEPARADO') return canEntregar;
      return false;
    },
    [user, canSeparar, canEntregar],
  );

  // ─── Handlers de selección por bloque ─────────────────────────────────────
  const handleToggleBotaId = (id: number) => {
    const item = botaItems.find((i) => i.id === id);
    if (!item || !isValeOperable(item)) return;
    setSelectedBotaIds((prev) =>
      prev.includes(id) ? prev.filter((it) => it !== id) : [...prev, id],
    );
  };

  const handleToggleAccesoriosId = (id: number) => {
    const item = accesoriosItems.find((i) => i.id === id);
    if (!item || !isValeOperable(item)) return;
    setSelectedAccesoriosIds((prev) =>
      prev.includes(id) ? prev.filter((it) => it !== id) : [...prev, id],
    );
  };

  const handleToggleAllBota = (checked: boolean) => {
    if (!checked) {
      setSelectedBotaIds([]);
      return;
    }
    const ids = botaItems
      .filter((i) => isValeOperable(i))
      .map((i) => i.id);
    setSelectedBotaIds(ids);
  };

  const handleToggleAllAccesorios = (checked: boolean) => {
    if (!checked) {
      setSelectedAccesoriosIds([]);
      return;
    }
    const ids = accesoriosItems
      .filter((i) => isValeOperable(i))
      .map((i) => i.id);
    setSelectedAccesoriosIds(ids);
  };

  const selectedBotaVales = useMemo(
    () => botaItems.filter((i) => selectedBotaIds.includes(i.id)),
    [botaItems, selectedBotaIds],
  );

  const selectedAccesoriosVales = useMemo(
    () => accesoriosItems.filter((i) => selectedAccesoriosIds.includes(i.id)),
    [accesoriosItems, selectedAccesoriosIds],
  );

  const botaBatchCounts = useMemo(
    () => ({
      separar: selectedBotaVales.filter((v) => v.estado === 'PENDIENTE').length,
      entregar: selectedBotaVales.filter((v) => v.estado === 'SEPARADO').length,
    }),
    [selectedBotaVales],
  );

  const accBatchCounts = useMemo(
    () => ({
      separar: selectedAccesoriosVales.filter((v) => v.estado === 'PENDIENTE').length,
      entregar: selectedAccesoriosVales.filter((v) => v.estado === 'SEPARADO').length,
    }),
    [selectedAccesoriosVales],
  );

  const handleOpenDetail = (vale: ValeItem) => {
    setSelectedVale(vale);
    setIsDetailOpen(true);
  };

  const handleOpenEdit = (vale: ValeItem) => {
    setSelectedVale(vale);
    setIsFormOpen(true);
  };

  const handleOpenRetroceder = (vale: ValeItem, fromDetail = false) => {
    setSelectedVale(vale);
    setTransitionAction('retroceder');
    setShouldReopenDetailOnTransitionClose(fromDetail);
    setIsTransitionOpen(true);
  };

  const handleOpenCancelar = (vale: ValeItem) => {
    setSelectedVale(vale);
    setTransitionAction('cancelar');
    setIsTransitionOpen(true);
  };

  const handleOpenAccion = (vale: ValeItem, accion: TipoAccionVale) => {
    setAccionState({ isOpen: true, vale, accion });
  };

  // ─── Acceso denegado ──────────────────────────────────────────────────────
  if (!canVer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
          <Icon name="lock" size="lg" className="text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Acceso restringido</h2>
        <p className="text-sm text-text-secondary max-w-sm">
          No tienes permiso para acceder al submódulo de Almacén de Vales.
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
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
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

      {/* ─── BARRAS DE ACCIÓN EN LOTE (BOTA | ACCESORIOS) ────────────────── */}
      {(selectedBotaIds.length > 0 || selectedAccesoriosIds.length > 0) && (
        <div className="sticky top-2 z-30 grid grid-cols-1 md:grid-cols-2 gap-3 py-1">
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
                {canSeparar && botaBatchCounts.separar > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2.5 bg-app-surface text-amber-700 border-amber-300 hover:bg-amber-50 font-medium"
                    onClick={() =>
                      setBatchModalConfig({
                        isOpen: true,
                        side: 'bota',
                        accion: 'separar',
                      })
                    }
                  >
                    Separar ({botaBatchCounts.separar})
                  </Button>
                )}

                {canEntregar && botaBatchCounts.entregar > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2.5 bg-app-surface text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-medium"
                    onClick={() =>
                      setBatchModalConfig({
                        isOpen: true,
                        side: 'bota',
                        accion: 'entregar',
                      })
                    }
                  >
                    Entregar ({botaBatchCounts.entregar})
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
                {canSeparar && accBatchCounts.separar > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2.5 bg-app-surface text-amber-700 border-amber-300 hover:bg-amber-50 font-medium"
                    onClick={() =>
                      setBatchModalConfig({
                        isOpen: true,
                        side: 'accesorios',
                        accion: 'separar',
                      })
                    }
                  >
                    Separar ({accBatchCounts.separar})
                  </Button>
                )}

                {canEntregar && accBatchCounts.entregar > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2.5 bg-app-surface text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-medium"
                    onClick={() =>
                      setBatchModalConfig({
                        isOpen: true,
                        side: 'accesorios',
                        accion: 'entregar',
                      })
                    }
                  >
                    Entregar ({accBatchCounts.entregar})
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TABLA OPERATIVA PARALELA (BOTA / ACCESORIOS) ────────────────── */}
      <ValesPendientesParalelaTable
        botaItems={botaItems}
        accesoriosItems={accesoriosItems}
        otroItems={otroItems}
        formatFecha={formatFecha}
        isLoading={isLoading}
        page={pagination.page}
        limit={pagination.limit}
        selectedBotaIds={selectedBotaIds}
        selectedAccesoriosIds={selectedAccesoriosIds}
        onToggleBotaId={handleToggleBotaId}
        onToggleAccesoriosId={handleToggleAccesoriosId}
        onToggleAllBota={handleToggleAllBota}
        onToggleAllAccesorios={handleToggleAllAccesorios}
        allowSelection={canInteract}
        isItemOperable={isValeOperable}
        isBotaDisabled={isBotaDisabled}
        isAccesoriosDisabled={isAccesoriosDisabled}
        isOtroDisabled={isOtroDisabled}
        highlightedValeId={highlightedIds}
        entregandoValeId={entregandoIds}
        descontandoValeId={descontandoIds}
        emptyMessage="Sin vales en almacén"
        acciones={{
          onVerDetalle: handleOpenDetail,
          onEditar: handleOpenEdit,
          onSeparar: (v) => handleOpenAccion(v, 'separar'),
          onEntregar: (v) => handleOpenAccion(v, 'entregar'),
          onRetroceder: (v) => handleOpenRetroceder(v, false),
          onCancelar: handleOpenCancelar,
          canSeparar,
          canEntregar,
          canRetroceder,
          canEditar,
          canCancelar,
        }}
      />

      {/* Modales */}
      <ValeDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        vale={selectedVale}
        onEdit={(v) => {
          setIsDetailOpen(false);
          handleOpenEdit(v);
        }}
        onAccion={(v, acc) => {
          setIsDetailOpen(false);
          handleOpenAccion(v, acc);
        }}
        onTransition={(v, act) => {
          setIsDetailOpen(false);
          if (act === 'cancelar') {
            handleOpenCancelar(v);
          } else {
            handleOpenRetroceder(v, true);
          }
        }}
        onValeUpdated={(updated) => {
          setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
          if (updated.estado === 'ENTREGADO') {
            triggerEntregando(updated.id, () => void reload(true));
          } else {
            triggerHighlight(updated.id);
            void reload(true);
          }
        }}
      />

      <ValeFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedVale(null);
        }}
        valeToEdit={selectedVale}
        series={series}
        departamentosVale={departamentosVale}
        onCatalogosChanged={reloadCatalogos}
        onSuccess={(saved) => {
          const items = Array.isArray(saved) ? saved : saved ? [saved] : [];
          const folios = items.map((i) => i.folio).join(', ');
          showFeedback(
            'success',
            items.length > 1
              ? `${items.length} vales registrados correctamente.`
              : `Vale ${folios} registrado correctamente.`,
          );
          const ids = items.map((i) => i.id);
          if (ids.length > 0) {
            triggerHighlight(ids);
          }
          void reload(true);
        }}
      />

      <ValeTransitionModal
        isOpen={isTransitionOpen}
        onClose={() => {
          setIsTransitionOpen(false);
          if (shouldReopenDetailOnTransitionClose) {
            setShouldReopenDetailOnTransitionClose(false);
            setIsDetailOpen(true);
          }
        }}
        vale={selectedVale}
        action={transitionAction}
        onSuccess={(updated) => {
          setShouldReopenDetailOnTransitionClose(false);
          showFeedback('success', `Operación completada en vale ${updated.folio}.`);
          if (updated.id) {
            triggerHighlight(updated.id);
          }
          void reload(true);
        }}
      />

      <ValeAccionModal
        isOpen={accionState.isOpen}
        onClose={() => setAccionState((prev) => ({ ...prev, isOpen: false }))}
        vale={accionState.vale}
        accion={accionState.accion}
        onSuccess={(updated) => {
          setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
          showFeedback('success', `Vale ${updated.folio} actualizado correctamente.`);
          if (updated.estado === 'ENTREGADO') {
            triggerEntregando(updated.id, () => void reload(true));
          } else {
            triggerHighlight(updated.id);
            void reload(true);
          }
        }}
      />

      <ValeBatchAccionModal
        isOpen={Boolean(batchModalConfig?.isOpen)}
        onClose={() => setBatchModalConfig(null)}
        vales={batchModalConfig?.side === 'bota' ? selectedBotaVales : selectedAccesoriosVales}
        accion={batchModalConfig?.accion ?? null}
        onSuccess={(procesadosIds, estadoNuevo) => {
          const side = batchModalConfig?.side;
          showFeedback('success', 'Operación masiva en almacén completada.');
          if (side === 'bota') {
            setSelectedBotaIds((prev) => prev.filter((id) => !procesadosIds.includes(id)));
          } else {
            setSelectedAccesoriosIds((prev) => prev.filter((id) => !procesadosIds.includes(id)));
          }
          setItems((prev) =>
            prev.map((it) => (procesadosIds.includes(it.id) ? { ...it, estado: estadoNuevo } : it)),
          );
          if (estadoNuevo === 'ENTREGADO') {
            triggerEntregando(procesadosIds, () => void reload(true));
          } else {
            triggerHighlight(procesadosIds);
            void reload(true);
          }
        }}
      />
    </div>
  );
}
