import { type ReactNode } from 'react';
import { ProyeccionPage } from '@/features/proyeccion';

/**
 * Pantalla de PROYECCIÓN para VALES PENDIENTES.
 * Redirige a la feature centralizada ProyeccionPage inicializada en vales.
 */
export function ProyeccionValesPendientesPage(): ReactNode {
  return <ProyeccionPage initialVista="vales" />;
}
