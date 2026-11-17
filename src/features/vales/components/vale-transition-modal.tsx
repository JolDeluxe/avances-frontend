import { useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  ENTREGADO: 'SEPARADO',
  SEPARADO: 'PENDIENTE',
};

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
    title: 'Retroceder Estado del Vale (1 Paso)',
    description:
      'Esta acción regresa el vale exactamente al estado inmediato anterior dentro del flujo operativo. Debe indicar el motivo del retroceso.',
    confirmLabel: 'Retroceder Estado',
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
 * Modal para transiciones que requieren motivo obligatorio (5–500 chars): Retroceder y Cancelar.
 */
export function ValeTransitionModal({
  isOpen,
  onClose,
  onSuccess,
  vale,
  action,
}: ValeTransitionModalProps): ReactNode {
  const [motivo, setMotivo] = useState<string>('');
  const [confirmFolio, setConfirmFolio] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMotivo('');
      setConfirmFolio('');
      setIsSubmitting(false);
      setError(null);
    }
  }, [isOpen, vale, action]);

  if (!isOpen || !vale || !action) return null;

  const config = ACTION_CONFIG[action];
  const isCancel = action === 'cancelar';
  const targetEstado = !isCancel ? RETROCESO_TARGET[vale.estado] : 'CANCELADO';

  // Si se cancela y ya está en SEPARADO, requiere escribir el folio
  const requiereConfirmacionFolio = isCancel && vale.estado === 'SEPARADO';
  const isFolioConfirmed =
    !requiereConfirmacionFolio ||
    confirmFolio.trim().toUpperCase() === vale.folio.trim().toUpperCase();

  const motivoTrimmed = motivo.trim();
  const isMotivoValid = motivoTrimmed.length >= 5 && motivoTrimmed.length <= 500;
  const isValid = isMotivoValid && isFolioConfirmed;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFolioConfirmed) {
      setError(`Debes escribir exactamente el folio (${vale.folio}) para confirmar la cancelación.`);
      return;
    }
    if (!isMotivoValid) {
      setError('El motivo es obligatorio y debe tener entre 5 y 500 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let updated: ValeItem;
      if (isCancel) {
        updated = await valesApi.cancelarVale(vale.id, { motivo: motivoTrimmed });
      } else {
        updated = await valesApi.retrocederVale(vale.id, { motivo: motivoTrimmed });
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
          <div className="p-3.5 rounded-xl bg-cuadra-arena/30 border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {vale.serie?.codigo && (
                <div className="space-y-0.5">
                  <span className="text-2xs uppercase tracking-wider text-text-muted font-bold block">
                    Serie
                  </span>
                  <span className="font-mono font-bold text-sm text-text-secondary block">
                    {vale.serie.codigo}
                  </span>
                </div>
              )}
              <div className="min-w-0 space-y-0.5">
                <span className="text-2xs uppercase tracking-wider text-text-muted font-bold block">
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

          <p className="text-xs text-text-secondary">{config.description}</p>

          {/* Resumen visual de la transición */}
          <div className="flex items-center justify-between px-3 py-2 bg-app-surface rounded-lg border border-border/60 text-xs">
            <span className="font-medium text-text-secondary">Transición:</span>
            <div className="flex items-center gap-2">
              <ValeStatusBadge estado={vale.estado} />
              <Icon name="arrow_forward" size="14px" className="text-text-muted" />
              {targetEstado && <ValeStatusBadge estado={targetEstado} />}
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
                <Label htmlFor="confirmFolio" className="text-2xs font-bold text-text-primary">
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

          {/* Campo de motivo */}
          <div className="space-y-1.5">
            <Label htmlFor="motivo">
              Motivo <span className="text-danger">*</span>
            </Label>
            <Input
              id="motivo"
              multiline
              textareaProps={{
                id: 'motivo',
                value: motivo,
                onChange: (e) => setMotivo(e.target.value),
                placeholder: 'Describe el motivo de la operación (mínimo 5 caracteres)...',
                maxLength: 500,
                rows: 3,
              }}
            />
            <div className="flex items-center justify-between">
              <span
                className={`text-2xs ${
                  motivoTrimmed.length > 500 ||
                  (motivoTrimmed.length > 0 && motivoTrimmed.length < 5)
                    ? 'text-danger'
                    : 'text-text-muted'
                }`}
              >
                {motivoTrimmed.length}/500 caracteres (mín. 5)
              </span>
            </div>
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
