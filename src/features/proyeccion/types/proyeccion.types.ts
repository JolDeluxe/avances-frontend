/**
 * proyeccion.types.ts — Contratos y tipos para el módulo de Proyección de Planta
 */

export type ModuloProyeccion = 'listados' | 'vales';

export interface ProyeccionPageProps {
  initialVista?: ModuloProyeccion;
}
