import { useState, useEffect, type ReactNode } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { FrenteStatusBadge } from '@/components/ui/status-badge';
import { TIPO_FRENTE_CONFIG } from '@/config/status-config';
import { PERMISOS } from '@/config/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { listadosApi } from '../api/listados-api';
import type { ListadoItem, TipoFrenteMaterial } from '../types/listados.types';

export interface ListadoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  listado: ListadoItem | null;
  onEdit?: (listado: ListadoItem) => void;
  onRequestRetroceder?: (listado: ListadoItem, tipoFrente: TipoFrenteMaterial) => void;
  onRequestCancelar?: (listado: ListadoItem) => void;
  onListadoUpdated?: (listado: ListadoItem, meta?: { accion?: 'separar' | 'entregar' | 'descontar'; tipoFrente?: TipoFrenteMaterial }) => void;
  allowSeparar?: boolean;
}

/**
 * Formatea una fecha ISO o YYYY-MM-DD en dd/mm/aaaa sin transformaciones de timezone.
 */
function formatFechaLocal(fechaStr?: string | null): string {
  if (!fechaStr) return '—';
  const solo = typeof fechaStr === 'string' ? (fechaStr.includes('T') ? fechaStr.slice(0, 10) : fechaStr) : '';
  const [year, month, day] = solo.split('-');
  if (!year || !month || !day) return String(fechaStr);
  return `${day}/${month}/${year}`;
}

function formatTimestamp(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;

    const dia = d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    // Si viene de script histórico o campo Date puro (medianoche UTC 00:00:00), no mostrar hora artificial
    const isMidnightUtc = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
    if (isMidnightUtc) {
      return dia;
    }

    const hora = d.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    // Evitar que 'p. m.' o 'a. m.' se parta en otra línea usando espacio no divisible
    return `${dia} ${hora.replace(/\s+/g, '\u00A0')}`;
  } catch {
    return isoStr;
  }
}

