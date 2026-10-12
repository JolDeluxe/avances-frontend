import { Navigate, Outlet } from 'react-router';
import { useAuthSession } from '@/app/providers/auth-provider';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ROUTES } from './route-paths';
import { Spinner } from '@/components/ui/spinner';
import type { PermisoCodigo } from '@/config/permissions';
import type { ReactNode } from 'react';

/**
 * Guard para rutas privadas.
 * Permite el acceso únicamente si el usuario está autenticado.
 * Muestra estado de carga durante la hidratación inicial para evitar expulsiones falsas.
 */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthSession();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <Spinner size="36px" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

/**
 * Guard para rutas públicas de autenticación (ej. /login).
 * Si el usuario ya cuenta con una sesión activa, lo redirige al Dashboard.
 */
export function RedirectIfAuthenticated({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthSession();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <Spinner size="36px" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={ROUTES.LISTADOS} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

/**
 * Guard para rutas con restricción de permisos efectivos (SKILL.md §13).
 * Redirige al fallbackRoute si el usuario no cuenta con la capacidad requerida.
 */
export function RequirePermission({
  permission,
  anyPermission,
  allPermissions,
  fallbackRoute = ROUTES.LISTADOS,
  children,
}: {
  permission?: PermisoCodigo | string;
  anyPermission?: (PermisoCodigo | string)[];
  allPermissions?: (PermisoCodigo | string)[];
  fallbackRoute?: string;
  children?: ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuthSession();
  const { can, canAny, canAll } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <Spinner size="36px" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  let isAllowed = true;

  if (permission && !can(permission)) {
    isAllowed = false;
  }

  if (isAllowed && anyPermission && anyPermission.length > 0 && !canAny(...anyPermission)) {
    isAllowed = false;
  }

  if (isAllowed && allPermissions && allPermissions.length > 0 && !canAll(...allPermissions)) {
    isAllowed = false;
  }

  if (!isAllowed) {
    return <Navigate to={fallbackRoute} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

/**
 * Guard legado de roles para compatibilidad temporal de presentación.
 * Preferir siempre RequirePermission para el control de acceso.
 */
export function RequireRole({
  allowedRoles,
  fallbackRoute = ROUTES.LISTADOS,
  children,
}: {
  allowedRoles: string[];
  fallbackRoute?: string;
  children?: ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuthSession();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg">
        <Spinner size="36px" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  const userRol = user?.rol?.toUpperCase() || '';
  const isAllowed = allowedRoles.map((r) => r.toUpperCase()).includes(userRol);

  if (!isAllowed) {
    return <Navigate to={fallbackRoute} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
