/**
 * classify-vales.ts — Clasificación en paralelo (BOTA | ACCESORIOS | OTRO) para tablas de Vales
 */

import type { ValeItem, AreaVale } from '../types/vales.types';
import type { UsuarioAuth } from '@/features/auth/types/auth.types';

/**
 * Clasifica los vales por su área operativa:
 *   - BOTA (area === 'BOTA')
 *   - ACCESORIOS (area === 'ACCESORIOS')
 *   - OTRO (area === 'OTRO')
 */
export function classifyVales(items: ValeItem[]) {
  const botaItems: ValeItem[] = [];
  const accesoriosItems: ValeItem[] = [];
  const otroItems: ValeItem[] = [];

  for (const item of items) {
    if (item.area === 'BOTA') {
      botaItems.push(item);
    } else if (item.area === 'OTRO') {
      otroItems.push(item);
    } else {
      accesoriosItems.push(item);
    }
  }

  return { botaItems, accesoriosItems, otroItems };
}

/**
 * Determina si un usuario requiere alcance acumulativo de vales (áreas + deptos)
 * Réplica idéntica de ValesScopeService.requiresCumulativeValeScope en backend.
 */
export function requiresCumulativeValeScope(user: UsuarioAuth | null | undefined): boolean {
  if (!user || user.rol === 'SUPER_ADMIN') {
    return false;
  }
  const areas = user.areasVale ?? [];
  const deptos = user.departamentosValeAsignados ?? [];
  return (
    user.rol === 'ALMACENISTA' ||
    Boolean(user.tipoSurtidoAlmacen) ||
    areas.length > 0 ||
    deptos.length > 0
  );
}

/**
 * Evalúa si el usuario autenticado tiene alcance operativo sobre un vale específico.
 * Réplica idéntica de ValesScopeService.canOperateVale en el backend.
 * Política: Deny-by-default. Cero excepciones por rol ADMIN.
 */
export function canOperateValeItem(
  user: UsuarioAuth | null | undefined,
  vale: { departamentoId?: number; area: AreaVale; departamentoValeId: number } | null | undefined,
): boolean {
  if (!user || !user.id || !vale) {
    return false; // Información no disponible -> Deny-by-default
  }

  // 1. SUPER_ADMIN tiene alcance ilimitado global
  if (user.rol === 'SUPER_ADMIN') {
    return true;
  }

  // 2. Aislamiento por departamento organizacional
  if (
    user.departamentoId !== undefined &&
    vale.departamentoId !== undefined &&
    user.departamentoId !== vale.departamentoId
  ) {
    return false;
  }

  // 3. Determinar si está sujeto a alcance acumulativo
  const areas = user.areasVale ?? [];
  const deptos = user.departamentosValeAsignados ?? [];

  if (requiresCumulativeValeScope(user)) {
    // Si requiere alcance pero no tiene ninguna asignación -> Deny-by-default
    if (areas.length === 0 && deptos.length === 0) {
      return false;
    }

    const porArea = areas.includes(vale.area);
    const porDepto = deptos.some((d) => d.id === vale.departamentoValeId);
    return porArea || porDepto;
  }

  // 4. Usuario general departamental (sin segmentación interna de vales)
  return true;
}

/**
 * Determina si una columna paralela (Bota, Accesorios u Otro) está fuera del alcance
 * acumulativo de un usuario con alcance restringido.
 */
export function getValesColumnDisabledFlags(user: UsuarioAuth | null | undefined): {
  isBotaDisabled: boolean;
  isAccesoriosDisabled: boolean;
  isOtroDisabled: boolean;
} {
  if (!user || user.rol === 'SUPER_ADMIN') {
    return { isBotaDisabled: false, isAccesoriosDisabled: false, isOtroDisabled: false };
  }

  if (!requiresCumulativeValeScope(user)) {
    return { isBotaDisabled: false, isAccesoriosDisabled: false, isOtroDisabled: false };
  }

  const areas = user.areasVale ?? [];
  const deptos = user.departamentosValeAsignados ?? [];

  if (areas.length === 0 && deptos.length === 0) {
    // Si no tiene asignación de vales específica, está en modo consulta/lectura general departamental.
    // Las columnas no deben bloquearse con pointer-events-none para que pueda ver y explorar los vales.
    return { isBotaDisabled: false, isAccesoriosDisabled: false, isOtroDisabled: false };
  }

  const canBota =
    areas.includes('BOTA') ||
    deptos.some((d) => d.areaFija === 'BOTA' || d.requiereSeleccionArea);

  const canAccesorios =
    areas.includes('ACCESORIOS') ||
    deptos.some((d) => d.areaFija === 'ACCESORIOS' || d.requiereSeleccionArea);

  const canOtro =
    areas.includes('OTRO') ||
    deptos.some((d) => d.areaFija === 'OTRO' || d.requiereSeleccionArea);

  return {
    isBotaDisabled: !canBota,
    isAccesoriosDisabled: !canAccesorios,
    isOtroDisabled: !canOtro,
  };
}
