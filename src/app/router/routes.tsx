import { Navigate, type RouteObject } from 'react-router';
import { ROUTES } from './route-paths';
import { PERMISOS } from '@/config/permissions';
import { NotFoundPage } from '@/app/errors/not-found-page';
import { ErrorPage } from '@/app/errors/error-page';
import { LoginPage } from '@/features/auth';
import { DashboardLayout } from '@/layouts/dashboard-layout';
import { UsersPage } from '@/features/users/pages/users-page';
import { LineasPage } from '@/features/lineas';
import { ListadosLayoutPage } from '@/features/listados/pages/listados-layout-page';
import { ListadosAdministracionPage } from '@/features/listados/pages/administracion/listados-administracion-page';
import { ListadosPendientesPage } from '@/features/listados/pages/pendientes/listados-pendientes-page';
import { ListadosAuditoriaPage } from '@/features/listados/pages/auditoria/listados-auditoria-page';
import { ListadosHistorialPage } from '@/features/listados/pages/historial/listados-historial-page';
import { RequireAuth, RedirectIfAuthenticated, RequirePermission, RequireRole } from './route-guards';
import { usePermissions } from '@/shared/hooks/use-permissions';

/**
 * Componente de redirección de índice para el módulo Listados.
 * - Si es AUDITOR (sin crear/editar), va directamente a /listados/auditoria.
 * - Si cuenta con capacidades administrativas de listado, se dirige a /listados/administracion.
 * - En caso contrario (ej. ALMACENISTA), va directamente al tablero operativo /listados/pendientes.
 */
function ListadosIndexRedirect() {
  const { canAny, rol } = usePermissions();

  if (rol === 'REGISTRADOR') {
    return <Navigate to={ROUTES.LISTADOS_ADMINISTRACION} replace />;
  }

  if (rol === 'AUDITOR') {
    return <Navigate to={ROUTES.LISTADOS_AUDITORIA} replace />;
  }

  const canAdministrar = canAny(
    PERMISOS.LISTADO_CREAR,
    PERMISOS.LISTADO_EDITAR,
    PERMISOS.LISTADO_CANCELAR,
    PERMISOS.USUARIO_VER,
  );

  if (canAdministrar) {
    return <Navigate to={ROUTES.LISTADOS_ADMINISTRACION} replace />;
  }

  return <Navigate to={ROUTES.LISTADOS_PENDIENTES} replace />;
}

/**
 * Árbol declarativo de rutas de React Router (SKILL.md §9).
 *
 * Integra:
 * - Redirección de raíz
 * - Rutas públicas protegidas por RedirectIfAuthenticated (/login)
 * - Rutas privadas protegidas por RequireAuth (/dashboard con DashboardLayout anidado)
 * - Restricciones por permisos efectivos en Usuarios y Listados Administración
 * - Páginas de error y 404
 */
export const routes: RouteObject[] = [
  {
    path: ROUTES.ROOT,
    element: <Navigate to={ROUTES.LISTADOS} replace />,
    errorElement: <ErrorPage />,
  },
  {
    // Ruta pública de autenticación
    path: ROUTES.LOGIN,
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    ),
    errorElement: <ErrorPage />,
  },
  {
    // Rutas privadas protegidas
    element: <RequireAuth />,
    errorElement: <ErrorPage />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: ROUTES.DASHBOARD,
            element: <Navigate to={ROUTES.LISTADOS} replace />,
          },
          {
            path: ROUTES.USUARIOS,
            element: (
              <RequireRole
                allowedRoles={['SUPER_ADMIN', 'ADMIN']}
                fallbackRoute={ROUTES.LISTADOS}
              >
                <RequirePermission
                  permission={PERMISOS.USUARIO_VER}
                  fallbackRoute={ROUTES.LISTADOS}
                >
                  <UsersPage />
                </RequirePermission>
              </RequireRole>
            ),
          },
          {
            path: ROUTES.LINEAS,
            element: (
              <RequireRole
                allowedRoles={['SUPER_ADMIN']}
                fallbackRoute={ROUTES.LISTADOS}
              >
                <LineasPage />
              </RequireRole>
            ),
          },
          {
            // Módulo Listados — layout con navegación interna
            path: ROUTES.LISTADOS,
            element: <ListadosLayoutPage />,
            children: [
              {
                index: true,
                element: <ListadosIndexRedirect />,
              },
              {
                path: ROUTES.LISTADOS_ADMINISTRACION,
                element: (
                  <RequirePermission
                    anyPermission={[
                      PERMISOS.LISTADO_CREAR,
                      PERMISOS.LISTADO_EDITAR,
                      PERMISOS.LISTADO_CANCELAR,
                      PERMISOS.USUARIO_VER,
                    ]}
                    fallbackRoute={ROUTES.LISTADOS}
                  >
                    <ListadosAdministracionPage />
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.LISTADOS_PENDIENTES,
                element: (
                  <RequireRole
                    allowedRoles={['SUPER_ADMIN', 'ADMIN', 'ALMACENISTA']}
                    fallbackRoute={ROUTES.LISTADOS}
                  >
                    <ListadosPendientesPage />
                  </RequireRole>
                ),
              },
              {
                path: ROUTES.LISTADOS_AUDITORIA,
                element: (
                  <RequireRole
                    allowedRoles={['SUPER_ADMIN', 'ADMIN', 'AUDITOR']}
                    fallbackRoute={ROUTES.LISTADOS}
                  >
                    <ListadosAuditoriaPage />
                  </RequireRole>
                ),
              },
              {
                path: ROUTES.LISTADOS_HISTORIAL,
                element: (
                  <RequireRole
                    allowedRoles={['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR']}
                    fallbackRoute={ROUTES.LISTADOS}
                  >
                    <ListadosHistorialPage />
                  </RequireRole>
                ),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: ROUTES.NOT_FOUND,
    element: <NotFoundPage />,
  },
];
