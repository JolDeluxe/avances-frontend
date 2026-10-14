/**
 * Catálogo tipado de paths de ruta (SKILL.md §9).
 *
 * Centraliza todas las rutas de la aplicación eliminando strings mágicos
 * dispersos en el código. Usar ROUTES.X en lugar de strings literales.
 *
 * Convención de nombres:
 *   ROUTES.ENTIDAD_ACCION (en mayúsculas, usando la entidad en español si es un dominio)
 */

export const ROUTES = {
  /** Raíz de la aplicación */
  ROOT: '/',

  /** Pantalla de inicio de sesión */
  LOGIN: '/login',

  /** Pantalla principal / dashboard */
  DASHBOARD: '/dashboard',

  /** Módulo de Usuarios */
  USUARIOS: '/usuarios',

  /** Módulo de Líneas de Producción (Admin / SuperAdmin) */
  LINEAS: '/lineas',

  /** Módulo de Listados — layout raíz */
  LISTADOS: '/listados',

  /** Submódulo: administración y consulta histórica */
  LISTADOS_ADMINISTRACION: '/listados/administracion',

  /** Submódulo: operación exclusiva de almacén (Separar / Entregar por almacenistas) */
  LISTADOS_ALMACEN: '/listados/almacen',

  /** Submódulo: vista general de pendientes (para todos los roles, editable por ADMIN) */
  LISTADOS_PENDIENTES: '/listados/pendientes',

  /** Submódulo: auditoría y descuento en ERP (directos e indirectos) */
  LISTADOS_AUDITORIA: '/listados/auditoria',

  /** Submódulo: historial de todos los estados */
  LISTADOS_HISTORIAL: '/listados/historial',

  /** Módulo independiente: Tablero Monitor en Vivo de Listados Pendientes */
  MONITOR_PENDIENTES: '/monitor-pendientes',

  /** Módulo PROYECCIÓN (Pantallas de planta y monitores de proyección) */
  PROYECCION: '/proyeccion',
  PROYECCION_PENDIENTES: '/proyeccion/pendientes',

  /** Ruta catch-all para páginas no encontradas */
  NOT_FOUND: '*',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
