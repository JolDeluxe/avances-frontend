import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Icon } from '@/components/ui/icon';
import { Table, type Column } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { useUsers } from '../hooks/use-users';
import { useUserCatalogs } from '../hooks/use-user-catalogs';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { UserStatusBadge, UserRoleBadge, UserSegmentacionBadge } from '../components/user-status-badge';
import { UserCard } from '../components/user-card';
import { UserDetailModal } from '../components/user-detail-modal';
import { UserFormModal } from '../components/user-form-modal';
import { UserResetPasswordModal } from '../components/user-reset-password-modal';
import { UserDeactivateModal } from '../components/user-deactivate-modal';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { usersApi } from '../api/users-api';
import type { UsuarioItem } from '../types/users.types';

export function UsersPage(): ReactNode {
  const { currentUser } = useAuth();
  const isSuperAdminActor = currentUser?.rol === 'SUPER_ADMIN';
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('usuario:crear');
  const canEdit = hasPermission('usuario:editar');
  const canDelete = hasPermission('usuario:eliminar');

  const {
    users,
    total,
    pagina,
    limite,
    totalPaginas,
    statsPorRol,
    isLoading,
    error,
    reloadUsers,
    searchTerm,
    setSearchTerm,
    estado,
    setEstado,
    rolId,
    setRolId,
    departamentoId,
    setDepartamentoId,
    setPagina,
    resetFilters,
  } = useUsers();

  const { roles, departamentos } = useUserCatalogs();

  // Modals state
  const [selectedUser, setSelectedUser] = useState<UsuarioItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formUser, setFormUser] = useState<UsuarioItem | null>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState<boolean>(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState<boolean>(false);

  // Success banner / toast feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Handlers
  const handleOpenDetail = (user: UsuarioItem) => {
    setSelectedUser(user);
    setIsDetailOpen(true);
  };

  const handleOpenCreate = () => {
    setFormUser(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: UsuarioItem) => {
    setFormUser(user);
    setIsFormOpen(true);
  };

  const handleOpenResetPassword = (user: UsuarioItem) => {
    setSelectedUser(user);
    setIsResetPasswordOpen(true);
  };

  const handleOpenDeactivate = (user: UsuarioItem) => {
    setSelectedUser(user);
    setIsDeactivateOpen(true);
  };

  const handleReactivate = async (user: UsuarioItem) => {
    try {
      const res = await usersApi.reactivateUser(user.id);
      if (res.success) {
        showFeedback('success', `Usuario ${user.usuario} reactivado con éxito.`);
        reloadUsers();
      } else {
        showFeedback('error', res.message || 'Error al reactivar usuario.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al reactivar usuario.';
      showFeedback('error', msg);
    }
  };

  // Catalog role lookups for interactive KPI card filters
  const adminRoleIds = roles
    .filter((r) => r.codigo === 'ADMIN' || r.codigo === 'SUPER_ADMIN')
    .map((r) => r.id);
  const adminPrimaryRole = roles.find((r) => r.codigo === 'ADMIN') || roles.find((r) => r.codigo === 'SUPER_ADMIN');
  const almacenistaRole = roles.find((r) => r.codigo === 'ALMACENISTA');
  const auditorRole = roles.find((r) => r.codigo === 'AUDITOR');
  const registradorRole = roles.find((r) => r.codigo === 'REGISTRADOR');

  // Quick stats calculations for existing roles:
  // Se utiliza statsPorRol proveniente del backend para que al filtrar por un rol específico (ej. REGISTRADOR),
  // los contadores de los demás roles no se vayan a 0 en el Summary Bar.
  const totalSummary = statsPorRol?.TOTAL ?? total;
  const countAdmins = statsPorRol?.ADMIN ?? users.filter((u) => u.rol?.codigo === 'ADMIN' || u.rol?.codigo === 'SUPER_ADMIN').length;
  const countAlmacenistas = statsPorRol?.ALMACENISTA ?? users.filter((u) => u.rol?.codigo === 'ALMACENISTA').length;
  const countAuditores = statsPorRol?.AUDITOR ?? users.filter((u) => u.rol?.codigo === 'AUDITOR').length;
  const countRegistradores = statsPorRol?.REGISTRADOR ?? users.filter((u) => u.rol?.codigo === 'REGISTRADOR').length;

  const handleCardRoleClick = (targetRolId?: number) => {
    if (!targetRolId) {
      setRolId(undefined);
      return;
    }
    if (rolId === targetRolId) {
      setRolId(undefined);
    } else {
      setRolId(targetRolId);
    }
  };

  // Table columns definition
  const columns: Column<UsuarioItem>[] = [
    {
      key: 'usuario',
      header: 'Nombre Completo',
      render: (row) => (
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-marca-primario/10 text-marca-primario flex items-center justify-center font-bold text-sm shrink-0 border border-marca-primario/15">
            {row.nombre
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-text-primary text-[15px] leading-tight block truncate font-sans">
              {row.nombre}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'rol',
      header: 'Rol',
      render: (row) => <UserRoleBadge rolCodigo={row.rol?.codigo} />,
    },
    {
      key: 'segmentacion',
      header: 'Segmentación',
      render: (row) => (
        <UserSegmentacionBadge
          tipoSurtidoAlmacen={row.tipoSurtidoAlmacen}
          tipoMaterialAuditor={row.tipoMaterialAuditor}
          rolCodigo={row.rol?.codigo}
        />
      ),
    },
    {
      key: 'lineas',
      header: 'Líneas Asignadas',
      render: (row) => {
        if (row.rol?.codigo !== 'ALMACENISTA') {
          return <span className="text-text-muted text-xs">—</span>;
        }
        if (!row.lineasAsignadas || row.lineasAsignadas.length === 0) {
          return (
            <span className="text-xs font-medium text-text-secondary">
              Todas las líneas
            </span>
          );
        }

        return (
          <ul className="space-y-0.5 py-1 text-xs">
            {row.lineasAsignadas.map((l) => (
              <li
                key={l.id}
                className="flex items-center gap-1.5 text-text-primary font-medium leading-tight"
              >
                <span className="w-1 h-1 rounded-full bg-text-muted shrink-0" />
                <span>{l.nombre}</span>
              </li>
            ))}
          </ul>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (row) => <UserStatusBadge estado={row.estado} />,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'right',
      render: (row) => {
        const isTargetSuperAdmin = row.rol?.codigo === 'SUPER_ADMIN';
        const canEditTarget = canEdit && (isSuperAdminActor || !isTargetSuperAdmin);
        const canDeleteTarget = canDelete && (isSuperAdminActor || !isTargetSuperAdmin);

        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenDetail(row)}
              className="h-8 px-2 text-text-secondary hover:text-text-primary"
              title="Ver detalle"
            >
              <Icon name="visibility" size="xs" />
            </Button>

            {canEditTarget && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenResetPassword(row)}
                className="h-8 px-2 text-text-secondary hover:text-text-primary"
                title="Restablecer contraseña"
              >
                <Icon name="lock_reset" size="xs" />
              </Button>
            )}

            {canEditTarget && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenEdit(row)}
                className="h-8 px-2 text-text-secondary hover:text-text-primary"
                title="Editar usuario"
              >
                <Icon name="edit" size="xs" />
              </Button>
            )}

            {canDeleteTarget && (
              row.estado === 'ACTIVO' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenDeactivate(row)}
                  className="h-8 px-2 text-danger hover:bg-danger/10"
                  title="Desactivar usuario"
                >
                  <Icon name="person_off" size="xs" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReactivate(row)}
                  className="h-8 px-2 text-success hover:bg-success/10"
                  title="Reactivar usuario"
                >
                  <Icon name="person_add" size="xs" />
                </Button>
              )
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sans text-text-primary">
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-text-secondary font-lectura mt-1">
            Administra las cuentas de acceso, roles asignados y líneas autorizadas en la planta.
          </p>
        </div>

        {canCreate && (
          <Button
            variant="guardar"
            icon="person_add"
            onClick={handleOpenCreate}
            className="shrink-0"
          >
            Nuevo Usuario
          </Button>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-sm flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-danger/10 border-danger/30 text-danger'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <Icon name={feedback.type === 'success' ? 'check_circle' : 'error'} size="sm" />
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
            <Icon name="close" size="xs" />
          </button>
        </div>
      )}

      {/* 5 Summary Stats Cards Replicating 08 Visual System (Total, Administradores, Almacenistas, Auditores, Registradores) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Card */}
        <button
          type="button"
          onClick={() => setRolId(undefined)}
          className={`p-3.5 rounded-xl border bg-app-surface shadow-2xs flex items-center gap-3 text-left transition-all cursor-pointer hover:border-marca-primario/60 hover:shadow-xs ${
            !rolId
              ? 'border-marca-primario/60 ring-2 ring-marca-primario/15 bg-marca-primario/5'
              : 'border-border'
          }`}
          title="Ver todos los roles"
        >
          <div className="w-10 h-10 rounded-lg bg-marca-primario/10 text-marca-primario flex items-center justify-center shrink-0">
            <Icon name="group" size="md" />
          </div>
          <div className="min-w-0">
            <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold block truncate">
              Total {estado === 'ACTIVO' ? 'Activos' : 'Inactivos'}
            </span>
            <span className="text-xl font-bold text-text-primary font-sans leading-tight">{totalSummary}</span>
          </div>
        </button>

        {/* Administradores Card */}
        <button
          type="button"
          onClick={() => handleCardRoleClick(adminPrimaryRole?.id)}
          className={`p-3.5 rounded-xl border bg-app-surface shadow-2xs flex items-center gap-3 text-left transition-all cursor-pointer hover:border-marca-acento/60 hover:shadow-xs ${
            adminRoleIds.includes(rolId ?? -1)
              ? 'border-marca-acento/70 ring-2 ring-marca-acento/20 bg-marca-acento/5'
              : 'border-border'
          }`}
          title="Filtrar Administradores"
        >
          <div className="w-10 h-10 rounded-lg bg-marca-acento/15 text-marca-acento flex items-center justify-center shrink-0">
            <Icon name="shield_person" size="md" />
          </div>
          <div className="min-w-0">
            <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold block truncate">
              Administradores
            </span>
            <span className="text-xl font-bold text-text-primary font-sans leading-tight">{countAdmins}</span>
          </div>
        </button>

        {/* Almacenistas Card */}
        <button
          type="button"
          onClick={() => handleCardRoleClick(almacenistaRole?.id)}
          className={`p-3.5 rounded-xl border bg-app-surface shadow-2xs flex items-center gap-3 text-left transition-all cursor-pointer hover:border-info/60 hover:shadow-xs ${
            rolId === almacenistaRole?.id
              ? 'border-info/70 ring-2 ring-info/20 bg-info/5'
              : 'border-border'
          }`}
          title="Filtrar Almacenistas"
        >
          <div className="w-10 h-10 rounded-lg bg-info/10 text-info flex items-center justify-center shrink-0">
            <Icon name="warehouse" size="md" />
          </div>
          <div className="min-w-0">
            <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold block truncate">
              Almacenistas
            </span>
            <span className="text-xl font-bold text-text-primary font-sans leading-tight">{countAlmacenistas}</span>
          </div>
        </button>

        {/* Auditores Card */}
        <button
          type="button"
          onClick={() => handleCardRoleClick(auditorRole?.id)}
          className={`p-3.5 rounded-xl border bg-app-surface shadow-2xs flex items-center gap-3 text-left transition-all cursor-pointer hover:border-purple-500/60 hover:shadow-xs ${
            rolId === auditorRole?.id
              ? 'border-purple-500/70 ring-2 ring-purple-500/20 bg-purple-500/5'
              : 'border-border'
          }`}
          title="Filtrar Auditores"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Icon name="fact_check" size="md" />
          </div>
          <div className="min-w-0">
            <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold block truncate">
              Auditores
            </span>
            <span className="text-xl font-bold text-text-primary font-sans leading-tight">{countAuditores}</span>
          </div>
        </button>

        {/* Registradores Card */}
        <button
          type="button"
          onClick={() => handleCardRoleClick(registradorRole?.id)}
          className={`p-3.5 rounded-xl border bg-app-surface shadow-2xs flex items-center gap-3 text-left transition-all cursor-pointer hover:border-teal-500/60 hover:shadow-xs ${
            rolId === registradorRole?.id
              ? 'border-teal-500/70 ring-2 ring-teal-500/20 bg-teal-500/5'
              : 'border-border'
          }`}
          title="Filtrar Registradores"
        >
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <Icon name="edit_document" size="md" />
          </div>
          <div className="min-w-0">
            <span className="text-2xs uppercase tracking-wider text-text-muted font-semibold block truncate">
              Registradores
            </span>
            <span className="text-xl font-bold text-text-primary font-sans leading-tight">{countRegistradores}</span>
          </div>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-app-surface border border-border rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
        {/* Navigation Tabs (Activos vs Inactivos) */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEstado('ACTIVO')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                estado === 'ACTIVO'
                  ? 'bg-marca-primario text-app-surface shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-cuadra-arena/50'
              }`}
            >
              <Icon name="check_circle" size="xs" />
              <span>Usuarios Activos</span>
              {estado === 'ACTIVO' && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-2xs bg-app-surface/20 text-app-surface font-semibold">
                  {total}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setEstado('INACTIVO')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                estado === 'INACTIVO'
                  ? 'bg-marca-primario text-app-surface shadow-xs'
                  : 'text-text-secondary hover:text-text-primary hover:bg-cuadra-arena/50'
              }`}
            >
              <Icon name="person_off" size="xs" />
              <span>Inactivos</span>
              {estado === 'INACTIVO' && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-2xs bg-app-surface/20 text-app-surface font-semibold">
                  {total}
                </span>
              )}
            </button>
          </div>

          <span className="text-xs text-text-muted hidden sm:inline-block">
            {total} {total === 1 ? 'registro encontrado' : 'registros encontrados'}
          </span>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Quick Search */}
          <div className="lg:col-span-5 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
              <Icon name="search" size="sm" />
            </div>
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o usuario..."
              className="pl-9.5"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-primary"
                title="Limpiar búsqueda"
              >
                <Icon name="close" size="xs" />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div className="lg:col-span-3">
            <Select
              value={rolId || ''}
              onChange={(e) => {
                const val = e.target.value;
                setRolId(val ? Number(val) : undefined);
              }}
            >
              <option value="">Todos los roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </Select>
          </div>

          {/* Department Filter */}
          <div className="lg:col-span-3">
            <Select
              value={departamentoId || ''}
              onChange={(e) => {
                const val = e.target.value;
                setDepartamentoId(val ? Number(val) : undefined);
              }}
            >
              <option value="">Todos los departamentos</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </Select>
          </div>

          {/* Clear Filters Button */}
          <div className="lg:col-span-1 flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="w-full h-10 px-2 text-text-secondary hover:text-text-primary"
              title="Restablecer filtros"
            >
              <Icon name="filter_alt_off" size="xs" />
            </Button>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table<UsuarioItem>
            columns={columns}
            data={users}
            keyExtractor={(item) => item.id}
            isLoading={isLoading}
            emptyMessage={
              estado === 'ACTIVO'
                ? 'No se encontraron usuarios activos con los filtros indicados.'
                : 'No hay usuarios dados de baja o inactivos.'
            }
            emptyIcon="group_off"
            pagination={{
              currentPage: pagina,
              totalPages: totalPaginas,
              totalItems: total,
              itemsPerPage: limite,
              onPageChange: (p) => setPagina(p),
            }}
          />
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-3">
          {isLoading && users.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={`skeleton-card-${idx}`}
                  className="bg-app-surface border border-border rounded-xl p-4 shadow-2xs space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/60">
                    <div className="space-y-1">
                      <Skeleton className="h-2.5 w-10" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="space-y-1">
                      <Skeleton className="h-2.5 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <Skeleton className="h-8 w-14 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted">
              {estado === 'ACTIVO'
                ? 'No se encontraron usuarios activos.'
                : 'No hay usuarios inactivos.'}
            </div>
          ) : (
            <>
              {users.map((u) => (
                <UserCard
                  key={u.id}
                  user={u}
                  onView={handleOpenDetail}
                  onEdit={handleOpenEdit}
                  onResetPassword={handleOpenResetPassword}
                  onDeactivate={handleOpenDeactivate}
                  onReactivate={handleReactivate}
                />
              ))}

              <Pagination
                variant="floating"
                currentPage={pagina}
                totalPages={totalPaginas}
                onPageChange={(p) => setPagina(p)}
                isLoading={isLoading}
              />
            </>
          )}
        </div>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger font-medium text-center">
            {error}
          </div>
        )}
      </div>

      {/* Modals */}
      <UserDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        user={selectedUser}
        onEdit={handleOpenEdit}
        onResetPassword={handleOpenResetPassword}
      />

      <UserFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        user={formUser}
        roles={roles}
        departamentos={departamentos}
        onSuccess={() => {
          showFeedback(
            'success',
            formUser ? 'Usuario actualizado correctamente.' : 'Usuario creado con éxito.',
          );
          reloadUsers();
        }}
      />

      <UserResetPasswordModal
        isOpen={isResetPasswordOpen}
        onClose={() => setIsResetPasswordOpen(false)}
        user={selectedUser}
        onSuccess={() => {
          showFeedback('success', `Contraseña de ${selectedUser?.usuario} restablecida.`);
        }}
      />

      <UserDeactivateModal
        isOpen={isDeactivateOpen}
        onClose={() => setIsDeactivateOpen(false)}
        user={selectedUser}
        onSuccess={() => {
          showFeedback('success', `Usuario ${selectedUser?.usuario} desactivado.`);
          reloadUsers();
        }}
      />
    </div>
  );
}
