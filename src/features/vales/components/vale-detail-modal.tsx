import { useState, useEffect, type ReactNode } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { ValeStatusBadge } from '@/components/ui/status-badge';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { PERMISOS } from '@/config/permissions';
import { canOperateValeItem } from '../utils/classify-vales';
import { valesApi } from '../api/vales-api';
import type { ValeItem } from '../types/vales.types';
import type { TipoAccionVale } from './vale-accion-modal';

export interface ValeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  vale: ValeItem | null;
  onAccion?: (item: ValeItem, accion: TipoAccionVale) => void;
  onTransition?: (item: ValeItem, action: 'retroceder' | 'cancelar') => void;
  onEdit?: (item: ValeItem) => void;
  onValeUpdated?: (updated: ValeItem) => void;
  allowSeparar?: boolean;
}

/**
 * Formatea una fecha ISO o YYYY-MM-DD en dd/mm/aaaa sin transformaciones de timezone.
 */
function formatFechaLocal(fechaStr?: string | null): string {
  if (!fechaStr) return '—';
  const solo =
    typeof fechaStr === 'string'
      ? fechaStr.includes('T')
        ? fechaStr.slice(0, 10)
        : fechaStr
      : '';
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
    const isMidnightUtc =
      d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
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

export function ValeDetailModal({
  isOpen,
  onClose,
  vale,
  onTransition,
  onEdit,
  onValeUpdated,
  allowSeparar = true,
}: ValeDetailModalProps): ReactNode {
  const { can, user } = usePermissions();

  const [detalle, setDetalle] = useState<ValeItem | null>(null);
  const [isLoadingDetalle, setIsLoadingDetalle] = useState<boolean>(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [isOperating, setIsOperating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [confirmInlineAction, setConfirmInlineAction] = useState<
    'separar' | 'entregar' | 'descontar' | null
  >(null);

  useEffect(() => {
    if (!isOpen || !vale) {
      setDetalle(null);
      setErrorDetalle(null);
      setIsOperating(false);
      setFeedback(null);
      setConfirmInlineAction(null);
      return;
    }

    let cancelled = false;

    const fetchDetalle = async () => {
      setIsLoadingDetalle(true);
      setErrorDetalle(null);
      try {
        const res = await valesApi.getValeById(vale.id);
        if (!cancelled) {
          setDetalle(res);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : 'Error inesperado al cargar el detalle.';
          setErrorDetalle(msg);
          setDetalle(vale);
        }
      } finally {
        if (!cancelled) setIsLoadingDetalle(false);
      }
    };

    void fetchDetalle();

    return () => {
      cancelled = true;
    };
  }, [isOpen, vale]);

  if (!vale) return null;

  const data = detalle ?? vale;

  // Permisos efectivos y alcance operativo sobre este vale específico
  const canOperateThis = canOperateValeItem(user, data);

  const canSeparar =
    canOperateThis && Boolean(allowSeparar) && can(PERMISOS.VALE_SEPARAR);
  const canEntregar = canOperateThis && can(PERMISOS.VALE_ENTREGAR);
  const canDescontar = canOperateThis && can(PERMISOS.VALE_DESCONTAR);
  const canRetroceder = canOperateThis && can(PERMISOS.VALE_RETROCEDER);
  const canRetrocederDescuento =
    canOperateThis && can(PERMISOS.VALE_RETROCEDER_DESCUENTO);

  const canRollbackCurrent =
    (data.estado === 'SEPARADO' && canRetroceder) ||
    (data.estado === 'ENTREGADO' && canRetroceder) ||
    (data.estado === 'DESCONTADO' && canRetrocederDescuento);

  const canEdit =
    canOperateThis && can(PERMISOS.VALE_EDITAR) && data.estado === 'PENDIENTE';

  const canCancelarVale =
    Boolean(onTransition) &&
    canOperateThis &&
    can(PERMISOS.VALE_CANCELAR) &&
    (data.estado === 'PENDIENTE' || data.estado === 'SEPARADO');

  const handleSeparar = async () => {
    setIsOperating(true);
    setFeedback(null);
    try {
      const updated = await valesApi.separarVale(data.id, {});
      setDetalle(updated);
      setFeedback({
        type: 'success',
        message: 'Vale separado correctamente.',
      });
      onValeUpdated?.(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al separar.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsOperating(false);
    }
  };

  const handleEntregar = async () => {
    setIsOperating(true);
    setFeedback(null);
    try {
      const updated = await valesApi.entregarVale(data.id);
      setDetalle(updated);
      setFeedback({
        type: 'success',
        message: 'Vale entregado a producción.',
      });
      onValeUpdated?.(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al entregar.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsOperating(false);
    }
  };

  const handleDescontar = async () => {
    setIsOperating(true);
    setFeedback(null);
    try {
      const updated = await valesApi.descontarVale(data.id);
      setDetalle(updated);
      setFeedback({
        type: 'success',
        message: 'Vale descontado en sistema.',
      });
      onValeUpdated?.(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al descontar.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsOperating(false);
    }
  };

  const handleRetroceder = () => {
    if (onTransition) {
      onClose();
      onTransition(data, 'retroceder');
    }
  };

  const rawIso = data.fechaSolicitud ?? '';
  const horaMostrada =
    data.horaSolicitud ??
    (data.tieneHoraSolicitud && rawIso.includes('T') ? rawIso.slice(11, 16) : null);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl sm:max-w-3xl">
      <ModalHeader title="Detalle del Vale" onClose={onClose} />
      <ModalBody className="space-y-4 p-5 sm:p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
        {/* ─── Encabezado Limpio del Vale ─────────────────────────────── */}
        <div className="p-4 rounded-xl bg-app-surface border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono font-black text-xl text-text-primary tracking-tight">
                {data.folio}
              </span>
            </div>
            <div className="text-xs text-text-secondary flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text-primary">
                {data.departamentoVale?.nombre || 'Sin línea'}
              </span>
              <span className="text-border">•</span>
              <span>Serie {data.serie?.codigo || '—'}</span>
            </div>
          </div>

          <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 text-xs">
            <span className="text-3xs uppercase tracking-wider text-text-muted font-medium block">
              Fecha solicitud
            </span>
            <span className="font-medium text-text-secondary">
              {formatFechaLocal(data.fechaSolicitud)}
              {data.tieneHoraSolicitud && horaMostrada ? ` ${horaMostrada}` : ''}
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

        {/* ─── MATERIAL / ESTADO DEL VALE ────────────────────────────── */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Material (1)
            </h4>
          </div>

          {isLoadingDetalle ? (
            <div className="grid grid-cols-1 max-w-md mx-auto w-full gap-3 py-2">
              <div className="p-4 rounded-xl border border-border bg-app-surface space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-app-surface-muted/60">
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 max-w-md mx-auto w-full gap-3">
              <div
                className={`p-3 rounded-xl border shadow-2xs flex flex-col justify-between space-y-2.5 transition-colors ${
                  data.estado === 'DESCONTADO'
                    ? 'border-purple-200 dark:border-purple-800/40 bg-purple-50/30 dark:bg-purple-950/10'
                    : data.estado === 'ENTREGADO'
                    ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10'
                    : data.estado === 'SEPARADO'
                    ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10'
                    : 'border-border bg-app-surface'
                }`}
              >
                {/* Header del vale: Nombre y Badge de Estado */}
                <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                  <span className="font-extrabold text-xs sm:text-sm text-text-primary truncate">
                    {data.serie?.codigo ? `${data.serie.codigo} · ` : ''} {data.folio}
                  </span>
                  <ValeStatusBadge estado={data.estado} />
                </div>

                {/* Trazabilidad: 3 columnas optimizadas para que fecha y hora se lean completas sin cortarse */}
                <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-lg bg-app-surface-muted/60 border border-border/50 text-[11px]">
                  {/* 1. SEPARADO (Naranja cuando es el estado actual) */}
                  <div className="min-w-0 flex flex-col">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${
                        data.estado === 'SEPARADO'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-text-muted'
                      }`}
                    >
                      Separado
                    </span>
                    {data.fechaSeparado ? (
                      <div
                        title={`${formatTimestamp(data.fechaSeparado)}${
                          data.separadoPor
                            ? ` - ${data.separadoPor.nombre || data.separadoPor.usuario}`
                            : ''
                        }`}
                      >
                        <span
                          className={`text-[10px] leading-tight block ${
                            data.estado === 'SEPARADO'
                              ? 'font-bold text-amber-700 dark:text-amber-300'
                              : 'font-semibold text-text-primary'
                          }`}
                        >
                          {formatTimestamp(data.fechaSeparado)}
                        </span>
                        {data.separadoPor && (
                          <span
                            className={`text-[9px] truncate block mt-0.5 ${
                              data.estado === 'SEPARADO'
                                ? 'text-amber-700/80 dark:text-amber-400/80'
                                : 'text-text-muted'
                            }`}
                          >
                            {data.separadoPor.nombre || data.separadoPor.usuario}
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
                      data.estado === 'ENTREGADO'
                        ? 'border-emerald-200 dark:border-emerald-800/50'
                        : 'border-border/50'
                    }`}
                  >
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${
                        data.estado === 'ENTREGADO'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-text-muted'
                      }`}
                    >
                      Entregado
                    </span>
                    {data.fechaEntregado ? (
                      <div
                        title={`${formatTimestamp(data.fechaEntregado)}${
                          data.entregadoPor
                            ? ` - ${data.entregadoPor.nombre || data.entregadoPor.usuario}`
                            : ''
                        }`}
                      >
                        <span
                          className={`text-[10px] leading-tight block ${
                            data.estado === 'ENTREGADO'
                              ? 'font-bold text-emerald-700 dark:text-emerald-300'
                              : 'font-semibold text-text-primary'
                          }`}
                        >
                          {formatTimestamp(data.fechaEntregado)}
                        </span>
                        {data.entregadoPor && (
                          <span
                            className={`text-[9px] truncate block mt-0.5 ${
                              data.estado === 'ENTREGADO'
                                ? 'text-emerald-700/80 dark:text-emerald-400/80'
                                : 'text-text-muted'
                            }`}
                          >
                            {data.entregadoPor.nombre || data.entregadoPor.usuario}
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
                      data.estado === 'DESCONTADO'
                        ? 'border-purple-200 dark:border-purple-800/50'
                        : 'border-border/50'
                    }`}
                  >
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${
                        data.estado === 'DESCONTADO'
                          ? 'text-purple-700 dark:text-purple-400'
                          : 'text-text-muted'
                      }`}
                    >
                      Descontado
                    </span>
                    {data.fechaDescontado ? (
                      <div
                        title={`${formatTimestamp(data.fechaDescontado)}${
                          data.descontadoPor
                            ? ` - ${data.descontadoPor.nombre || data.descontadoPor.usuario}`
                            : ''
                        }`}
                      >
                        <span
                          className={`text-[10px] leading-tight block ${
                            data.estado === 'DESCONTADO'
                              ? 'font-bold text-purple-700 dark:text-purple-300'
                              : 'font-semibold text-text-primary'
                          }`}
                        >
                          {formatTimestamp(data.fechaDescontado)}
                        </span>
                        {data.descontadoPor && (
                          <span
                            className={`text-[9px] truncate block mt-0.5 ${
                              data.estado === 'DESCONTADO'
                                ? 'text-purple-600/80 dark:text-purple-400/80'
                                : 'text-text-muted'
                            }`}
                          >
                            {data.descontadoPor.nombre || data.descontadoPor.usuario}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-text-muted/40 font-bold text-[10px] block">—</span>
                    )}
                  </div>
                </div>

                {/* Acciones del vale */}
                <div className="pt-0.5 flex flex-col gap-1.5">
                  {isOperating ? (
                    <div className="flex items-center justify-center py-1.5 text-2xs text-text-muted gap-1.5 bg-cuadra-arena/30 rounded-lg">
                      <Spinner size="12px" />
                      <span>Procesando...</span>
                    </div>
                  ) : (
                    <>
                      {/* SEPARAR */}
                      {data.estado === 'PENDIENTE' &&
                        canSeparar &&
                        (confirmInlineAction === 'separar' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmInlineAction(null);
                                void handleSeparar();
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
                            onClick={() => setConfirmInlineAction('separar')}
                            className="w-full text-xs h-8 inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs transition-colors cursor-pointer"
                          >
                            <span>Separar</span>
                            <Icon name="arrow_forward" size="xs" />
                          </button>
                        ))}

                      {/* ENTREGAR A PRODUCCIÓN */}
                      {data.estado === 'SEPARADO' &&
                        canEntregar &&
                        (confirmInlineAction === 'entregar' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmInlineAction(null);
                                void handleEntregar();
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
                            onClick={() => setConfirmInlineAction('entregar')}
                            className="w-full text-xs h-8 inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs transition-colors cursor-pointer"
                          >
                            <span>Entregar a Prod.</span>
                            <Icon name="arrow_forward" size="xs" />
                          </button>
                        ))}

                      {/* DESCONTAR EN SISTEMA */}
                      {data.estado === 'ENTREGADO' &&
                        canDescontar &&
                        (confirmInlineAction === 'descontar' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmInlineAction(null);
                                void handleDescontar();
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
                            onClick={() => setConfirmInlineAction('descontar')}
                            className="w-full text-xs h-8 inline-flex items-center justify-center rounded-lg font-semibold bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-xs transition-colors cursor-pointer"
                          >
                            <Icon name="done_all" size="xs" className="mr-1" />
                            Descontar en Sistema
                          </button>
                        ))}

                      {canRollbackCurrent && (
                        <button
                          type="button"
                          onClick={handleRetroceder}
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
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter className="flex items-center justify-between p-4 sm:p-5 border-t border-border bg-app-surface-muted/30">
        <div className="flex items-center gap-2">
          <Button type="button" variant="cancelar" onClick={onClose} className="h-9 text-xs">
            Cerrar
          </Button>
          {canCancelarVale && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                onTransition?.(data, 'cancelar');
              }}
              className="h-9 text-xs text-danger border-danger/40 hover:bg-danger/10 hover:border-danger/60"
            >
              <Icon name="block" size="xs" className="mr-1.5" />
              Cancelar Vale
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
            Editar Vale
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
