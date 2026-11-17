/**
 * classify-vales.ts — Clasificación en paralelo (BOTA | ACCESORIOS | OTRO) para tablas de Vales
 */

import type { ValeItem } from '../types/vales.types';
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
 * Determina si una columna paralela (Bota, Accesorios u Otro) está fuera del alcance
 * acumulativo de un usuario con alcance restringido (ej. ALMACENISTA).
 */
export function getValesColumnDisabledFlags(user: UsuarioAuth | null | undefined): {
  isBotaDisabled: boolean;
  isAccesoriosDisabled: boolean;
  isOtroDisabled: boolean;
} {
  if (!user || user.rol !== 'ALMACENISTA') {
    return { isBotaDisabled: false, isAccesoriosDisabled: false, isOtroDisabled: false };
  }

  const areas = user.areasVale ?? [];
  const deptos = user.departamentosValeAsignados ?? [];

  if (areas.length === 0 && deptos.length === 0) {
    return { isBotaDisabled: true, isAccesoriosDisabled: true, isOtroDisabled: true };
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
