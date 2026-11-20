import type { ListadoItem, LineaProduccionConEstado, AreaProduccion, TipoFrenteMaterial } from '../types/listados.types';
import type { UsuarioAuth } from '@/features/auth/types/auth.types';

export interface ClasificacionListadosResult {
  botaItems: ListadoItem[];
  accesoriosItems: ListadoItem[];
  noClasificados: ListadoItem[];
}

/**
 * Clasifica los listados de materia prima en BOTA y ACCESORIOS basándose exclusivamente
 * en el área de producción real del catálogo obtenido del backend/base de datos.
 *
 * No utiliza expresiones regulares, heurísticas de nombres ni tablas de mapeo estáticas en frontend.
 */
export function clasificarListadosPorArea(
  items: ListadoItem[],
  todasLasLineas: LineaProduccionConEstado[],
): ClasificacionListadosResult {
  const botaItems: ListadoItem[] = [];
  const accesoriosItems: ListadoItem[] = [];
  const noClasificados: ListadoItem[] = [];

  const lineasAreaMap = new Map<number, AreaProduccion>();
  const lineasOrdenMap = new Map<number, number>();
  todasLasLineas.forEach((linea) => {
    if (linea.area) {
      lineasAreaMap.set(linea.id, linea.area);
    }
    if (linea.orden !== undefined) {
      lineasOrdenMap.set(linea.id, linea.orden);
    }
  });

  items.forEach((item) => {
    // Si el listado pertenece explícitamente a otro departamento, no entra en materia prima
    const deptoCodigo = item.departamento?.codigo;
    if (deptoCodigo && deptoCodigo !== 'MATERIA_PRIMA') {
      return;
    }

    const area =
      item.lineaProduccion.area ||
      lineasAreaMap.get(item.lineaProduccion.id);

    // Enriquecer el orden en item.lineaProduccion si está disponible en el catálogo
    const catalogoOrden = lineasOrdenMap.get(item.lineaProduccion.id);
    const enrichedItem: ListadoItem = catalogoOrden !== undefined
      ? {
          ...item,
          lineaProduccion: {
            ...item.lineaProduccion,
            orden: item.lineaProduccion.orden ?? catalogoOrden,
          },
        }
      : item;

    if (area === 'BOTA') {
      botaItems.push(enrichedItem);
    } else if (area === 'ACCESORIOS') {
      accesoriosItems.push(enrichedItem);
    } else {
      noClasificados.push(enrichedItem);
    }
  });

  return { botaItems, accesoriosItems, noClasificados };
}

export type TipoOperacionFrente = 'almacen' | 'auditoria';

/**
 * Evalúa si el usuario autenticado tiene alcance operativo sobre un frente de listado.
 * Réplica idéntica de ListadosLifecycleService en el backend.
 * Política: Deny-by-default. Sin excepciones de rol para ADMIN.
 */
export function canOperateListadoFrente(
  user: UsuarioAuth | null | undefined,
  tipoFrente: TipoFrenteMaterial,
  operacion: TipoOperacionFrente,
): boolean {
  if (!user || !user.id || !tipoFrente) {
    return false; // Información no disponible -> Deny-by-default
  }

  // 1. Alcance Ilimitado (Únicamente SUPER_ADMIN)
  if (user.rol === 'SUPER_ADMIN') {
    return true;
  }

  // 2. Extraer asignación según dominio de la operación
  const rawAsignacion =
    operacion === 'auditoria' ? user.tipoMaterialAuditor : user.tipoSurtidoAlmacen;

  // Si no tiene asignación explícita -> Deny-by-default (nunca ilimitado)
  if (!rawAsignacion || rawAsignacion.trim() === '') {
    return false;
  }

  const permitidos = rawAsignacion
    .split(',')
    .map((s) => s.trim().toUpperCase());

  // 3. Alcance explícitamente ilimitado para esta operación ("TODOS")
  if (permitidos.includes('TODOS')) {
    return true;
  }

  // 4. Alcance restringido por frente específico
  return permitidos.includes(tipoFrente.toUpperCase());
}
