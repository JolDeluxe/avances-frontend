import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { UserStatusBadge, UserRoleBadge, UserSegmentacionBadge } from './user-status-badge';
import type { UsuarioItem } from '../types/users.types';
import { usePermissions } from '@/shared/hooks/use-permissions';

export interface UserCardProps {
  user: UsuarioItem;
  onView: (user: UsuarioItem) => void;
  onEdit: (user: UsuarioItem) => void;
  onResetPassword: (user: UsuarioItem) => void;
  onDeactivate: (user: UsuarioItem) => void;
  onReactivate: (user: UsuarioItem) => void;
}

export function UserCard({
  user,
  onView,
  onEdit,
  onResetPassword,
  onDeactivate,
  onReactivate,
}: UserCardProps): ReactNode {
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('usuario:editar');
  const canDelete = hasPermission('usuario:eliminar');
  const isSuperAdmin = user.rol.codigo === 'SUPER_ADMIN';

  return (
    <div className="bg-app-surface border border-border rounded-xl p-4 shadow-2xs space-y-3.5 hover:border-marca-primario/30 transition-all">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-marca-primario/10 text-marca-primario flex items-center justify-center font-bold text-sm">
            {user.nombre
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-text-primary font-sans leading-tight">
              {user.nombre}
            </h4>
            <span className="text-xs text-text-secondary font-mono">{user.usuario}</span>
          </div>
        </div>
        <UserStatusBadge estado={user.estado} />
      </div>

      {/* Info Pills */}
      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-border/60">
        <div>
          <span className="text-text-muted block text-2xs uppercase">Rol</span>
          <div className="mt-0.5">
            <UserRoleBadge rolCodigo={user.rol.codigo} />
          </div>
        </div>

        <div>
          <span className="text-text-muted block text-2xs uppercase">Departamento</span>
          <span className="font-medium text-text-secondary truncate block mt-0.5">
            {user.departamento?.nombre || 'General'}
          </span>
        </div>
      </div>

      {/* Segmentación Operativa */}
      {(user.tipoSurtidoAlmacen || user.tipoMaterialAuditor) && (
        <div className="text-xs pt-1 border-t border-border/40">
          <span className="text-text-muted block text-2xs uppercase mb-1">Segmentación Operativa</span>
          <UserSegmentacionBadge
            tipoSurtidoAlmacen={user.tipoSurtidoAlmacen}
            tipoMaterialAuditor={user.tipoMaterialAuditor}
            rolCodigo={user.rol.codigo}
          />
        </div>
      )}

      {/* Lines if Almacenista */}
      {user.rol?.codigo === 'ALMACENISTA' && user.lineasAsignadas && user.lineasAsignadas.length > 0 && (
        <div className="text-xs pt-1">
          <span className="text-text-muted block text-2xs uppercase mb-0.5">Líneas Asignadas</span>
          <p className="text-xs text-text-secondary truncate">
            {user.lineasAsignadas.map((l) => l.nombre).join(', ')}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(user)}
          className="h-8 px-2.5 text-xs text-text-secondary hover:text-text-primary"
          title="Ver detalle de usuario"
        >
          <Icon name="visibility" size="xs" className="mr-1" />
          Ver
        </Button>

        {canEdit && !isSuperAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResetPassword(user)}
            className="h-8 px-2 text-xs text-text-secondary hover:text-text-primary"
            title="Restablecer contraseña"
          >
            <Icon name="lock_reset" size="xs" />
          </Button>
        )}

        {canEdit && !isSuperAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(user)}
            className="h-8 px-2 text-xs text-text-secondary hover:text-text-primary"
            title="Editar usuario"
          >
            <Icon name="edit" size="xs" />
          </Button>
        )}

        {canDelete && !isSuperAdmin && (
          user.estado === 'ACTIVO' ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeactivate(user)}
              className="h-8 px-2 text-xs text-danger hover:bg-danger/10"
              title="Desactivar usuario"
            >
              <Icon name="person_off" size="xs" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReactivate(user)}
              className="h-8 px-2 text-xs text-success hover:bg-success/10"
              title="Reactivar usuario"
            >
              <Icon name="person_add" size="xs" />
            </Button>
          )
        )}
      </div>
    </div>
  );
}
