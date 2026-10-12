import { useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/components/ui/icon';
import { FrenteStatusBadge } from '@/components/ui/status-badge';
import { TIPO_FRENTE_CONFIG } from '@/config/status-config';
import { listadosApi } from '../api/listados-api';
import type { ListadoItem, TipoFrenteMaterial } from '../types/listados.types';

export type TransitionAction = 'retroceder' | 'cancelar';

export interface ListadoTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  listado: ListadoItem | null;
  action: TransitionAction;
  tipoFrente?: TipoFrenteMaterial;
  onSuccess: (updatedListado: ListadoItem) => void;
}

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
      'Esta acción reinicia el estado del frente seleccionado y lo manda directamente al inicio como Materiales Pendientes. Debe indicar el motivo del retroceso.',
    confirmLabel: 'Retroceder a Pendientes',
    confirmVariant: 'warning',
    confirmIcon: 'undo',
  },
  cancelar: {
    title: 'Cancelar Listado Completo',
    description:
      'Esta acción cancela el listado y lo deja fuera del flujo operativo. Debe indicar el motivo de la cancelación.',
    confirmLabel: 'Cancelar Listado',
    confirmVariant: 'danger',
    confirmIcon: 'cancel',
  },
};

/**
 * Modal para transiciones que requieren motivo obligatorio: Retroceder y Cancelar.
 *
 * El motivo es validado en frontend (1–500 chars) y también en backend.
 * En el caso de retroceder, la operación es por frente y requiere `tipoFrente`.
 */
export function ListadoTransitionModal({
  isOpen,
  onClose,
  listado,
  action,
  tipoFrente: tipoFrenteProp,
  onSuccess,
}: ListadoTransitionModalProps): ReactNode {
  const [motivo, setMotivo] = useState<string>('');
  const [selectedFrente, setSelectedFrente] = useState<TipoFrenteMaterial | ''>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const config = ACTION_CONFIG[action];

  // Identificar frentes elegibles para retroceder (estado SEPARADO o ENTREGADO)
  const frentesElegibles = (listado?.frentes ?? []).filter(
    (f) => f.estado === 'SEPARADO' || f.estado === 'ENTREGADO',
  );

  useEffect(() => {
    if (isOpen && listado) {
      setMotivo('');
      setIsSubmitting(false);
      setError(null);

      if (tipoFrenteProp) {
        setSelectedFrente(tipoFrenteProp);
      } else {
        const elegibles = (listado.frentes ?? []).filter(
          (f) => f.estado === 'SEPARADO' || f.estado === 'ENTREGADO',
        );
        if (elegibles.length > 0 && elegibles[0]) {
          setSelectedFrente(elegibles[0].tipoFrente);
        } else {
          setSelectedFrente('');
        }
      }
    }
  }, [isOpen, listado, tipoFrenteProp]);

  if (!listado) return null;

  const motivoTrimmed = motivo.trim();
  const isRetroceder = action === 'retroceder';
  const hasValidFrente = !isRetroceder || Boolean(selectedFrente);
  const isValid = motivoTrimmed.length >= 1 && motivoTrimmed.length <= 500 && hasValidFrente;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isRetroceder && !selectedFrente) {
      setError('Debe seleccionar el material a retroceder.');
      return;
    }
    if (!motivoTrimmed || motivoTrimmed.length > 500) {
      setError('El motivo debe tener entre 1 y 500 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let res;
      if (isRetroceder) {
        res = await listadosApi.retroceder(listado.id, {
          tipoFrente: selectedFrente as TipoFrenteMaterial,
          motivo: motivoTrimmed,
        });
      } else {
        res = await listadosApi.cancelar(listado.id, { motivo: motivoTrimmed });
      }

      if (res.success && res.data) {
        onSuccess(res.data);
        onClose();
      } else {
        setError(res.message || `Error al ${action} el listado.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Error inesperado al ${action} el listado.`;
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const frenteActual = (listado.frentes ?? []).find((f) => f.tipoFrente === selectedFrente);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader title={config.title} onClose={onClose} />
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <ModalBody className="space-y-4">
          {/* Info del listado afectado */}
          <div className="p-3.5 rounded-xl bg-cuadra-arena/30 border border-border flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <span className="text-2xs uppercase tracking-wider text-text-muted font-bold block">
                Listado de Producción
              </span>
              <span className="font-mono font-black text-base text-text-primary tracking-wide block truncate">
                {listado.numeroListado}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1 rounded-full bg-cuadra-arena text-text-primary border border-border/60 shrink-0">
              <Icon name="tag" size="12px" />
              {listado.lineaProduccion.nombre.toUpperCase()}
            </span>
          </div>

          <p className="text-xs text-text-secondary">{config.description}</p>

          {/* Selector de material a retroceder a Materiales Pendientes */}
          {isRetroceder && (
            <div className="space-y-1.5">
              <Label htmlFor="frenteSelect">
                Material a retroceder <span className="text-danger">*</span>
              </Label>
              {frentesElegibles.length === 1 ? (
                <div className="p-2.5 rounded-lg border border-border bg-app-surface flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-text-primary">
                      {TIPO_FRENTE_CONFIG[frentesElegibles[0].tipoFrente].nombre}
                    </span>
                  </div>
                  <FrenteStatusBadge estado={frentesElegibles[0].estado} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Select
                    id="frenteSelect"
                    value={selectedFrente}
                    onChange={(e) => setSelectedFrente(e.target.value as TipoFrenteMaterial)}
                    className="text-xs h-9"
                  >
                    <option value="">Selecciona el material a reiniciar...</option>
                    {frentesElegibles.map((f) => (
                      <option key={f.id} value={f.tipoFrente}>
                        {TIPO_FRENTE_CONFIG[f.tipoFrente].nombre} — {f.estado === 'SEPARADO' ? 'Separado' : 'Entregado'}
                      </option>
                    ))}
                  </Select>
                  {frenteActual && (
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-app-surface rounded-lg border border-border/60 text-2xs text-text-secondary">
                      <span className="font-medium">Estado actual:</span>
                      <FrenteStatusBadge estado={frenteActual.estado} />
                    </div>
                  )}
                </div>
              )}
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
                placeholder: 'Describe el motivo de la operación...',
                maxLength: 500,
                rows: 3,
              }}
            />
            <div className="flex items-center justify-between">
              <span
                className={`text-2xs ${
                  motivoTrimmed.length > 500 ? 'text-danger' : 'text-text-muted'
                }`}
              >
                {motivoTrimmed.length}/500 caracteres
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
