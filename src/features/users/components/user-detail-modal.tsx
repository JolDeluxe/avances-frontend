import { useState, useEffect, type ReactNode } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { usersApi } from '../api/users-api';
import { UserStatusBadge, UserRoleBadge, UserSegmentacionBadge } from './user-status-badge';
import type { UsuarioItem } from '../types/users.types';
import { usePermissions } from '@/shared/hooks/use-permissions';

export interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UsuarioItem | null;
  onEdit?: (user: UsuarioItem) => void;
  onResetPassword?: (user: UsuarioItem) => void;
}

export function UserDetailModal({
  isOpen,
  onClose,
  user,
  onEdit,
  onResetPassword,
}: UserDetailModalProps): ReactNode {
  const { hasPermission } = usePermissions();
  const canSeePassword = hasPermission('usuario:password:ver');
  const canEdit = hasPermission('usuario:editar');

  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState<boolean>(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedUser, setCopiedUser] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Clear state when modal closes or user changes
  useEffect(() => {
    if (!isOpen) {
      setRevealedPassword(null);
      setIsRevealing(false);
      setRevealError(null);
      setCopied(false);
      setCopiedUser(false);
      setSecondsLeft(0);
    }
  }, [isOpen, user?.id]);

  // Countdown timer for revealed password security auto-hide
  useEffect(() => {
    if (secondsLeft > 0) {
      const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (secondsLeft === 0 && revealedPassword) {
      setRevealedPassword(null);
    }
  }, [secondsLeft, revealedPassword]);

  if (!user) return null;

  const handleRevealPassword = async () => {
    if (revealedPassword) {
      setRevealedPassword(null);
      setSecondsLeft(0);
      return;
    }

    setIsRevealing(true);
    setRevealError(null);
    try {
      const response = await usersApi.getRevealedPassword(user.id);
      const pass = response.data?.password || response.data?.passwordActual;
      if (response.success && pass) {
        setRevealedPassword(pass);
        setSecondsLeft(30); // 30 seconds auto-hide for security
      } else {
        setRevealError(response.message || 'No fue posible revelar la contraseña.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al consultar contraseña revelable.';
      setRevealError(msg);
    } finally {
      setIsRevealing(false);
    }
  };

  const handleCopyPassword = () => {
    if (!revealedPassword) return;
    navigator.clipboard.writeText(revealedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyUser = () => {
    navigator.clipboard.writeText(user.usuario);
    setCopiedUser(true);
    setTimeout(() => setCopiedUser(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-xl">
      <ModalHeader title="Ficha Detallada del Usuario" onClose={onClose} />
      <ModalBody className="space-y-6">
        <p className="text-xs text-text-secondary -mt-2">
          Consulta la información general, asignaciones y credenciales del usuario.
        </p>
        {/* User Header Card */}
        <div className="flex items-center gap-4 pb-5 border-b border-border">
          <div className="w-14 h-14 rounded-full bg-marca-primario/10 text-marca-primario flex items-center justify-center font-bold text-xl shrink-0 border border-marca-primario/20">
            {user.nombre
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-semibold text-text-primary text-lg font-sans">
                {user.nombre}
              </h3>
              <UserStatusBadge estado={user.estado} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-text-secondary font-mono">{user.usuario}</span>
              <button
                type="button"
                onClick={handleCopyUser}
                className="text-text-muted hover:text-text-primary text-xs flex items-center gap-1 transition-colors ml-1"
                title="Copiar usuario"
              >
                <Icon name={copiedUser ? 'check' : 'content_copy'} size="13px" />
                <span>{copiedUser ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Datos Principales en Formato Clave - Valor */}
        <div className="rounded-xl border border-border bg-app-surface overflow-hidden divide-y divide-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-1 hover:bg-app-surface-muted/30 transition-colors">
            <span className="text-xs uppercase tracking-wider font-semibold text-text-muted">
              Departamento
            </span>
            <span className="text-sm font-medium text-text-primary">
              {user.departamento?.nombre || 'General / Sin departamento'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-1 hover:bg-app-surface-muted/30 transition-colors">
            <span className="text-xs uppercase tracking-wider font-semibold text-text-muted">
              Rol
            </span>
            <div>
              <UserRoleBadge rolCodigo={user.rol?.codigo} />
            </div>
          </div>

          {(user.tipoSurtidoAlmacen || user.tipoMaterialAuditor || user.rol?.codigo) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-1 hover:bg-app-surface-muted/30 transition-colors">
              <span className="text-xs uppercase tracking-wider font-semibold text-text-muted">
                Segmentación Operativa
              </span>
              <div>
                <UserSegmentacionBadge
                  tipoSurtidoAlmacen={user.tipoSurtidoAlmacen}
                  tipoMaterialAuditor={user.tipoMaterialAuditor}
                  rolCodigo={user.rol?.codigo}
                />
              </div>
            </div>
          )}

          {user.lineasAsignadas && user.lineasAsignadas.length > 0 && (
            <div className="p-3.5 space-y-2 hover:bg-app-surface-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-text-muted">
                  Líneas de Producción Autorizadas
                </span>
                <span className="text-xs text-text-secondary font-medium">
                  {user.lineasAsignadas.length} asignada(s)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {user.lineasAsignadas.map((linea) => (
                  <span
                    key={linea.id}
                    className="inline-flex items-center text-xs font-medium text-text-primary bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded border border-border"
                  >
                    {linea.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Credentials & Password Reveal Section */}
        {canSeePassword && user.rol?.codigo !== 'SUPER_ADMIN' && (
          <div className="p-3.5 rounded-lg border border-border bg-app-surface-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="key" size="xs" className="text-text-secondary" />
                <span className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
                  Contraseña Actual
                </span>
              </div>
              {secondsLeft > 0 && (
                <span className="text-2xs font-mono px-2 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
                  Ocultando en {secondsLeft}s
                </span>
              )}
            </div>

            {revealedPassword ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-app-surface rounded-lg border border-border font-mono text-sm">
                <span className="select-all font-semibold text-marca-primario">
                  {revealedPassword}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPassword}
                    className="h-8 px-2.5 text-xs"
                  >
                    <Icon name={copied ? 'check' : 'content_copy'} size="xs" className="mr-1" />
                    {copied ? 'Copiada' : 'Copiar'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRevealedPassword(null);
                      setSecondsLeft(0);
                    }}
                    className="h-8 px-2 text-xs"
                    title="Ocultar"
                  >
                    <Icon name="visibility_off" size="xs" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-muted">
                  La contraseña se mantiene cifrada. Puedes revelarla temporalmente con fines de soporte.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRevealPassword}
                  disabled={isRevealing}
                  className="h-8 px-3 text-xs whitespace-nowrap"
                >
                  {isRevealing ? (
                    <Spinner size="xs" className="mr-1.5" />
                  ) : (
                    <Icon name="visibility" size="xs" className="mr-1.5" />
                  )}
                  {isRevealing ? 'Consultando...' : 'Revelar'}
                </Button>
              </div>
            )}

            {revealError && (
              <p className="text-xs text-danger font-medium">{revealError}</p>
            )}
          </div>
        )}

      </ModalBody>

      <ModalFooter className="flex items-center justify-between">
        <Button type="button" variant="cancelar" onClick={onClose}>
          Cerrar
        </Button>

        <div className="flex items-center gap-2">
          {canEdit && onResetPassword && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                onResetPassword(user);
              }}
            >
              <Icon name="lock_reset" size="xs" className="mr-1.5" />
              Restablecer Contraseña
            </Button>
          )}
          {canEdit && onEdit && (
            <Button
              type="button"
              variant="accion"
              onClick={() => {
                onClose();
                onEdit(user);
              }}
            >
              <Icon name="edit" size="xs" className="mr-1.5" />
              Editar Usuario
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
}
