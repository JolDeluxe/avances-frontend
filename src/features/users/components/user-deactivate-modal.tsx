import { useState, type ReactNode } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { usersApi } from '../api/users-api';
import type { UsuarioItem } from '../types/users.types';

export interface UserDeactivateModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UsuarioItem | null;
  onSuccess: () => void;
}

export function UserDeactivateModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: UserDeactivateModalProps): ReactNode {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleDeactivate = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await usersApi.deleteUser(user.id);
      if (response.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.message || 'No fue posible desactivar el usuario.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al desactivar usuario.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader title="Desactivar Usuario" onClose={onClose} />
      <ModalBody className="space-y-4">
        <div className="p-4 rounded-xl bg-danger/5 border border-danger/20 space-y-2">
          <div className="flex items-center gap-2 text-danger font-medium text-sm">
            <Icon name="warning" size="sm" />
            <span>Acción de Desactivación Lógica</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            El usuario <strong className="text-text-primary">{user.nombre}</strong> ({user.usuario}) no podrá volver a iniciar sesión y todas sus sesiones activas serán revocadas inmediatamente.
          </p>
          <p className="text-xs text-text-muted">
            Los datos históricos, auditorías y trazabilidad se preservan intactos. Podrás reactivarlo en cualquier momento desde la pestaña de Inactivos.
          </p>
        </div>

        {error && <p className="text-xs text-danger font-medium">{error}</p>}
      </ModalBody>

      <ModalFooter className="flex items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleDeactivate}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Spinner size="18px" className="mr-2" />
              Desactivando...
            </>
          ) : (
            'Desactivar Usuario'
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
