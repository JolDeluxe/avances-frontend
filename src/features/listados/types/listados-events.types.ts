import type {
  EstadoListado,
  EstadoFrenteMaterial,
  TipoFrenteMaterial,
} from './listados.types';

export type TipoEventoListado =
  | 'LISTADO_CREADO'
  | 'LISTADO_ACTUALIZADO'
  | 'FRENTE_SEPARADO'
  | 'FRENTE_ENTREGADO'
  | 'FRENTE_DESCONTADO'
  | 'FRENTE_RETROCEDIDO'
  | 'LISTADO_CANCELADO'
  | 'LOTE_TRANSICIONADO';

export interface FrenteEventoPayload {
  tipoFrente: TipoFrenteMaterial;
  estado: EstadoFrenteMaterial;
}

export interface ListadoEventoPayload {
  id: string; // Identificador del evento (UUID o secuencial)
  tipo: TipoEventoListado;
  timestamp: string; // ISO 8601
  listadoId: number;
  numeroListado: string;
  departamentoId: number;
  lineaProduccionId: number;
  lineaCodigo: string;
  estadoGlobal: EstadoListado;
  frentes: FrenteEventoPayload[];
  frenteAfectado?: TipoFrenteMaterial;
  idsAfectados?: number[]; // Presente en operaciones en lote
}

export type ListadoStreamEventListener = (evento: ListadoEventoPayload) => void;
