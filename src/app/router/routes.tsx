import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { ROUTES } from './route-paths';
import { PERMISOS } from '@/config/permissions';
import { NotFoundPage } from '@/app/errors/not-found-page';
import { ErrorPage } from '@/app/errors/error-page';
import { DashboardLayout } from '@/layouts/dashboard-layout';
import { RequireAuth, RedirectIfAuthenticated, RequirePermission, RequireRole } from './route-guards';
import { usePermissions } from '@/shared/hooks/use-permissions';

/**
 * Lazy loading por módulo/ruta para optimización de rendimiento y división de bundle (Code Splitting).
 * Reduce el bundle principal cargando cada subsistema bajo demanda.
 */
const LoginPage = lazy(() => import('@/features/auth').then((m) => ({ default: m.LoginPage })));
const UsersPage = lazy(() => import('@/features/users/pages/users-page').then((m) => ({ default: m.UsersPage })));
const LineasPage = lazy(() => import('@/features/lineas').then((m) => ({ default: m.LineasPage })));
const ListadosLayoutPage = lazy(() =>
  import('@/features/listados/pages/listados-layout-page').then((m) => ({ default: m.ListadosLayoutPage })),
);
const ListadosAdministracionPage = lazy(() =>
  import('@/features/listados/pages/administracion/listados-administracion-page').then((m) => ({
    default: m.ListadosAdministracionPage,
  })),
);
const ListadosPendientesPage = lazy(() =>
  import('@/features/listados/pages/pendientes/listados-pendientes-page').then((m) => ({
    default: m.ListadosPendientesPage,
  })),
);
const ListadosAlmacenPage = lazy(() =>
  import('@/features/listados/pages/almacen/listados-almacen-page').then((m) => ({
    default: m.ListadosAlmacenPage,
  })),
);
const ListadosAuditoriaPage = lazy(() =>
  import('@/features/listados/pages/auditoria/listados-auditoria-page').then((m) => ({
    default: m.ListadosAuditoriaPage,
  })),
);
const ListadosHistorialPage = lazy(() =>
  import('@/features/listados/pages/historial/listados-historial-page').then((m) => ({
    default: m.ListadosHistorialPage,
  })),
);
const MonitorPendientesPage = lazy(() =>
  import('@/features/listados/pages/monitor/monitor-pendientes-page').then((m) => ({
    default: m.MonitorPendientesPage,
  })),
);
const ProyeccionPendientesPage = lazy(() =>
  import('@/features/listados/pages/monitor/proyeccion-pendientes-page').then((m) => ({
    default: m.ProyeccionPendientesPage,
  })),
);

/** Fallback visual ligero durante la carga asíncrona de chunks de ruta */
function RouteLoadingFallback() {
  return (
    <div className="flex h-full min-h-[300px] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-500 border-t-transparent" />
        <span className="text-xs font-medium text-text-muted">Cargando módulo...</span>
      </div>
    </div>
  );
}

function withSuspense(component: ReactNode): ReactNode {
  return <Suspense fallback={<RouteLoadingFallback />}>{component}</Suspense>;
}

/**
 * Componente de redirección de índice para el módulo Listados.
 * - Si es REGISTRADOR, va a /listados/administracion.
 * - Si es AUDITOR (sin crear/editar), va directamente a /listados/auditoria.
 * - Si es ALMACENISTA, va directamente a su tablero operativo /listados/almacen.
 * - Si cuenta con capacidades administrativas de listado, se dirige a /listados/administracion.
 * - En caso contrario, va a la vista general /listados/pendientes.
 */
function ListadosIndexRedirect() {
  const { canAny, rol } = usePermissions();

  if (rol === 'REGISTRADOR') {
    return <Navigate to={ROUTES.LISTADOS_ADMINISTRACION} replace />;
  }

  if (rol === 'AUDITOR') {
    return <Navigate to={ROUTES.LISTADOS_AUDITORIA} replace />;
  }

  if (rol === 'ALMACENISTA') {
    return <Navigate to={ROUTES.LISTADOS_ALMACEN} replace />;
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
 * - Code splitting por ruta con lazy() y Suspense
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
        {withSuspense(<LoginPage />)}
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
                  {withSuspense(<UsersPage />)}
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
                {withSuspense(<LineasPage />)}
              </RequireRole>
            ),
          },
          {
            // Módulo independiente: Tablero Monitor en Vivo de Listados Pendientes
            path: ROUTES.MONITOR_PENDIENTES,
            element: (
              <RequirePermission
                permission={PERMISOS.LISTADO_VER}
                fallbackRoute={ROUTES.LOGIN}
              >
                {withSuspense(<MonitorPendientesPage />)}
              </RequirePermission>
            ),
          },
          {
            // Módulo PROYECCIÓN: Pantalla de LISTADOS PENDIENTES
            path: ROUTES.PROYECCION,
            element: (
              <RequirePermission
                permission={PERMISOS.LISTADO_VER}
                fallbackRoute={ROUTES.LOGIN}
              >
                {withSuspense(<ProyeccionPendientesPage />)}
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.PROYECCION_PENDIENTES,
            element: (
              <RequirePermission
                permission={PERMISOS.LISTADO_VER}
                fallbackRoute={ROUTES.LOGIN}
              >
                {withSuspense(<ProyeccionPendientesPage />)}
              </RequirePermission>
            ),
          },
          {
            // Módulo Listados — layout con navegación interna
            path: ROUTES.LISTADOS,
            element: withSuspense(<ListadosLayoutPage />),
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
                    {withSuspense(<ListadosAdministracionPage />)}
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.LISTADOS_PENDIENTES,
                element: (
                  <RequireRole
                    allowedRoles={['SUPER_ADMIN', 'ADMIN', 'ALMACENISTA', 'AUDITOR', 'REGISTRADOR', 'SUPERVISOR']}
                    fallbackRoute={ROUTES.LISTADOS}
                  >
                    {withSuspense(<ListadosPendientesPage />)}
                  </RequireRole>
                ),
              },
              {
                path: ROUTES.LISTADOS_ALMACEN,
                element: (
                  <RequireRole
                    allowedRoles={['SUPER_ADMIN', 'ADMIN', 'ALMACENISTA']}
                    fallbackRoute={ROUTES.LISTADOS}
                  >
                    {withSuspense(<ListadosAlmacenPage />)}
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
                    {withSuspense(<ListadosAuditoriaPage />)}
                  </RequireRole>
                ),
              },
              {
                path: ROUTES.LISTADOS_HISTORIAL,
                element: (
                  <RequireRole
                    allowedRoles={['SUPER_ADMIN', 'ADMIN', 'SUPERVISOR', 'REGISTRADOR', 'AUDITOR']}
                    fallbackRoute={ROUTES.LISTADOS}
                  >
                    {withSuspense(<ListadosHistorialPage />)}
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
