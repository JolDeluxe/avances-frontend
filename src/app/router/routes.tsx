import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { ROUTES } from './route-paths';
import { PERMISOS } from '@/config/permissions';
import { NotFoundPage } from '@/app/errors/not-found-page';
import { ErrorPage } from '@/app/errors/error-page';
import { DashboardLayout } from '@/layouts/dashboard-layout';
import { RequireAuth, RedirectIfAuthenticated, RequirePermission, RequireRole } from './route-guards';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { useAuthSession } from '@/app/providers/auth-provider';

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
const ProyeccionPage = lazy(() =>
  import('@/features/proyeccion').then((m) => ({
    default: m.ProyeccionPage,
  })),
);

const ValesLayoutPage = lazy(() =>
  import('@/features/vales/pages/vales-layout-page').then((m) => ({ default: m.ValesLayoutPage })),
);
const ValesAdministracionPage = lazy(() =>
  import('@/features/vales/pages/administracion/vales-administracion-page').then((m) => ({
    default: m.ValesAdministracionPage,
  })),
);
const ValesPendientesPage = lazy(() =>
  import('@/features/vales/pages/pendientes/vales-pendientes-page').then((m) => ({
    default: m.ValesPendientesPage,
  })),
);
const ValesAlmacenPage = lazy(() =>
  import('@/features/vales/pages/almacen/vales-almacen-page').then((m) => ({
    default: m.ValesAlmacenPage,
  })),
);
const ValesAuditoriaPage = lazy(() =>
  import('@/features/vales/pages/auditoria/vales-auditoria-page').then((m) => ({
    default: m.ValesAuditoriaPage,
  })),
);
const ValesHistorialPage = lazy(() =>
  import('@/features/vales/pages/historial/vales-historial-page').then((m) => ({
    default: m.ValesHistorialPage,
  })),
);
const MonitorValesPendientesPage = lazy(() =>
  import('@/features/vales/pages/monitor/monitor-pendientes-page').then((m) => ({
    default: m.MonitorValesPendientesPage,
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
  const { rol } = usePermissions();
  const session = useAuthSession();

  // Si es el usuario admin (Super Admin) o entra a la app, redirigir a /listados/pendientes directamente
  if (session.user?.usuario === 'admin' || rol === 'SUPER_ADMIN' || rol === 'ADMIN') {
    return <Navigate to={ROUTES.LISTADOS_PENDIENTES} replace />;
  }

  if (rol === 'REGISTRADOR') {
    return <Navigate to={ROUTES.LISTADOS_ADMINISTRACION} replace />;
  }

  if (rol === 'AUDITOR') {
    return <Navigate to={ROUTES.LISTADOS_AUDITORIA} replace />;
  }

  if (rol === 'ALMACENISTA') {
    return <Navigate to={ROUTES.LISTADOS_ALMACEN} replace />;
  }

  return <Navigate to={ROUTES.LISTADOS_PENDIENTES} replace />;
}

/**
 * Componente de redirección de índice para el módulo Vales basado en permisos efectivos y rol.
 */
function ValesIndexRedirect() {
  const { rol, can, canAny } = usePermissions();
  const session = useAuthSession();

  if (session.user?.usuario === 'admin' || rol === 'SUPER_ADMIN' || rol === 'ADMIN') {
    return <Navigate to={ROUTES.VALES_PENDIENTES} replace />;
  }

  if (rol === 'REGISTRADOR' && canAny(PERMISOS.VALE_CREAR, PERMISOS.VALE_EDITAR)) {
    return <Navigate to={ROUTES.VALES_ADMINISTRACION} replace />;
  }

  if (rol === 'AUDITOR' && can(PERMISOS.VALE_DESCONTAR)) {
    return <Navigate to={ROUTES.VALES_AUDITORIA} replace />;
  }

  if (rol === 'ALMACENISTA' && canAny(PERMISOS.VALE_SEPARAR, PERMISOS.VALE_ENTREGAR)) {
    return <Navigate to={ROUTES.VALES_ALMACEN} replace />;
  }

  return <Navigate to={ROUTES.VALES_PENDIENTES} replace />;
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
            // Módulo Proyección Centralizado (Pantallas de planta y almacén)
            // Se integra en el layout habitual y se expande al 100% en Pantalla Completa
            path: ROUTES.PROYECCION,
            element: (
              <RequirePermission
                anyPermission={[PERMISOS.LISTADO_VER, PERMISOS.VALE_VER]}
                fallbackRoute={ROUTES.LOGIN}
              >
                {withSuspense(<ProyeccionPage />)}
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.PROYECCION_PENDIENTES,
            element: (
              <RequirePermission
                anyPermission={[PERMISOS.LISTADO_VER, PERMISOS.VALE_VER]}
                fallbackRoute={ROUTES.LOGIN}
              >
                {withSuspense(<ProyeccionPage initialVista="listados" />)}
              </RequirePermission>
            ),
          },
          {
            path: ROUTES.PROYECCION_VALES,
            element: (
              <RequirePermission
                anyPermission={[PERMISOS.LISTADO_VER, PERMISOS.VALE_VER]}
                fallbackRoute={ROUTES.LOGIN}
              >
                {withSuspense(<ProyeccionPage initialVista="vales" />)}
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
          {
            // Monitor Kiosco de Vales Pendientes
            path: ROUTES.MONITOR_VALES_PENDIENTES,
            element: (
              <RequirePermission
                permission={PERMISOS.VALE_VER}
                fallbackRoute={ROUTES.LOGIN}
              >
                {withSuspense(<MonitorValesPendientesPage />)}
              </RequirePermission>
            ),
          },

          {
            // Módulo Vales — layout con navegación interna y guards por permisos efectivos
            path: ROUTES.VALES,
            element: (
              <RequirePermission
                permission={PERMISOS.VALE_VER}
                fallbackRoute={ROUTES.LISTADOS}
              >
                {withSuspense(<ValesLayoutPage />)}
              </RequirePermission>
            ),
            children: [
              {
                index: true,
                element: <ValesIndexRedirect />,
              },
              {
                path: ROUTES.VALES_ADMINISTRACION,
                element: (
                  <RequirePermission
                    anyPermission={[
                      PERMISOS.VALE_CREAR,
                      PERMISOS.VALE_EDITAR,
                      PERMISOS.VALE_CANCELAR,
                    ]}
                    fallbackRoute={ROUTES.VALES}
                  >
                    {withSuspense(<ValesAdministracionPage />)}
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.VALES_PENDIENTES,
                element: (
                  <RequirePermission
                    permission={PERMISOS.VALE_VER}
                    fallbackRoute={ROUTES.LISTADOS}
                  >
                    {withSuspense(<ValesPendientesPage />)}
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.VALES_ALMACEN,
                element: (
                  <RequirePermission
                    anyPermission={[PERMISOS.VALE_SEPARAR, PERMISOS.VALE_ENTREGAR]}
                    fallbackRoute={ROUTES.VALES}
                  >
                    {withSuspense(<ValesAlmacenPage />)}
                  </RequirePermission>
                ),
              },
              {
                path: ROUTES.VALES_AUDITORIA,
                element: (
                  <RequireRole
                    allowedRoles={['SUPER_ADMIN', 'ADMIN', 'AUDITOR']}
                    fallbackRoute={ROUTES.VALES}
                  >
                    <RequirePermission
                      permission={PERMISOS.VALE_DESCONTAR}
                      fallbackRoute={ROUTES.VALES}
                    >
                      {withSuspense(<ValesAuditoriaPage />)}
                    </RequirePermission>
                  </RequireRole>
                ),
              },
              {
                path: ROUTES.VALES_HISTORIAL,
                element: (
                  <RequirePermission
                    permission={PERMISOS.VALE_VER}
                    fallbackRoute={ROUTES.VALES}
                  >
                    {withSuspense(<ValesHistorialPage />)}
                  </RequirePermission>
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
