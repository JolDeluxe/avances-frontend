import { useState, useEffect, useMemo, type ReactNode, type FormEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/components/ui/icon';
import { FrenteStatusBadge, ListadoStatusBadge } from '@/components/ui/status-badge';
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

const MOTIVOS_RETROCESO_LISTADO = [
  'Material faltante para completar el lote',
  'Material o piel no cumple especificación de calidad',
  'Ajuste en número de listado o componentes',
  'Cambio de programación en línea de producción',
  'Error en asignación o surtido de almacén',
  'Pausa o reasignación de la orden de producción',
];

const MOTIVOS_CANCELACION_LISTADO = [
  'Orden de producción cancelada',
  'Listado duplicado o sustituido',
  'Cambio mayor de modelo o ingeniería',
  'Error de captura en listado o línea',
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
      'Esta acción reinicia el estado de los materiales seleccionados y los manda directamente al inicio como Materiales Pendientes. Debe indicar el motivo del retroceso.',
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
 * Modal para transiciones de Listado que requieren motivo obligatorio: Retroceder y Cancelar.
 */
export function ListadoTransitionModal({
  isOpen,
  onClose,
  listado,
  action,
  tipoFrente: tipoFrenteProp,
  onSuccess,
}: ListadoTransitionModalProps): ReactNode {
  const [motivoSelect, setMotivoSelect] = useState<string>('');
  const [motivoDetalle, setMotivoDetalle] = useState<string>('');
  const [selectedFrente, setSelectedFrente] = useState<TipoFrenteMaterial | ''>('');
  const [confirmNumero, setConfirmNumero] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const config = ACTION_CONFIG[action];
  const isRetroceder = action === 'retroceder';
  const motivosPredefinidos = isRetroceder ? MOTIVOS_RETROCESO_LISTADO : MOTIVOS_CANCELACION_LISTADO;

  // Identificar si algún frente ya está en Separado en Almacén o entregado
  const tieneFrentesSeparados = useMemo(() => {
    return (listado?.frentes ?? []).some(
      (f) => f.estado === 'SEPARADO' || f.estado === 'ENTREGADO' || f.estado === 'DESCONTADO',
    );
  }, [listado?.frentes]);

  // Si se cancela y ya tiene frentes en Separado en Almacén, requiere escribir el número de listado
  const requiereConfirmacionNumero = action === 'cancelar' && tieneFrentesSeparados;

  // Identificar frentes elegibles para retroceder (estado SEPARADO o ENTREGADO)
  const frentesElegibles = useMemo(() => {
    return (listado?.frentes ?? []).filter(
      (f) => f.estado === 'SEPARADO' || f.estado === 'ENTREGADO',
    );
  }, [listado?.frentes]);

  useEffect(() => {
    if (isOpen && listado) {
      setMotivoSelect('');
      setMotivoDetalle('');
      setConfirmNumero('');
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

  const motivoFinal = useMemo(() => {
    if (motivoSelect === 'OTRO') {
      return motivoDetalle.trim();
    }
    return motivoSelect;
  }, [motivoSelect, motivoDetalle]);

  if (!listado) return null;

  const hasValidFrente = !isRetroceder || Boolean(selectedFrente);
  const isNumeroConfirmed =
    !requiereConfirmacionNumero || confirmNumero.trim() === listado.numeroListado.trim();
  const isMotivoValid =
    motivoSelect === 'OTRO'
      ? motivoDetalle.trim().length >= 5 && motivoDetalle.trim().length <= 500
      : Boolean(motivoSelect);
  const isValid = isMotivoValid && hasValidFrente && isNumeroConfirmed;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isRetroceder && !selectedFrente) {
      setError('Debe seleccionar el material a retroceder.');
      return;
    }
    if (requiereConfirmacionNumero && confirmNumero.trim() !== listado.numeroListado.trim()) {
      setError(`Debes escribir exactamente el número de listado (${listado.numeroListado}) para confirmar la cancelación.`);
      return;
    }
    if (!isMotivoValid) {
      setError('Debes seleccionar o especificar un motivo válido (mínimo 5 caracteres).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let res;
      if (isRetroceder) {
        res = await listadosApi.retroceder(listado.id, {
          tipoFrente: selectedFrente as TipoFrenteMaterial,
          motivo: motivoFinal,
        });
      } else {
        res = await listadosApi.cancelar(listado.id, { motivo: motivoFinal });
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
          <div className="p-3 rounded-xl bg-cuadra-arena/30 border border-border flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold block">
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

          <p className="text-xs text-text-secondary leading-relaxed">{config.description}</p>

          {/* Selector de material a retroceder a Materiales Pendientes */}
          {isRetroceder && (
            <div className="space-y-1.5">
              <Label htmlFor="frenteSelect" className="text-xs font-semibold">
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
              )}
            </div>
          )}

          {/* Resumen visual de la transición */}
          {isRetroceder && frenteActual && (
            <div className="p-3 bg-app-surface rounded-xl border border-border/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                <span>Transición ({TIPO_FRENTE_CONFIG[frenteActual.tipoFrente].nombre})</span>
                <span className="inline-flex items-center gap-1 text-warning-text font-medium">
                  <Icon name="history" size="12px" />
                  Reinicio a Pendientes
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-cuadra-arena/20 border border-border/40">
                <div className="flex-1 min-w-0 flex items-center justify-center">
                  <FrenteStatusBadge estado={frenteActual.estado} className="shadow-2xs" />
                </div>
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-app-surface border border-border shadow-2xs shrink-0 text-text-muted">
                  <Icon name="arrow_forward" size="14px" />
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-center">
                  <FrenteStatusBadge estado="PENDIENTE" className="shadow-2xs" />
                </div>
              </div>
            </div>
          )}

          {!isRetroceder && (
            <div className="p-3 bg-app-surface rounded-xl border border-border/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                <span>Transición de Estado</span>
              </div>
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-cuadra-arena/20 border border-border/40">
                <div className="flex-1 min-w-0 flex items-center justify-center">
                  <ListadoStatusBadge estado={listado.estado} className="shadow-2xs" />
                </div>
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-app-surface border border-border shadow-2xs shrink-0 text-text-muted">
                  <Icon name="arrow_forward" size="14px" />
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-center">
                  <ListadoStatusBadge estado="CANCELADO" className="shadow-2xs" />
                </div>
              </div>
            </div>
          )}

          {/* Confirmación explícita con número de listado si ya está en Separado en Almacén */}
          {requiereConfirmacionNumero && (
            <div className="p-3.5 rounded-xl border border-warning/40 bg-warning-subtle/50 space-y-2">
              <div className="flex items-start gap-2">
                <Icon name="warning" size="sm" className="text-warning-text shrink-0 mt-0.5" />
                <div className="text-xs text-warning-text leading-relaxed">
                  Este listado ya cuenta con materiales en <strong>Separado en Almacén</strong>. Para autorizar la cancelación, escribe el número de listado:{' '}
                  <span className="font-mono font-bold bg-app-surface px-1.5 py-0.5 rounded border border-border/80 text-text-primary select-all">
                    {listado.numeroListado}
                  </span>
                </div>
              </div>
              <div className="space-y-1 pt-1">
                <Label htmlFor="confirmNumero" className="text-[10px] font-bold text-text-primary">
                  Escribe el número de listado para confirmar:
                </Label>
                <Input
                  id="confirmNumero"
                  type="text"
                  value={confirmNumero}
                  onChange={(e) => setConfirmNumero(e.target.value)}
                  placeholder={`Ej: ${listado.numeroListado}`}
                  className="font-mono text-xs h-9 bg-app-surface"
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
