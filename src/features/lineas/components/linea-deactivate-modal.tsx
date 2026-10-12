import { useState, type ReactNode } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import type { LineaProduccionItem } from '../types/lineas.types';

export interface LineaDeactivateModalProps {
  isOpen: boolean;
  onClose: () => void;
  linea: LineaProduccionItem | null;
  onConfirm: () => Promise<void>;
}

export function LineaDeactivateModal({
  isOpen,
  onClose,
  linea,
  onConfirm,
}: LineaDeactivateModalProps): ReactNode {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !linea) return null;

  const isDeactivating = linea.estado === 'ACTIVO';

  const handleAction = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al procesar la solicitud.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader
        title={isDeactivating ? 'Inactivar Línea / Maquila' : 'Reactivar Línea / Maquila'}
        onClose={onClose}
      />
      <ModalBody className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2">
            <Icon name="error" size="xs" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isDeactivating ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
            }`}
          >
            <Icon name={isDeactivating ? 'power_settings_new' : 'check_circle'} size="sm" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-text-primary">
              ¿Confirmas {isDeactivating ? 'inactivar' : 'reactivar'} la línea / maquila{' '}
              <span className="font-bold text-marca-primario">{linea.nombre.toUpperCase()}</span>?
            </p>
            <p className="text-xs text-text-secondary">
              {isDeactivating
                ? 'Dejará de estar disponible para nuevos listados de material. Los listados existentes conservarán su historial.'
                : 'Volverá a estar habilitada para la recepción de listados de producción.'}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-cuadra-arena/40 border border-border text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-text-muted">Nombre:</span>
            <span className="font-semibold text-text-primary">{linea.nombre.toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Departamento:</span>
            <span className="font-semibold text-text-primary">{(linea.departamentoNombre || '—').toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Área:</span>
            <span className="font-bold text-text-primary">{linea.area.toUpperCase()}</span>
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="cancelar" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          variant={isDeactivating ? 'danger' : 'guardar'}
          onClick={handleAction}
          disabled={isSubmitting}
          icon={isSubmitting ? undefined : isDeactivating ? 'power_settings_new' : 'check_circle'}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Spinner size="xs" />
              Procesando...
            </span>
          ) : isDeactivating ? (
            'Inactivar Línea'
          ) : (
            'Reactivar Línea'
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
