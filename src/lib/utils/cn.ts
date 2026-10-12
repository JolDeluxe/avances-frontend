import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases de Tailwind CSS correctamente resolviendo conflictos.
 * Equivalente a la utilidad cn() del proyecto anterior.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
