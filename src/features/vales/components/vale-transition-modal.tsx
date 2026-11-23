import { useState, useEffect, useMemo, type ReactNode, type FormEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/components/ui/icon';
import { ValeStatusBadge } from '@/components/ui/status-badge';
import { valesApi } from '../api/vales-api';
import type { EstadoVale, ValeItem } from '../types/vales.types';

export type TransitionAction = 'retroceder' | 'cancelar';

export interface ValeTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedItem: ValeItem) => void;
  vale: ValeItem | null;
  action: TransitionAction | null;
}

const RETROCESO_TARGET: Partial<Record<EstadoVale, EstadoVale>> = {
  DESCONTADO: 'ENTREGADO',
  ENTREGADO: 'PENDIENTE',
  SEPARADO: 'PENDIENTE',
};

const MOTIVOS_RETROCESO_VALE = [
  'Error en folio o datos del vale',
  'Material faltante en almacén / Surtido incompleto',
  'Material defectuoso o no conforme',
  'Cambio de orden o lote en producción',
  'Vale duplicado o generado por error',
  'Ajuste solicitado por encargado de piso',
];

const MOTIVOS_CANCELACION_VALE = [
  'Vale cancelado por cambio en producción',
  'Vale duplicado / Folio erróneo',
  'Material no requerido en piso',
  'Error de captura en serie o departamento',
];

const ACTION_CONFIG: Record<
  TransitionAction,
  {
    title: string;
    description: string;
    confirmLabel: string;
    confirmVariant: 'warning' | 'danger';
    confirmIcon: string;
  }
> = {
  retroceder: {
    title: 'Retroceder a Materiales Pendientes',
    description:
      'Esta acción reinicia el estado del vale seleccionado y lo manda directamente al inicio como Materiales Pendientes. Debe indicar el motivo del retroceso.',
    confirmLabel: 'Retroceder a Pendientes',
    confirmVariant: 'warning',
    confirmIcon: 'undo',
  },
  cancelar: {
    title: 'Cancelar Vale de Material',
    description:
      'Esta acción cancela el vale de manera lógica y lo deja fuera del flujo operativo. Debe indicar el motivo de la cancelación.',
    confirmLabel: 'Cancelar Vale',
    confirmVariant: 'danger',
    confirmIcon: 'cancel',
  },
};

/**
 * Modal para transiciones de Vale que requieren motivo obligatorio: Retroceder y Cancelar.
 */
