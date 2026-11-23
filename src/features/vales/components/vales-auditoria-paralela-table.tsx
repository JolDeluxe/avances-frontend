import { type ReactNode } from 'react';
import {
  ValesPendientesParalelaTable,
  type ValesPendientesParalelaTableProps,
} from './vales-pendientes-paralela-table';

export type ValesAuditoriaParalelaTableProps = ValesPendientesParalelaTableProps;

/**
 * Tabla Operativa Paralela para AUDITORÍA de Vales (BOTA | ACCESORIOS).
 * Reutiliza la arquitectura paralela idéntica a ListadosAuditoriaParalelaTable.
 */
export function ValesAuditoriaParalelaTable(
  props: ValesAuditoriaParalelaTableProps,
): ReactNode {
  return (
    <ValesPendientesParalelaTable
      {...props}
      emptyMessage={
        props.emptyMessage ??
        'Sin vales por descontar'
      }
    />
  );
}
