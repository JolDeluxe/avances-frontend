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
  PROYECCION_VALES: '/proyeccion/vales',

  /** Módulo de Vales — layout raíz */
  VALES: '/vales',

  /** Submódulo de Vales: registro y edición en estado pendiente */
  VALES_ADMINISTRACION: '/vales/administracion',

  /** Submódulo de Vales: operación de almacén (Separar / Entregar) */
  VALES_ALMACEN: '/vales/almacen',

  /** Submódulo de Vales: vista general de pendientes */
  VALES_PENDIENTES: '/vales/pendientes',

  /** Submódulo de Vales: auditoría y confirmación de descuento en ERP */
  VALES_AUDITORIA: '/vales/auditoria',

  /** Submódulo de Vales: historial completo */
  VALES_HISTORIAL: '/vales/historial',

  /** Monitor de Vales Pendientes */
  MONITOR_VALES_PENDIENTES: '/monitor-vales-pendientes',

  /** Ruta catch-all para páginas no encontradas */
  NOT_FOUND: '*',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
