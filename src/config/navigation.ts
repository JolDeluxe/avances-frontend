import { ROUTES } from '@/app/router/route-paths';
import { PERMISOS } from '@/config/permissions';
import type { NavItem } from '@/shared/types/navigation.types';

/**
 * Catálogo base de navegación para Materia Prima.
 * Define la infraestructura inicial sin inventar módulos de negocio
 * que aún no han sido aprobados o especificados.
 */
export const DEFAULT_NAV_ITEMS: NavItem[] = [
  {
    id: 'listados',
    name: 'Listados',
    icon: 'assignment',
    route: ROUTES.LISTADOS,
    permission: PERMISOS.LISTADO_VER,
  },
  {
    id: 'proyeccion',
    name: 'Proyectar',
    icon: 'tv',
    route: ROUTES.PROYECCION,
    permission: PERMISOS.LISTADO_VER,
  },
  {
    id: 'usuarios',
    name: 'Usuarios',
    icon: 'group',
    route: ROUTES.USUARIOS,
    permission: PERMISOS.USUARIO_VER,
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    id: 'lineas',
    name: 'Líneas / Maquilas',
    icon: 'format_list_numbered',
    route: ROUTES.LINEAS,
    permission: PERMISOS.DEPARTAMENTO_ADMINISTRAR,
    allowedRoles: ['SUPER_ADMIN'],
  },
];
