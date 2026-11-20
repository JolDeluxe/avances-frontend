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
 * Submódulo AGREGAR / ADMINISTRACIÓN de Vales.
 *
 * Propósito exclusivo:
 * - Alta y edición de vales de material.
 * - Muestra únicamente los vales recién creados que están en espera inicial (`PENDIENTE`),
 *   en el mismo formato paralelo (BOTA y ACCESORIOS).
 * - Una vez que el vale es separado por Almacén, desaparece de esta vista de alta.
 */
export function ValesAdministracionPage(): ReactNode {
  const { user, hasPermission, hasAnyPermission } = usePermissions();

  const canVer = hasAnyPermission(['vale:ver', 'vale:crear', 'vale:editar']);
  const canCrear = hasPermission('vale:crear');
  const canEditar = hasPermission('vale:editar');
  const canCancelar = hasPermission('vale:cancelar');
  const canRetroceder = hasAnyPermission(['vale:retroceder', 'vale:retroceder_descuento']);

  // Desactivación / Atenuación visual de bloques por alcance asignado
  const { isBotaDisabled, isAccesoriosDisabled, isOtroDisabled } = useMemo(
    () => getValesColumnDisabledFlags(user),
    [user],
  );

  // Hook principal filtrado por scopeView='registrar' (vales en estado PENDIENTE)
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
    scopeView: 'registrar',
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

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Filtrar estrictamente a vales que permanecen en estado PENDIENTE (o que están animando)
  const itemsRecienCreados = useMemo(() => {
    return items.filter(
      (item) =>
        item.estado === 'PENDIENTE' ||
        entregandoIds.includes(item.id) ||
        descontandoIds.includes(item.id),
    );
  }, [items, entregandoIds, descontandoIds]);

  // Clasificación en BOTA, ACCESORIOS y OTRO
  const { botaItems, accesoriosItems, otroItems } = useMemo(() => {
    return classifyVales(itemsRecienCreados);
  }, [itemsRecienCreados]);

  const handleOpenCreate = () => {
    setSelectedVale(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (vale: ValeItem) => {
    setSelectedVale(vale);
    setIsFormOpen(true);
  };

  const handleOpenDetail = (vale: ValeItem) => {
    setSelectedVale(vale);
    setIsDetailOpen(true);
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

  // ─── Sin permiso ──────────────────────────────────────────────────────────
  if (!canVer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
          <Icon name="lock" size="lg" className="text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Acceso restringido</h2>
        <p className="text-sm text-text-secondary max-w-sm">
          No tienes permiso para acceder al submódulo de Agregar Vales.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Acción Principal alineada a la derecha */}
      {canCrear && (
        <div className="flex items-center justify-end">
          <Button variant="guardar" size="sm" icon="add_circle" onClick={handleOpenCreate}>
            Nuevo Vale
          </Button>
        </div>
      )}

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

      {/* ─── TABLA OPERATIVA PARALELA (BOTA / ACCESORIOS) ────────────────── */}
      <ValesPendientesParalelaTable
        botaItems={botaItems}
        accesoriosItems={accesoriosItems}
        otroItems={otroItems}
        formatFecha={formatFecha}
        isLoading={isLoading}
        page={pagination.page}
        limit={pagination.limit}
        isBotaDisabled={isBotaDisabled}
        isAccesoriosDisabled={isAccesoriosDisabled}
        isOtroDisabled={isOtroDisabled}
        highlightedValeId={highlightedIds}
        entregandoValeId={entregandoIds}
        descontandoValeId={descontandoIds}
        emptyMessage="No hay vales recién agregados pendientes de separación."
        allowSelection={false}
        acciones={{
          onVerDetalle: handleOpenDetail,
          onEditar: handleOpenEdit,
          onRetroceder: (v) => handleOpenRetroceder(v, false),
          onCancelar: handleOpenCancelar,
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
          const isEditing = Boolean(selectedVale);
          const items = Array.isArray(saved) ? saved : saved ? [saved] : [];
          const folios = items.map((i) => i.folio).join(', ');
          showFeedback(
            'success',
            isEditing
              ? 'Vale actualizado correctamente.'
              : items.length > 1
                ? `${items.length} vales creados correctamente.`
                : `Vale ${folios} creado correctamente.`,
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
    </div>
  );
}
