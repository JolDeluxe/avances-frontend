import { useState, useEffect, type ReactNode } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { TIPO_FRENTE_CONFIG } from '@/config/status-config';
import type { ListadoItem, TipoFrenteMaterial } from '../types/listados.types';

export type AccionOperativaAlmacen = 'separar' | 'entregar' | 'descontar';

export interface ListadoAccionModalProps {
  isOpen: boolean;
  onClose: () => void;
  listado: ListadoItem | null;
  tipoFrente: TipoFrenteMaterial;
  accion: AccionOperativaAlmacen;
  onConfirm: (opts: { entregarTambien?: boolean }) => Promise<void> | void;
  isSubmitting?: boolean;
}

/**
 * Modal de confirmación para acciones operativas de Almacén y Auditoría:
 * 1. SEPARAR FRENTE: Pregunta confirmación e incluye checkbox opcional (default false)
 *    para marcar también como entregado a producción inmediatamente.
 * 2. ENTREGAR FRENTE: Pregunta confirmación para la entrega final del frente (sin checkbox).
 * 3. DESCONTAR FRENTE: Pregunta confirmación para descontar en sistema/ERP con acento morado.
 */
export function ListadoAccionModal({
  isOpen,
  onClose,
  listado,
  tipoFrente,
  accion,
  onConfirm,
  isSubmitting = false,
}: ListadoAccionModalProps): ReactNode {
  const [entregarTambien, setEntregarTambien] = useState<boolean>(false);

  // Reiniciar checkbox cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setEntregarTambien(false);
    }
  }, [isOpen, accion, tipoFrente, listado?.id]);

  if (!listado) return null;

  const isSeparar = accion === 'separar';
  const isDescontar = accion === 'descontar';
  const frenteConfig = TIPO_FRENTE_CONFIG[tipoFrente];

  const handleConfirm = () => {
    onConfirm({ entregarTambien: isSeparar ? entregarTambien : false });
  };

  const modalTitle = isSeparar
    ? 'Confirmar Separación'
    : isDescontar
    ? 'Confirmar Descuento en Sistema'
    : 'Confirmar Entrega';

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader
        title={modalTitle}
        onClose={onClose}
      />
      <div className="flex flex-col flex-1 overflow-hidden">
        <ModalBody className="space-y-4">
          {/* Card de información del listado y frente */}
          <div className="p-3.5 rounded-xl bg-cuadra-arena/30 border border-border space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xs uppercase tracking-wider text-text-muted font-bold">
                Listado de Producción
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-full bg-cuadra-arena text-text-primary border border-border/60">
                <Icon name="tag" size="12px" />
                {listado.lineaProduccion.nombre.toUpperCase()}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono font-black text-base text-text-primary tracking-wide">
                {listado.numeroListado}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-app-surface text-brand-primary border border-brand-primary/30 shadow-2xs">
                  {frenteConfig.nombre}
                </span>
              </div>
            </div>
          </div>

          {/* Pregunta explicativa */}
          {isSeparar ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-brand-primary/5 border border-brand-primary/20 text-xs text-text-primary">
                <Icon name="inventory_2" size="sm" className="text-brand-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-brand-primary">¿Marcar materiales como separados?</p>
                  <p className="text-text-secondary text-2xs mt-0.5">
                    Se registrará que <strong>{frenteConfig.nombre}</strong> fueron apartados y surtidos en almacén.
                  </p>
                </div>
              </div>

              {/* Checkbox opcional de entrega inmediata a producción */}
              <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-app-surface hover:bg-cuadra-arena/20 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={entregarTambien}
                  onChange={(e) => setEntregarTambien(e.target.checked)}
                  disabled={isSubmitting}
                  className="rounded border-border text-brand-primary focus:ring-brand-primary h-4 w-4 shrink-0 cursor-pointer"
                />
                <span className="text-xs text-text-primary font-medium">
                  Marcar también como entregados a producción
                </span>
              </label>
            </div>
          ) : isDescontar ? (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 text-xs text-text-primary">
              <Icon name="done_all" size="sm" className="text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-purple-900 dark:text-purple-300">¿Confirmar descuento en sistema?</p>
                <p className="text-text-secondary text-2xs mt-0.5">
                  Confirmas que los materiales de <strong>{frenteConfig.nombre}</strong> ya fueron descontados en el sistema.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs text-text-primary">
              <Icon name="local_shipping" size="sm" className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">¿Confirmar entrega a producción?</p>
                <p className="text-text-secondary text-2xs mt-0.5">
                  Confirmas que <strong>{frenteConfig.nombre}</strong> ya se entregaron físicamente a piso de producción. Este es tu paso final de surtido.
                </p>
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>

          {isDescontar ? (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 min-w-[120px] justify-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="xs" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Icon name="done_all" size="xs" />
                  <span>Confirmar Descuento</span>
                </>
              )}
            </button>
          ) : (
            <Button
              type="button"
              variant={isSeparar ? 'primary' : 'success'}
              size="sm"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 min-w-[120px] justify-center"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="xs" />
                  <span>Procesando...</span>
                </>
              ) : isSeparar ? (
                entregarTambien ? (
                  <>
                    <Icon name="done_all" size="xs" />
                    <span>Separar y Entregar</span>
                  </>
                ) : (
                  <>
                    <Icon name="check" size="xs" />
                    <span>Confirmar Separación</span>
                  </>
                )
              ) : (
                <>
                  <Icon name="local_shipping" size="xs" />
                  <span>Confirmar Entrega</span>
                </>
              )}
            </Button>
          )}
        </ModalFooter>
      </div>
    </Modal>
  );
}
