import { useState, useMemo, type ReactNode } from 'react';
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
import { classifyVales, getValesColumnDisabledFlags } from '../../utils/classify-vales';
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
 * Submódulo PENDIENTES de Vales:
 *
 * - Muestra todos los vales que aún tienen etapas pendientes de completar
 *   (PENDIENTE, SEPARADO, ENTREGADO) en formato paralelo BOTA | ACCESORIOS.
 * - Un vale desaparece de esta vista únicamente cuando llega a DESCONTADO o CANCELADO.
 * - Si el usuario tiene permisos operativos (separar, entregar, descontar), puede
 *   seleccionar filas y operar individual o masivamente.
 */
export function ValesPendientesPage(): ReactNode {
  const { user, hasPermission, hasAnyPermission, isSuperAdmin, isAdmin } = usePermissions();

  const canVer = isSuperAdmin || isAdmin || hasPermission('vale:ver');
  const canSeparar = isSuperAdmin || isAdmin || hasPermission('vale:separar');
  const canEntregar = isSuperAdmin || isAdmin || hasPermission('vale:entregar');
  const canDescontar = isSuperAdmin || isAdmin || hasPermission('vale:descontar');
  const canEditar = isSuperAdmin || isAdmin || hasPermission('vale:editar');
  const canCancelar = isSuperAdmin || isAdmin || hasPermission('vale:cancelar');
  const canRetroceder = isSuperAdmin || isAdmin || hasAnyPermission(['vale:retroceder', 'vale:retroceder_descuento']);

  // Un usuario de solo lectura (ej. GERENCIA sin permisos de operación) solo consulta el tablero
  const canInteract =
    isSuperAdmin || isAdmin || canSeparar || canEntregar || canDescontar;

  // Desactivación / Atenuación visual de bloques por alcance asignado
  const { isBotaDisabled, isAccesoriosDisabled, isOtroDisabled } = useMemo(
    () => getValesColumnDisabledFlags(user),
    [user],
  );

  // Consulta todos los vales activos en flujo
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
    triggerDescontando,
  } = useVales({
    scopeView: 'general',
    fixedEstado: 'PENDIENTE,SEPARADO,ENTREGADO',
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

  // Mantener únicamente los vales que aún no están descontados ni cancelados (o que están animando su salida)
  const itemsPendientes = useMemo(() => {
    return items.filter((item) => {
      if (descontandoIds.includes(item.id) || entregandoIds.includes(item.id)) {
        return true;
      }
      return item.estado !== 'CANCELADO' && item.estado !== 'DESCONTADO';
    });
  }, [items, descontandoIds, entregandoIds]);

  // Clasificación en BOTA, ACCESORIOS y OTRO
  const { botaItems, accesoriosItems, otroItems } = useMemo(() => {
    return classifyVales(itemsPendientes);
  }, [itemsPendientes]);

  // ─── Handlers de selección por bloque ─────────────────────────────────────
  const handleToggleBotaId = (id: number) => {
    setSelectedBotaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleToggleAccesoriosId = (id: number) => {
    setSelectedAccesoriosIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleToggleAllBota = (checked: boolean) => {
    if (!checked) {
      setSelectedBotaIds([]);
      return;
    }
    const ids = botaItems
      .filter((i) => i.estado !== 'CANCELADO' && i.estado !== 'DESCONTADO')
      .map((i) => i.id);
    setSelectedBotaIds(ids);
  };

  const handleToggleAllAccesorios = (checked: boolean) => {
    if (!checked) {
      setSelectedAccesoriosIds([]);
      return;
    }
    const ids = accesoriosItems
      .filter((i) => i.estado !== 'CANCELADO' && i.estado !== 'DESCONTADO')
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
      descontar: selectedBotaVales.filter((v) => v.estado === 'ENTREGADO').length,
    }),
    [selectedBotaVales],
  );

  const accBatchCounts = useMemo(
    () => ({
      separar: selectedAccesoriosVales.filter((v) => v.estado === 'PENDIENTE').length,
      entregar: selectedAccesoriosVales.filter((v) => v.estado === 'SEPARADO').length,
      descontar: selectedAccesoriosVales.filter((v) => v.estado === 'ENTREGADO').length,
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
          No tienes permiso para ver los vales pendientes.
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

      {/* ─── BARRAS DE ACCIÓN EN LOTE (Solo para perfiles operativos) ─── */}
      {canInteract && (selectedBotaIds.length > 0 || selectedAccesoriosIds.length > 0) && (
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

                {canDescontar && botaBatchCounts.descontar > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2.5 bg-app-surface text-purple-700 border-purple-300 hover:bg-purple-50 font-medium"
                    onClick={() =>
                      setBatchModalConfig({
                        isOpen: true,
                        side: 'bota',
                        accion: 'descontar',
                      })
                    }
                  >
                    Descontar ({botaBatchCounts.descontar})
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

                {canDescontar && accBatchCounts.descontar > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2.5 bg-app-surface text-purple-700 border-purple-300 hover:bg-purple-50 font-medium"
                    onClick={() =>
                      setBatchModalConfig({
                        isOpen: true,
                        side: 'accesorios',
                        accion: 'descontar',
                      })
                    }
                  >
                    Descontar ({accBatchCounts.descontar})
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
        hideActions={!canInteract}
        isBotaDisabled={isBotaDisabled}
        isAccesoriosDisabled={isAccesoriosDisabled}
        isOtroDisabled={isOtroDisabled}
        highlightedValeId={highlightedIds}
        entregandoValeId={entregandoIds}
        descontandoValeId={descontandoIds}
        emptyMessage="No hay vales pendientes por completar."
        acciones={
          canInteract
            ? {
                onVerDetalle: handleOpenDetail,
                onEditar: handleOpenEdit,
                onSeparar: (v) => handleOpenAccion(v, 'separar'),
                onEntregar: (v) => handleOpenAccion(v, 'entregar'),
                onDescontar: (v) => handleOpenAccion(v, 'descontar'),
                onRetroceder: (v) => handleOpenRetroceder(v, false),
                onCancelar: handleOpenCancelar,
                canSeparar,
                canEntregar,
                canDescontar,
                canRetroceder,
                canEditar,
                canCancelar,
              }
            : undefined
        }
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
          if (updated.estado === 'DESCONTADO') {
            triggerDescontando(updated.id, () => void reload(true));
          } else if (updated.estado === 'ENTREGADO') {
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
          showFeedback('success', `Vale ${saved?.folio ?? ''} actualizado correctamente.`);
          if (saved?.id) {
            triggerHighlight(saved.id);
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
          if (updated.estado === 'DESCONTADO') {
            triggerDescontando(updated.id, () => void reload(true));
          } else if (updated.estado === 'ENTREGADO') {
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
          showFeedback('success', 'Operación masiva completada correctamente.');
          if (side === 'bota') {
            setSelectedBotaIds((prev) => prev.filter((id) => !procesadosIds.includes(id)));
          } else {
            setSelectedAccesoriosIds((prev) => prev.filter((id) => !procesadosIds.includes(id)));
          }
          setItems((prev) =>
            prev.map((it) => (procesadosIds.includes(it.id) ? { ...it, estado: estadoNuevo } : it)),
          );
          if (estadoNuevo === 'DESCONTADO') {
            triggerDescontando(procesadosIds, () => void reload(true));
          } else if (estadoNuevo === 'ENTREGADO') {
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
