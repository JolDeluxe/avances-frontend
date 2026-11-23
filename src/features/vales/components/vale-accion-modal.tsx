import { useState, useEffect, type ReactNode } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { PERMISOS } from '@/config/permissions';
import { valesApi } from '../api/vales-api';
import type { ValeItem } from '../types/vales.types';

export type TipoAccionVale = 'separar' | 'entregar' | 'descontar';

export interface ValeAccionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedItem: ValeItem) => void;
  vale: ValeItem | null;
  accion: TipoAccionVale | null;
}

/**
 * Modal de confirmación para avanzar estado de un Vale (Separar, Entregar, Descontar).
 */
export function ValeAccionModal({
  isOpen,
  onClose,
  onSuccess,
  vale,
  accion,
}: ValeAccionModalProps): ReactNode {
  const { can } = usePermissions();
  const canEntregar = can(PERMISOS.VALE_ENTREGAR);

  const [entregarTambien, setEntregarTambien] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEntregarTambien(false);
      setError(null);
    }
  }, [isOpen, vale, accion]);

  if (!isOpen || !vale || !accion) return null;

  const isSeparar = accion === 'separar';
  const isEntregar = accion === 'entregar';
  const isDescontar = accion === 'descontar';
  const valeLabel = vale.folio;

  const handleConfirm = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      let updated: ValeItem;

      if (isSeparar) {
        updated = await valesApi.separarVale(vale.id, {
          ...(canEntregar && entregarTambien ? { entregarTambien: true } : {}),
        });
      } else if (isEntregar) {
        updated = await valesApi.entregarVale(vale.id);
      } else {
        updated = await valesApi.descontarVale(vale.id);
      }

      onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al procesar la acción.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = isSeparar
    ? `Separar Vale ${valeLabel}`
    : isEntregar
      ? `Entregar Vale ${valeLabel} a Producción`
      : `Descontar Vale ${valeLabel} en Sistema`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader title={modalTitle} onClose={onClose} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <ModalBody className="space-y-4">
          {/* Resumen del Vale */}
          <div className="p-3.5 rounded-xl bg-cuadra-arena/30 border border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {vale.serie?.codigo && (
                <span className="font-mono font-bold text-text-secondary text-xs bg-app-surface px-2 py-0.5 rounded-md border border-border">
                  {vale.serie.codigo}
                </span>
              )}
              <span className="font-mono font-bold text-text-primary text-sm bg-app-surface px-2.5 py-0.5 rounded-md border border-border">
                {vale.folio}
              </span>
            </div>
            <span className="text-xs text-text-secondary font-semibold">
              {vale.departamentoVale?.nombre}
            </span>
          </div>

          {isSeparar && (
            <div className="space-y-3.5">
              <p className="text-xs text-text-secondary leading-relaxed">
                ¿Confirmas marcar el vale <strong>{valeLabel}</strong> como separado en almacén?
              </p>

              {canEntregar && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-app-surface hover:bg-cuadra-arena/20 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={entregarTambien}
                    onChange={(e) => setEntregarTambien(e.target.checked)}
                    disabled={isSubmitting}
                    className="mt-0.5 rounded border-border text-brand-primary focus:ring-brand-primary h-4 w-4 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-text-primary block">
                      Marcar también como entregado a producción
                    </span>
                    <span className="text-text-muted text-[11px] block mt-0.5">
                      Si el material ya fue entregado físicamente, activa esta casilla para
                      registrar ambos pasos a la vez.
                    </span>
                  </div>
                </label>
              )}
            </div>
          )}

          {isEntregar && (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary leading-relaxed">
                ¿Confirmas la entrega a producción del vale <strong>{valeLabel}</strong>?
              </p>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-300/60 flex items-center gap-2 text-xs text-emerald-800">
                <Icon name="local_shipping" size="sm" className="text-emerald-600 shrink-0" />
                <span>
                  El vale quedará registrado como entregado y pasará a la bandeja de Auditoría.
                </span>
              </div>
            </div>
          )}

          {isDescontar && (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary leading-relaxed">
                ¿Confirmas registrar el descuento en sistema del vale <strong>{valeLabel}</strong>?
              </p>
              <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-300/60 flex items-start gap-2 text-xs text-purple-800">
                <Icon name="done_all" size="sm" className="text-purple-600 shrink-0 mt-0.5" />
                <span>
                  Esta acción confirma en la aplicación que el descuento ya fue realizado
                  externamente en el sistema.
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 flex items-center gap-2 text-xs text-danger font-medium">
              <Icon name="error" size="sm" className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </ModalBody>

        <ModalFooter className="flex items-center justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant={isDescontar ? 'outline' : 'primary'}
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={
              isDescontar
                ? 'bg-purple-600 hover:bg-purple-700 text-white border-purple-600 gap-1.5'
                : isEntregar || entregarTambien
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5'
                  : 'gap-1.5'
            }
          >
            {isSubmitting ? (
              <>
                <Spinner size="xs" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <Icon
                  name={
                    isDescontar
                      ? 'done_all'
                      : isEntregar || entregarTambien
                        ? 'local_shipping'
                        : 'check'
                  }
                  size="14px"
                  weight={700}
                />
                <span>
                  {isDescontar
                    ? 'Descontar en sistema'
                    : isEntregar || entregarTambien
                      ? 'Entregar a producción'
                      : 'Separar'}
                </span>
              </>
            )}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
