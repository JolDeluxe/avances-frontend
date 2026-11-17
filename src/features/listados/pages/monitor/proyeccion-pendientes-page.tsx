import { type ReactNode } from 'react';
import { ProyeccionPage, type ProyeccionPageProps } from '@/features/proyeccion';

/**
 * Re-exportación de compatibilidad con la nueva Feature centralizada @/features/proyeccion.
 */
export function ProyeccionPendientesPage(props: ProyeccionPageProps): ReactNode {
  return <ProyeccionPage {...props} />;
}
