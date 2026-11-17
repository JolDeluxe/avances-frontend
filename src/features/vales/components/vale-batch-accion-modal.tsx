import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { PERMISOS } from '@/config/permissions';
import { valesApi } from '../api/vales-api';
import type { BatchAccionVale, EstadoVale, ValeItem } from '../types/vales.types';
import type { TipoAccionVale } from './vale-accion-modal';

export interface ValeBatchAccionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (procesadosIds: number[], estadoNuevo: EstadoVale) => void;
  vales: ValeItem[];
  accion: TipoAccionVale | null;
}

/**
 * Modal estilizado y compacto para operaciones masivas (Batch) en Vales.
 */
export function ValeBatchAccionModal({
  isOpen,
  onClose,
  onSuccess,
  vales,
  accion,
}: ValeBatchAccionModalProps): ReactNode {
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
  }, [isOpen, accion, vales]);

  const eligibleVales = useMemo(() => {
    if (!accion) return [];
    return vales.filter((item) => {
      if (accion === 'separar') return item.estado === 'PENDIENTE';
      if (accion === 'entregar') return item.estado === 'SEPARADO';
      if (accion === 'descontar') return item.estado === 'ENTREGADO';
      return false;
    });
  }, [vales, accion]);

  if (!isOpen || !accion) return null;

  const isSeparar = accion === 'separar';
  const isEntregar = accion === 'entregar';
  const isDescontar = accion === 'descontar';

  const count = eligibleVales.length;
  const omittedCount = vales.length - count;

  const handleConfirm = async () => {
    if (count === 0) return;
    setError(null);
    setIsSubmitting(true);

    try {
      let batchAccion: BatchAccionVale;
      if (isSeparar) {
        batchAccion = canEntregar && entregarTambien ? 'SEPARAR_Y_ENTREGAR' : 'SEPARAR';
      } else if (isEntregar) {
        batchAccion = 'ENTREGAR';
      } else {
        batchAccion = 'DESCONTAR';
      }

      const res = await valesApi.batchOperar({
        valeIds: eligibleVales.map((v) => v.id),
        accion: batchAccion,
      });

      onSuccess(res.valeIds, res.estadoNuevo);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al ejecutar la operación masiva de vales.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = isSeparar
    ? `Separar ${count} vales`
    : isEntregar
      ? `Entregar ${count} vales a producción`
      : `Descontar ${count} vales en sistema`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader title={modalTitle} onClose={onClose} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <ModalBody className="space-y-3.5 py-3">
          {/* Cabecera compacta del lote */}
          <div className="flex items-center justify-between gap-2 px-1 text-xs">
            <span className="font-semibold text-text-secondary">
              <strong className="text-text-primary">Vales de Material</strong>
            </span>
            <span className="text-2xs font-bold text-text-muted bg-cuadra-arena/50 px-2 py-0.5 rounded-full border border-border/60">
              {count} {count === 1 ? 'elegible' : 'elegibles'}{' '}
              {omittedCount > 0 ? `(${omittedCount} no aplican)` : ''}
            </span>
          </div>

          {/* Contenedor elegante de vales seleccionados */}
          <div className="rounded-lg border border-border bg-app-surface overflow-hidden shadow-2xs">
            <div className="px-3 py-1.5 bg-cuadra-arena/30 border-b border-border/70 flex items-center justify-between text-2xs">
              <span className="font-semibold text-text-secondary uppercase tracking-wider">
                Vales a procesar
              </span>
              <span className="font-mono font-bold text-text-primary">
                {count} {count === 1 ? 'vale' : 'vales'}
              </span>
            </div>

            <div className="max-h-36 overflow-y-auto divide-y divide-border/50 custom-scrollbar">
              {eligibleVales.length > 0 ? (
                eligibleVales.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-cuadra-arena/20 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xs font-mono text-text-muted w-4 shrink-0 text-right">
                        {idx + 1}.
                      </span>
                      {item.serie?.codigo && (
                        <span className="font-mono font-semibold text-text-secondary text-2xs">
                          {item.serie.codigo}
                        </span>
                      )}
                      <span className="font-mono font-bold text-text-primary truncate">
                        {item.folio}
                      </span>
                    </div>
                    <span className="text-2xs text-text-secondary font-medium shrink-0 ml-2">
                      {item.departamentoVale?.nombre ?? ''}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-text-muted italic">
                  Ninguno de los vales seleccionados se encuentra en el estado requerido para esta
                  acción.
                </div>
              )}
            </div>
          </div>

          {omittedCount > 0 && (
            <p className="text-[11px] text-amber-700 bg-amber-500/10 border border-amber-300/60 rounded-md p-1.5 leading-tight">
              {omittedCount} vale{omittedCount > 1 ? 's fueron omitidos' : ' fue omitido'} porque su
              estado ya avanzó o no corresponde a esta acción.
            </p>
          )}

          {/* Mensaje descriptivo conciso según acción */}
          {isSeparar && (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary leading-relaxed">
                ¿Confirmas marcar los vales elegibles como <strong>separados en almacén</strong>?
              </p>

              {canEntregar && (
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-app-surface hover:bg-cuadra-arena/20 transition-colors cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={entregarTambien}
                    onChange={(e) => setEntregarTambien(e.target.checked)}
                    disabled={isSubmitting || count === 0}
                    className="rounded border-border text-brand-primary focus:ring-brand-primary h-4 w-4 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs text-text-primary font-medium">
                    Marcar también como entregados a producción
                  </span>
                </label>
              )}
            </div>
          )}

          {isEntregar && (
            <p className="text-xs text-text-secondary leading-relaxed">
              ¿Confirmas la entrega a producción de los vales seleccionados? Quedarán disponibles
              para validación de Auditoría.
            </p>
          )}

          {isDescontar && (
            <div className="space-y-2">
              <p className="text-xs text-text-secondary leading-relaxed">
                ¿Confirmas el descuento en sistema para los vales elegibles?
              </p>
              <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-300/60 flex items-start gap-2 text-[11px] text-purple-800">
                <Icon name="done_all" size="xs" className="text-purple-600 shrink-0 mt-0.5" />
                <span>
                  Esta acción confirma que el descuento ya fue realizado externamente en el ERP.
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-danger/10 border border-danger/20 flex items-center gap-2 text-xs text-danger font-medium">
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
            disabled={isSubmitting || count === 0}
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
                    ? `Descontar en sistema (${count})`
                    : isEntregar || entregarTambien
                      ? `Entregar a producción (${count})`
                      : `Separar (${count})`}
                </span>
              </>
            )}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
