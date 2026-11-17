import type {
  AreaVale,
  EstadoVale,
  UsuarioValeSimple,
} from './vales.types';

export type ValeEventoTipo =
  | 'VALE_CREADO'
  | 'VALE_EDITADO'
  | 'VALE_SEPARADO'
  | 'VALE_ENTREGADO'
  | 'VALE_SEPARADO_Y_ENTREGADO'
  | 'VALE_DESCONTADO'
  | 'VALE_RETROCEDIDO'
  | 'VALE_CANCELADO'
  | 'VALES_LOTE_OPERADO';

export interface ValeEventoPayload {
  id: string;
  tipo: ValeEventoTipo;
  valeId?: number;
  valeIds?: number[];
  folio?: string;
  serieId?: number;
  serieCodigo?: string;
  departamentoId: number;
  departamentoValeId?: number;
  departamentoValeNombre?: string;
  area?: AreaVale;
  areas?: AreaVale[];
  departamentoValeIds?: number[];
  estadoAnterior?: EstadoVale | null;
  estadoNuevo?: EstadoVale;
  actorId: number;
  actorNombre?: string;
  motivo?: string | null;
  fechaEvento: string;

  // Campos opcionales para actualización optimista en cliente
  fechaSolicitud?: string;
  horaSolicitud?: string | null;
  tieneHoraSolicitud?: boolean;
  motivoCancelacion?: string | null;
  motivoRetroceso?: string | null;
  fechaSeparado?: string | null;
  fechaEntregado?: string | null;
  fechaDescontado?: string | null;
  fechaRevertido?: string | null;
  fechaCancelado?: string | null;
  separadoPor?: UsuarioValeSimple | null;
  entregadoPor?: UsuarioValeSimple | null;
  descontadoPor?: UsuarioValeSimple | null;
  revertidoPor?: UsuarioValeSimple | null;
  canceladoPor?: UsuarioValeSimple | null;
}

export type ValeEventListener = (evento: ValeEventoPayload) => void;
export type ValeStreamEventListener = ValeEventListener;