export function ValeTransitionModal({
  isOpen,
  onClose,
  onSuccess,
  vale,
  action,
}: ValeTransitionModalProps): ReactNode {
  const [motivoSelect, setMotivoSelect] = useState<string>('');
  const [motivoDetalle, setMotivoDetalle] = useState<string>('');
  const [confirmFolio, setConfirmFolio] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMotivoSelect('');
      setMotivoDetalle('');
      setConfirmFolio('');
      setIsSubmitting(false);
      setError(null);
    }
  }, [isOpen, vale, action]);

  const config = action ? ACTION_CONFIG[action] : null;
  const isCancel = action === 'cancelar';
  const targetEstado = vale && !isCancel ? RETROCESO_TARGET[vale.estado] : 'CANCELADO';
  const motivosPredefinidos = isCancel ? MOTIVOS_CANCELACION_VALE : MOTIVOS_RETROCESO_VALE;

  const motivoFinal = useMemo(() => {
    if (motivoSelect === 'OTRO') {
      return motivoDetalle.trim();
    }
    return motivoSelect;
  }, [motivoSelect, motivoDetalle]);

  if (!isOpen || !vale || !action || !config) return null;

  // Si se cancela y ya está en SEPARADO, requiere escribir el folio
  const requiereConfirmacionFolio = isCancel && vale.estado === 'SEPARADO';
  const isFolioConfirmed =
    !requiereConfirmacionFolio ||
    confirmFolio.trim().toUpperCase() === vale.folio.trim().toUpperCase();

  const isMotivoValid =
    motivoSelect === 'OTRO'
      ? motivoDetalle.trim().length >= 5 && motivoDetalle.trim().length <= 500
      : Boolean(motivoSelect);
  const isValid = isMotivoValid && isFolioConfirmed;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFolioConfirmed) {
      setError(`Debes escribir exactamente el folio (${vale.folio}) para confirmar la cancelación.`);
      return;
    }
    if (!isMotivoValid) {
      setError('Debes seleccionar o especificar un motivo válido (mínimo 5 caracteres).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let updated: ValeItem;
      if (isCancel) {
        updated = await valesApi.cancelarVale(vale.id, { motivo: motivoFinal });
      } else {
        updated = await valesApi.retrocederVale(vale.id, { motivo: motivoFinal });
      }
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : `Error inesperado al ${action} el vale.`;
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader title={config.title} onClose={onClose} />
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <ModalBody className="space-y-4">
          {/* Info del vale afectado */}
          <div className="p-3 rounded-xl bg-cuadra-arena/30 border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {vale.serie?.codigo && (
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold block">
                    Serie
                  </span>
                  <span className="font-mono font-bold text-sm text-text-secondary block">
                    {vale.serie.codigo}
                  </span>
                </div>
              )}
              <div className="min-w-0 space-y-0.5">
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold block">
                  Vale
                </span>
                <span className="font-mono font-black text-base text-text-primary tracking-wide block truncate">
                  {vale.folio}
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-full bg-cuadra-arena text-text-primary border border-border/60 shrink-0">
              <Icon name="tag" size="12px" />
              {vale.departamentoVale?.nombre?.toUpperCase() ?? ''}
            </span>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed">{config.description}</p>

          {/* Resumen visual de la transición */}
          <div className="p-3 bg-app-surface rounded-xl border border-border/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              <span>Transición de Estado</span>
              {!isCancel && (
                <span className="inline-flex items-center gap-1 text-warning-text font-medium">
                  <Icon name="history" size="12px" />
                  Reinicio a Pendientes
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-cuadra-arena/20 border border-border/40">
              <div className="flex-1 min-w-0 flex items-center justify-center">
                <ValeStatusBadge estado={vale.estado} className="shadow-2xs" />
              </div>
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-app-surface border border-border shadow-2xs shrink-0 text-text-muted">
                <Icon name="arrow_forward" size="14px" />
              </div>
              <div className="flex-1 min-w-0 flex items-center justify-center">
                {targetEstado && <ValeStatusBadge estado={targetEstado} className="shadow-2xs" />}
              </div>
            </div>
          </div>

          {/* Confirmación explícita con folio si ya está en Separado en Almacén */}
          {requiereConfirmacionFolio && (
            <div className="p-3.5 rounded-xl border border-warning/40 bg-warning-subtle/50 space-y-2">
              <div className="flex items-start gap-2">
                <Icon name="warning" size="sm" className="text-warning-text shrink-0 mt-0.5" />
                <div className="text-xs text-warning-text leading-relaxed">
                  Este vale ya se encuentra en <strong>Separado en Almacén</strong>. Para autorizar
                  la cancelación, escribe el folio:{' '}
                  <span className="font-mono font-bold bg-app-surface px-1.5 py-0.5 rounded border border-border/80 text-text-primary select-all">
                    {vale.folio}
                  </span>
                </div>
              </div>
              <div className="space-y-1 pt-1">
                <Label htmlFor="confirmFolio" className="text-[10px] font-bold text-text-primary">
                  Escribe el folio para confirmar:
                </Label>
                <Input
                  id="confirmFolio"
                  type="text"
                  value={confirmFolio}
                  onChange={(e) => setConfirmFolio(e.target.value)}
                  placeholder={`Ej: ${vale.folio}`}
                  className="font-mono text-xs h-9 bg-app-surface uppercase"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {/* Campo de motivo con Select (y caja de texto únicamente si elige OTRO) */}
          <div className="space-y-2">
            <Label htmlFor="motivoSelect" className="text-xs font-semibold">
              Motivo de la operación <span className="text-danger">*</span>
            </Label>

            <Select
              id="motivoSelect"
              value={motivoSelect}
              onChange={(e) => {
                const val = e.target.value;
                setMotivoSelect(val);
                if (val !== 'OTRO') {
                  setMotivoDetalle('');
                }
              }}
              className="text-xs h-9"
            >
              <option value="">Selecciona un motivo...</option>
              {motivosPredefinidos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="OTRO">Otro motivo (especificar)...</option>
            </Select>

            {motivoSelect === 'OTRO' && (
              <div className="space-y-1 pt-1 animate-fadeIn">
                <Label htmlFor="motivoDetalle" className="text-[11px] font-medium text-text-secondary">
                  Describe el motivo específico <span className="text-danger">*</span>
                </Label>
                <Input
                  id="motivoDetalle"
                  multiline
                  textareaProps={{
                    id: 'motivoDetalle',
                    value: motivoDetalle,
                    onChange: (e) => setMotivoDetalle(e.target.value),
                    placeholder: 'Describe detalladamente el motivo de la operación (mínimo 5 caracteres)...',
                    maxLength: 500,
                    rows: 2,
                    autoFocus: true,
                  }}
                />
                <div className="flex items-center justify-end text-[10px] text-text-muted">
                  <span
                    className={
                      motivoDetalle.trim().length > 500 ||
                      (motivoDetalle.trim().length > 0 && motivoDetalle.trim().length < 5)
                        ? 'text-danger font-medium'
                        : 'text-text-muted'
                    }
                  >
                    {motivoDetalle.trim().length}/500 caracteres (mín. 5)
                  </span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-danger font-medium bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </ModalBody>

        <ModalFooter className="flex items-center justify-end gap-3">
          <Button type="button" variant="cancelar" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant={config.confirmVariant}
            icon={config.confirmIcon}
            disabled={isSubmitting || !isValid}
          >
            {isSubmitting ? (
              <>
                <Spinner size="18px" className="mr-2" />
                Procesando...
              </>
            ) : (
              config.confirmLabel
            )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
