import { useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { usersApi } from '../api/users-api';
import type { UsuarioItem } from '../types/users.types';

export interface UserResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UsuarioItem | null;
  onSuccess: () => void;
}

export function UserResetPasswordModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: UserResetPasswordModalProps): ReactNode {
  const [newPassword, setNewPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      setNewPassword('');
      setShowPassword(false);
      setIsSubmitting(false);
      setError(null);
      setCopied(false);
    }
  }, [isOpen]);

  if (!user) return null;

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let generated = '';
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(generated);
    setShowPassword(true);
  };

  const handleCopy = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await usersApi.resetPassword(user.id, {
        passwordNueva: newPassword,
      });

      if (response.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.message || 'No se pudo restablecer la contraseña.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al restablecer contraseña.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader title="Restablecer Contraseña" onClose={onClose} />
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <ModalBody className="space-y-4">
          <p className="text-xs text-text-secondary -mt-2">
            Asigna una nueva clave de acceso para el usuario <strong className="text-text-primary">{user.usuario}</strong>.
          </p>

          <div className="p-3 bg-app-surface-muted/50 rounded-lg border border-border text-xs text-text-secondary flex items-start gap-2">
            <Icon name="info" size="xs" className="text-marca-primario mt-0.5 shrink-0" />
            <span>
              Al guardar, se revocarán todas las sesiones activas del usuario y deberá iniciar sesión con la nueva contraseña.
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="passwordNueva">Nueva Contraseña</Label>
              <button
                type="button"
                onClick={generatePassword}
                className="text-xs text-marca-primario hover:underline font-medium flex items-center gap-1 transition-colors"
              >
                <Icon name="casino" size="xs" />
                Generar segura
              </button>
            </div>

            <div className="relative">
              <Input
                id="passwordNueva"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                className="pr-20 font-mono text-sm"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                {newPassword && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1 text-text-muted hover:text-text-primary rounded transition-colors"
                    title="Copiar contraseña"
                  >
                    <Icon name={copied ? 'check' : 'content_copy'} size="xs" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-text-muted hover:text-text-primary rounded transition-colors"
                  title={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} size="xs" />
                </button>
              </div>
            </div>
            {copied && (
              <span className="text-2xs text-success font-medium block">¡Copiada al portapapeles!</span>
            )}
          </div>

          {error && <p className="text-xs text-danger font-medium">{error}</p>}
        </ModalBody>

        <ModalFooter className="flex items-center justify-end gap-3">
          <Button type="button" variant="cancelar" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="guardar" disabled={isSubmitting || !newPassword}>
            {isSubmitting ? (
              <>
                <Spinner size="18px" className="mr-2" />
                Guardando...
              </>
            ) : (
              'Guardar Contraseña'
            )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