export function ListadoDetailModal({
  isOpen,
  onClose,
  listado,
  onEdit,
  onRequestRetroceder,
  onRequestCancelar,
  onListadoUpdated,
  allowSeparar = true,
}: ListadoDetailModalProps): ReactNode {
  const { user, can, isSuperAdmin, isAdmin } = usePermissions();

  const [detalle, setDetalle] = useState<ListadoItem | null>(null);
  const [isLoadingDetalle, setIsLoadingDetalle] = useState<boolean>(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [operatingFrente, setOperatingFrente] = useState<TipoFrenteMaterial | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmInlineAction, setConfirmInlineAction] = useState<{
    tipoFrente: TipoFrenteMaterial;
    accion: 'separar' | 'entregar' | 'descontar';
  } | null>(null);

  // Cargar detalle completo (con frentes e historialEstados) al abrir
  useEffect(() => {
    if (!isOpen || !listado) {
      setDetalle(null);
      setErrorDetalle(null);
      setOperatingFrente(null);
      setFeedback(null);
      setConfirmInlineAction(null);
      return;
    }

    let cancelled = false;

    const fetchDetalle = async () => {
      setIsLoadingDetalle(true);
      setErrorDetalle(null);
      try {
        const res = await listadosApi.getListadoById(listado.id);
        if (!cancelled) {
          if (res.success && res.data) {
            setDetalle(res.data);
          } else {
            setErrorDetalle(res.message || 'Error al obtener el detalle del listado.');
            setDetalle(listado);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Error inesperado al cargar el detalle.';
          setErrorDetalle(msg);
          setDetalle(listado);
        }
      } finally {
        if (!cancelled) setIsLoadingDetalle(false);
      }
    };

    fetchDetalle();

    return () => {
      cancelled = true;
    };
  }, [isOpen, listado]);

  if (!listado) return null;

  const data = detalle ?? listado;

  // Verificación de si todos los frentes están completos en DESCONTADO
  const frentesActuales = data.frentes ?? [];
  const todosFrentesDescontados =
    frentesActuales.length > 0 &&
    frentesActuales.every((f) => f.estado === 'DESCONTADO');

  // ADMIN y SUPER_ADMIN pueden editar siempre que no estén todos los frentes descontados ni cancelado/descontado
  const canEdit = (isSuperAdmin || isAdmin)
    ? (!todosFrentesDescontados && (data.estado as string) !== 'CANCELADO' && (data.estado as string) !== 'DESCONTADO')
    : data.estado === 'PENDIENTE';

  // ADMIN y SUPER_ADMIN pueden cancelar siempre que no estén todos los frentes descontados ni cancelado/descontado
  const canCancelarListado =
    onRequestCancelar &&
    (isSuperAdmin || isAdmin || can(PERMISOS.LISTADO_CANCELAR)) &&
    (data.estado as string) !== 'CANCELADO' &&
    (data.estado as string) !== 'DESCONTADO' &&
    !todosFrentesDescontados;

  // Permisos efectivos para operaciones de listados
  // ADMIN y SUPER_ADMIN siempre pueden operar cualquier frente (Separar, Entregar, Descontar, Retroceder)
  const canSeparar = (isSuperAdmin || isAdmin) ? true : (Boolean(allowSeparar) && can(PERMISOS.LISTADO_SEPARAR));
  const canEntregar = (isSuperAdmin || isAdmin) ? true : can(PERMISOS.LISTADO_ENTREGAR);
  const canRetroceder = (isSuperAdmin || isAdmin) || can(PERMISOS.LISTADO_RETROCEDER);
  const canDescontar = (isSuperAdmin || isAdmin) || can(PERMISOS.LISTADO_DESCONTAR);

  // Validador de asignación operativa para el usuario autenticado
  const puedeOperarFrente = (tipoFrente: TipoFrenteMaterial): boolean => {
    if (isSuperAdmin || isAdmin) return true;
    const rol = user?.rol?.toUpperCase();
    if (rol === 'ALMACENISTA') {
      if (!user?.tipoSurtidoAlmacen) return true;
      const frentes = user.tipoSurtidoAlmacen.split(',').map((f) => f.trim().toUpperCase());
      return frentes.includes('TODOS') || frentes.includes(tipoFrente);
    }
    if (rol === 'AUDITOR') {
      if (!user?.tipoMaterialAuditor) return true;
      const frentes = user.tipoMaterialAuditor.split(',').map((f) => f.trim().toUpperCase());
      return frentes.includes('TODOS') || frentes.includes(tipoFrente);
    }
    return false;
  };

  const handleSepararFrente = async (tipoFrente: TipoFrenteMaterial) => {
    setOperatingFrente(tipoFrente);
    setFeedback(null);
    try {
      const res = await listadosApi.separar(data.id, tipoFrente);
      if (res.success && res.data) {
        setDetalle(res.data);
        setFeedback({
          type: 'success',
          message: `${TIPO_FRENTE_CONFIG[tipoFrente].nombre} separados correctamente.`,
        });
        onListadoUpdated?.(res.data, { accion: 'separar', tipoFrente });
      } else {
        setFeedback({
          type: 'error',
          message: res.message || `Error al separar ${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente}.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al separar.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setOperatingFrente(null);
    }
  };

  const handleEntregarFrente = async (tipoFrente: TipoFrenteMaterial) => {
    setOperatingFrente(tipoFrente);
    setFeedback(null);
    try {
      const res = await listadosApi.entregar(data.id, tipoFrente);
      if (res.success && res.data) {
        setDetalle(res.data);
        setFeedback({
          type: 'success',
          message: `${TIPO_FRENTE_CONFIG[tipoFrente].nombre} entregados a producción.`,
        });
        onListadoUpdated?.(res.data, { accion: 'entregar', tipoFrente });
      } else {
        setFeedback({
          type: 'error',
          message: res.message || `Error al entregar ${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente}.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al entregar.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setOperatingFrente(null);
    }
  };

  const handleDescontarFrente = async (tipoFrente: TipoFrenteMaterial) => {
    setOperatingFrente(tipoFrente);
    setFeedback(null);
    try {
      const res = await listadosApi.descontar(data.id, tipoFrente);
      if (res.success && res.data) {
        setDetalle(res.data);
        setFeedback({
          type: 'success',
          message: `${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente} descontado en sistema.`,
        });
        onListadoUpdated?.(res.data, { accion: 'descontar', tipoFrente });
      } else {
        setFeedback({
          type: 'error',
          message: res.message || `Error al descontar ${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente}.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al descontar.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setOperatingFrente(null);
    }
  };

  const handleRetrocederFrente = (tipoFrente: TipoFrenteMaterial) => {
    if (onRequestRetroceder) {
      onRequestRetroceder(data, tipoFrente);
    }
  };

  const frentes = data.frentes ?? [];
  const frentesVisibles = (() => {
    if (isSuperAdmin || isAdmin) return frentes;
    const rol = user?.rol?.toUpperCase();
    if (rol === 'ALMACENISTA') {
      if (!user?.tipoSurtidoAlmacen) return frentes;
      const permitidos = user.tipoSurtidoAlmacen.split(',').map((f) => f.trim().toUpperCase());
      if (permitidos.includes('TODOS')) return frentes;
      return frentes.filter((f) => permitidos.includes(f.tipoFrente));
    }
    if (rol === 'AUDITOR') {
      if (!user?.tipoMaterialAuditor) return frentes;
      const permitidos = user.tipoMaterialAuditor.split(',').map((f) => f.trim().toUpperCase());
      if (permitidos.includes('TODOS')) return frentes;
      return frentes.filter((f) => permitidos.includes(f.tipoFrente));
    }
    return frentes;
  })();

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl sm:max-w-3xl">
      <ModalHeader title="Detalle del Listado" onClose={onClose} />
      <ModalBody className="space-y-4 p-5 sm:p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
        {/* ─── Encabezado Limpio del Listado ─────────────────────────────── */}
        <div className="p-4 rounded-xl bg-app-surface border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono font-black text-xl text-text-primary tracking-tight">
                {data.numeroListado}
              </span>
            </div>
            <div className="text-xs text-text-secondary flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text-primary">{data.lineaProduccion?.nombre || 'Sin línea'}</span>
              {data.lineaProduccion?.area && (
                <span className="text-3xs uppercase font-extrabold text-text-muted">
                  ({data.lineaProduccion.area})
                </span>
              )}
              <span className="text-border">•</span>
              <span>{data.departamento?.nombre || 'Sin depto'}</span>
            </div>
          </div>

          <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 text-xs">
            <span className="text-3xs uppercase tracking-wider text-text-muted font-medium block">
              Fecha requerida
            </span>
            <span className="font-medium text-text-secondary">
              {formatFechaLocal(data.fechaRequerida)}
            </span>
          </div>
        </div>

        {/* ─── Feedback de Operación Inline ────────────────────────────── */}
        {errorDetalle && (
          <div className="p-3 rounded-lg border border-danger/30 bg-danger/10 text-danger text-xs flex items-center gap-2">
            <Icon name="error" size="xs" />
            <span>{errorDetalle}</span>
          </div>
        )}

        {feedback && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-success-subtle border-success/30 text-success-text'
                : 'bg-danger/10 border-danger/30 text-danger'
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              <Icon name={feedback.type === 'success' ? 'check_circle' : 'error'} size="xs" />
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-current opacity-70 hover:opacity-100 p-0.5 cursor-pointer"
            >
              <Icon name="close" size="xs" />
            </button>
          </div>
        )}

        {/* ─── MATERIALES (DIRECTOS / INDIRECTOS) ────────────────────── */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Materiales ({frentesVisibles.length})
            </h4>
          </div>

          {isLoadingDetalle ? (
            <div className="flex items-center justify-center gap-2 text-xs text-text-muted py-6">
              <Spinner size="14px" />
              <span>Cargando materiales...</span>
            </div>
          ) : frentesVisibles.length === 0 ? (
            <div className="p-5 rounded-xl bg-app-surface border border-dashed border-border text-center text-xs text-text-muted">
              No hay materiales asignados para mostrar.
            </div>
          ) : (
            <div className={`grid grid-cols-1 ${frentesVisibles.length === 1 ? 'max-w-md mx-auto w-full' : frentesVisibles.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3`}>
              {frentesVisibles.map((frente) => {
                const configTipo = TIPO_FRENTE_CONFIG[frente.tipoFrente];
                const isOperating = operatingFrente === frente.tipoFrente;
                const userCanOperateThis = puedeOperarFrente(frente.tipoFrente);

                return (
                  <div
                    key={frente.id}
                    className={`p-3 rounded-xl border shadow-2xs flex flex-col justify-between space-y-2.5 transition-colors ${
                      frente.estado === 'DESCONTADO'
                        ? 'border-purple-200 dark:border-purple-800/40 bg-purple-50/30 dark:bg-purple-950/10'
                        : frente.estado === 'ENTREGADO'
                        ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10'
                        : frente.estado === 'SEPARADO'
                        ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10'
                        : 'border-border bg-app-surface'
                    }`}
                  >
                    {/* Header del frente: Nombre y Badge de Estado */}
                    <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                      <span className="font-extrabold text-xs sm:text-sm text-text-primary truncate">
                        {configTipo?.nombre ?? frente.tipoFrente}
                      </span>
                      <FrenteStatusBadge estado={frente.estado} />
                    </div>

                    {/* Trazabilidad: 3 columnas optimizadas para que fecha y hora se lean completas sin cortarse */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-app-surface-muted/60 border border-border/50 text-[11px]">
                      {/* 1. SEPARADO (Naranja cuando es el estado actual) */}
                      <div className="min-w-0 flex flex-col">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${
                            frente.estado === 'SEPARADO'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-text-muted'
                          }`}
                        >
                          Separado
                        </span>
                        {frente.fechaSeparado ? (
                          <div
                            title={`${formatTimestamp(frente.fechaSeparado)}${
                              frente.separadoPor ? ` - ${frente.separadoPor.nombre || frente.separadoPor.usuario}` : ''
                            }`}
                          >
                            <span
                              className={`text-[10px] leading-tight block ${
                                frente.estado === 'SEPARADO'
                                  ? 'font-bold text-amber-700 dark:text-amber-300'
                                  : 'font-semibold text-text-primary'
                              }`}
                            >
                              {formatTimestamp(frente.fechaSeparado)}
                            </span>
                            {frente.separadoPor && (
                              <span
                                className={`text-[9px] truncate block mt-0.5 ${
                                  frente.estado === 'SEPARADO'
                                    ? 'text-amber-700/80 dark:text-amber-400/80'
                                    : 'text-text-muted'
                                }`}
                              >
                                {frente.separadoPor.nombre || frente.separadoPor.usuario}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted/40 font-bold text-[10px] block">—</span>
                        )}
                      </div>

                      {/* 2. ENTREGADO (Verde cuando es el estado actual) */}
                      <div
                        className={`min-w-0 border-l pl-2 flex flex-col ${
                          frente.estado === 'ENTREGADO' ? 'border-emerald-200 dark:border-emerald-800/50' : 'border-border/50'
                        }`}
                      >
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${
                            frente.estado === 'ENTREGADO'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-text-muted'
                          }`}
                        >
                          Entregado
                        </span>
                        {frente.fechaEntregado ? (
                          <div
                            title={`${formatTimestamp(frente.fechaEntregado)}${
                              frente.entregadoPor ? ` - ${frente.entregadoPor.nombre || frente.entregadoPor.usuario}` : ''
                            }`}
                          >
                            <span
                              className={`text-[10px] leading-tight block ${
                                frente.estado === 'ENTREGADO'
                                  ? 'font-bold text-emerald-700 dark:text-emerald-300'
                                  : 'font-semibold text-text-primary'
                              }`}
                            >
                              {formatTimestamp(frente.fechaEntregado)}
                            </span>
                            {frente.entregadoPor && (
                              <span
                                className={`text-[9px] truncate block mt-0.5 ${
                                  frente.estado === 'ENTREGADO'
                                    ? 'text-emerald-700/80 dark:text-emerald-400/80'
                                    : 'text-text-muted'
                                }`}
                              >
                                {frente.entregadoPor.nombre || frente.entregadoPor.usuario}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted/40 font-bold text-[10px] block">—</span>
                        )}
                      </div>

                      {/* 3. DESCONTADO (Morado cuando es el estado actual) */}
                      <div
                        className={`min-w-0 border-l pl-2 flex flex-col ${
                          frente.estado === 'DESCONTADO' ? 'border-purple-200 dark:border-purple-800/50' : 'border-border/50'
                        }`}
                      >
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${
                            frente.estado === 'DESCONTADO'
                              ? 'text-purple-700 dark:text-purple-400'
                              : 'text-text-muted'
                          }`}
                        >
                          Descontado
                        </span>
                        {frente.fechaDescontado ? (
                          <div
                            title={`${formatTimestamp(frente.fechaDescontado)}${
                              frente.descontadoPor ? ` - ${frente.descontadoPor.nombre || frente.descontadoPor.usuario}` : ''
                            }`}
                          >
                            <span
                              className={`text-[10px] leading-tight block ${
                                frente.estado === 'DESCONTADO'
                                  ? 'font-bold text-purple-700 dark:text-purple-300'
                                  : 'font-semibold text-text-primary'
                              }`}
                            >
                              {formatTimestamp(frente.fechaDescontado)}
                            </span>
                            {frente.descontadoPor && (
                              <span
                                className={`text-[9px] truncate block mt-0.5 ${
                                  frente.estado === 'DESCONTADO'
                                    ? 'text-purple-600/80 dark:text-purple-400/80'
                                    : 'text-text-muted'
                                }`}
                              >
                                {frente.descontadoPor.nombre || frente.descontadoPor.usuario}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted/40 font-bold text-[10px] block">—</span>
                        )}
                      </div>
                    </div>

                    {/* Acciones del frente */}
                    <div className="pt-0.5 flex flex-col gap-1.5">
                      {isOperating ? (
                        <div className="flex items-center justify-center py-1.5 text-2xs text-text-muted gap-1.5 bg-cuadra-arena/30 rounded-lg">
                          <Spinner size="12px" />
                          <span>Procesando...</span>
                        </div>
                      ) : (
                        <>
                          {/* SEPARAR */}
                          {frente.estado === 'PENDIENTE' && canSeparar && (
                            confirmInlineAction?.tipoFrente === frente.tipoFrente &&
                            confirmInlineAction.accion === 'separar' ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmInlineAction(null);
                                    handleSepararFrente(frente.tipoFrente);
                                  }}
                                  className="flex-1 text-xs h-8 inline-flex items-center justify-center gap-1 rounded-lg font-bold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs transition-colors cursor-pointer"
                                >
                                  <Icon name="check" size="xs" />
                                  <span>¿Confirmar separar?</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmInlineAction(null)}
                                  className="h-8 px-2.5 inline-flex items-center justify-center rounded-lg border border-border bg-app-surface hover:bg-app-surface-muted text-text-secondary text-xs transition-colors cursor-pointer"
                                  title="Cancelar"
                                >
                                  <Icon name="close" size="xs" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!userCanOperateThis}
                                onClick={() =>
                                  setConfirmInlineAction({
                                    tipoFrente: frente.tipoFrente,
                                    accion: 'separar',
                                  })
                                }
                                className="w-full text-xs h-8 inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs transition-colors cursor-pointer"
                              >
                                <span>Separar</span>
                                <Icon name="arrow_forward" size="xs" />
                              </button>
                            )
                          )}

                          {/* ENTREGAR A PRODUCCIÓN */}
                          {frente.estado === 'SEPARADO' && canEntregar && (
                            confirmInlineAction?.tipoFrente === frente.tipoFrente &&
                            confirmInlineAction.accion === 'entregar' ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmInlineAction(null);
                                    handleEntregarFrente(frente.tipoFrente);
                                  }}
                                  className="flex-1 text-xs h-8 inline-flex items-center justify-center gap-1 rounded-lg font-bold bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white shadow-xs transition-colors cursor-pointer"
                                >
                                  <Icon name="check" size="xs" />
                                  <span>¿Confirmar entrega?</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmInlineAction(null)}
                                  className="h-8 px-2.5 inline-flex items-center justify-center rounded-lg border border-border bg-app-surface hover:bg-app-surface-muted text-text-secondary text-xs transition-colors cursor-pointer"
                                  title="Cancelar"
                                >
                                  <Icon name="close" size="xs" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!userCanOperateThis}
                                onClick={() =>
                                  setConfirmInlineAction({
                                    tipoFrente: frente.tipoFrente,
                                    accion: 'entregar',
                                  })
                                }
                                className="w-full text-xs h-8 inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs transition-colors cursor-pointer"
                              >
                                <span>Entregar a Prod.</span>
                                <Icon name="arrow_forward" size="xs" />
                              </button>
                            )
                          )}

                          {/* DESCONTAR EN SISTEMA */}
                          {frente.estado === 'ENTREGADO' && canDescontar && (
                            confirmInlineAction?.tipoFrente === frente.tipoFrente &&
                            confirmInlineAction.accion === 'descontar' ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmInlineAction(null);
                                    handleDescontarFrente(frente.tipoFrente);
                                  }}
                                  className="flex-1 text-xs h-8 inline-flex items-center justify-center gap-1 rounded-lg font-bold bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white shadow-xs transition-colors cursor-pointer"
                                >
                                  <Icon name="check" size="xs" />
                                  <span>¿Confirmar descuento?</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmInlineAction(null)}
                                  className="h-8 px-2.5 inline-flex items-center justify-center rounded-lg border border-border bg-app-surface hover:bg-app-surface-muted text-text-secondary text-xs transition-colors cursor-pointer"
                                  title="Cancelar"
                                >
                                  <Icon name="close" size="xs" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmInlineAction({
                                    tipoFrente: frente.tipoFrente,
                                    accion: 'descontar',
                                  })
                                }
                                className="w-full text-xs h-8 inline-flex items-center justify-center rounded-lg font-semibold bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-xs transition-colors cursor-pointer"
                              >
                                <Icon name="done_all" size="xs" className="mr-1" />
                                Descontar en Sistema
                              </button>
                            )
                          )}

                          {(frente.estado === 'SEPARADO' || frente.estado === 'ENTREGADO') &&
                            canRetroceder && (
                              <button
                                type="button"
                                onClick={() => handleRetrocederFrente(frente.tipoFrente)}
                                className="w-full inline-flex items-center justify-center gap-1 text-[11px] font-medium text-text-muted hover:text-warning-text hover:bg-warning/10 py-1 px-2 rounded-md transition-colors cursor-pointer"
                              >
                                <Icon name="undo" size="xs" className="opacity-70" />
                                <span>Retroceder</span>
                              </button>
                            )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter className="flex items-center justify-between p-4 sm:p-5 border-t border-border bg-app-surface-muted/30">
        <div className="flex items-center gap-2">
          <Button type="button" variant="cancelar" onClick={onClose} className="h-9 text-xs">
            Cerrar
          </Button>
          {canCancelarListado && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                onRequestCancelar?.(data);
              }}
              className="h-9 text-xs text-danger border-danger/40 hover:bg-danger/10 hover:border-danger/60"
            >
              <Icon name="block" size="xs" className="mr-1.5" />
              Cancelar Listado
            </Button>
          )}
        </div>
        {canEdit && onEdit && (
          <Button
            type="button"
            variant="accion"
            onClick={() => {
              onClose();
              onEdit(data);
            }}
            className="h-9 text-xs"
          >
            <Icon name="edit" size="xs" className="mr-1.5" />
            Editar Listado
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
