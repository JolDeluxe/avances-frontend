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

  /** Submódulo: operación de almacén (Separar / Entregar) */
  LISTADOS_PENDIENTES: '/listados/pendientes',

  /** Submódulo: auditoría y descuento en ERP (directos e indirectos) */
  LISTADOS_AUDITORIA: '/listados/auditoria',

  /** Submódulo: historial de todos los estados */
  LISTADOS_HISTORIAL: '/listados/historial',

  /** Ruta catch-all para páginas no encontradas */
  NOT_FOUND: '*',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
