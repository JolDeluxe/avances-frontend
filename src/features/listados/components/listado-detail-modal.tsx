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
import { ListadoAccionModal } from './listado-accion-modal';
import type { ListadoItem, TipoFrenteMaterial } from '../types/listados.types';

export interface ListadoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  listado: ListadoItem | null;
  onEdit?: (listado: ListadoItem) => void;
  onRequestRetroceder?: (listado: ListadoItem, tipoFrente: TipoFrenteMaterial) => void;
  onListadoUpdated?: (listado: ListadoItem) => void;
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
    const hora = d.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${dia} ${hora}`;
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
  onListadoUpdated,
  allowSeparar = true,
}: ListadoDetailModalProps): ReactNode {
  const { user, can, isSuperAdmin, isAdmin } = usePermissions();

  const [detalle, setDetalle] = useState<ListadoItem | null>(null);
  const [isLoadingDetalle, setIsLoadingDetalle] = useState<boolean>(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [operatingFrente, setOperatingFrente] = useState<TipoFrenteMaterial | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmDescontarFrente, setConfirmDescontarFrente] = useState<TipoFrenteMaterial | null>(null);

  // Cargar detalle completo (con frentes e historialEstados) al abrir
  useEffect(() => {
    if (!isOpen || !listado) {
      setDetalle(null);
      setErrorDetalle(null);
      setOperatingFrente(null);
      setFeedback(null);
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
  const canEdit = data.estado === 'PENDIENTE';

  // Permisos efectivos para operaciones de listados
  const canSeparar = allowSeparar && can(PERMISOS.LISTADO_SEPARAR);
  const canEntregar = can(PERMISOS.LISTADO_ENTREGAR);
  const canRetroceder = (isSuperAdmin || isAdmin) && can(PERMISOS.LISTADO_RETROCEDER);
  const canDescontar = can(PERMISOS.LISTADO_DESCONTAR);

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
          message: `Frente ${TIPO_FRENTE_CONFIG[tipoFrente].shortLabel} separado correctamente.`,
        });
        onListadoUpdated?.(res.data);
      } else {
        setFeedback({
          type: 'error',
          message: res.message || `Error al separar el frente ${tipoFrente}.`,
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
          message: `Frente ${TIPO_FRENTE_CONFIG[tipoFrente].shortLabel} entregado a producción.`,
        });
        onListadoUpdated?.(res.data);
      } else {
        setFeedback({
          type: 'error',
          message: res.message || `Error al entregar el frente ${tipoFrente}.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al entregar.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setOperatingFrente(null);
    }
  };

  const handleRequestDescontarFrente = (tipoFrente: TipoFrenteMaterial) => {
    setConfirmDescontarFrente(tipoFrente);
  };

  const handleConfirmDescontarAction = async () => {
    if (!confirmDescontarFrente) return;
    const tipoFrente = confirmDescontarFrente;
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
        setConfirmDescontarFrente(null);
        onListadoUpdated?.(res.data);
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
              <span className="text-border">•</span>
              <span>Registrado por {data.creadoPorUsuario?.nombre || data.creadoPorUsuario?.usuario || 'Sistema'}</span>
            </div>
          </div>

          <div className="sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
            <span className="text-2xs uppercase tracking-wider text-text-muted font-medium block">
              Fecha requerida
            </span>
            <span className="text-sm font-bold text-text-primary">
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

                    {/* Trazabilidad Discreta y Compacta (3 micro-columnas) */}
                    <div className="grid grid-cols-3 gap-1.5 py-1.5 px-2 rounded-lg bg-app-surface-muted/60 border border-border/50 text-[11px]">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">
                          Separado
                        </span>
                        {frente.fechaSeparado ? (
                          <div
                            className="truncate"
                            title={`${formatTimestamp(frente.fechaSeparado)}${
                              frente.separadoPor ? ` - ${frente.separadoPor.nombre || frente.separadoPor.usuario}` : ''
                            }`}
                          >
                            <span className="font-semibold text-text-primary text-[10px] sm:text-[11px] block truncate">
                              {formatTimestamp(frente.fechaSeparado)}
                            </span>
                            {frente.separadoPor && (
                              <span className="text-[9px] text-text-muted truncate block">
                                {frente.separadoPor.nombre || frente.separadoPor.usuario}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted/40 font-bold text-[10px] block">—</span>
                        )}
                      </div>

                      <div className="min-w-0 border-l border-border/50 pl-1.5">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">
                          Entregado
                        </span>
                        {frente.fechaEntregado ? (
                          <div
                            className="truncate"
                            title={`${formatTimestamp(frente.fechaEntregado)}${
                              frente.entregadoPor ? ` - ${frente.entregadoPor.nombre || frente.entregadoPor.usuario}` : ''
                            }`}
                          >
                            <span className="font-semibold text-text-primary text-[10px] sm:text-[11px] block truncate">
                              {formatTimestamp(frente.fechaEntregado)}
                            </span>
                            {frente.entregadoPor && (
                              <span className="text-[9px] text-text-muted truncate block">
                                {frente.entregadoPor.nombre || frente.entregadoPor.usuario}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted/40 font-bold text-[10px] block">—</span>
                        )}
                      </div>

                      <div className={`min-w-0 border-l pl-1.5 ${frente.estado === 'DESCONTADO' ? 'border-purple-200' : 'border-border/50'}`}>
                        <span className={`text-[9px] font-bold uppercase tracking-wider block ${frente.estado === 'DESCONTADO' ? 'text-purple-700 dark:text-purple-400' : 'text-text-muted'}`}>
                          Descontado
                        </span>
                        {frente.fechaDescontado ? (
                          <div
                            className="truncate"
                            title={`${formatTimestamp(frente.fechaDescontado)}${
                              frente.descontadoPor ? ` - ${frente.descontadoPor.nombre || frente.descontadoPor.usuario}` : ''
                            }`}
                          >
                            <span className="font-semibold text-purple-700 dark:text-purple-300 text-[10px] sm:text-[11px] block truncate">
                              {formatTimestamp(frente.fechaDescontado)}
                            </span>
                            {frente.descontadoPor && (
                              <span className="text-[9px] text-purple-600/80 dark:text-purple-400/80 truncate block">
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
                          {frente.estado === 'PENDIENTE' && canSeparar && (
                            <Button
                              type="button"
                              size="sm"
                              variant="accion"
                              disabled={!userCanOperateThis}
                              onClick={() => handleSepararFrente(frente.tipoFrente)}
                              className="w-full text-xs h-8"
                            >
                              <Icon name="inventory_2" size="xs" className="mr-1" />
                              Separar
                            </Button>
                          )}

                          {frente.estado === 'SEPARADO' && canEntregar && (
                            <Button
                              type="button"
                              size="sm"
                              variant="success"
                              disabled={!userCanOperateThis}
                              onClick={() => handleEntregarFrente(frente.tipoFrente)}
                              className="w-full text-xs h-8"
                            >
                              <Icon name="local_shipping" size="xs" className="mr-1" />
                              Entregar a Prod.
                            </Button>
                          )}

                          {frente.estado === 'ENTREGADO' && canDescontar && (
                            <button
                              type="button"
                              onClick={() => handleRequestDescontarFrente(frente.tipoFrente)}
                              className="w-full text-xs h-8 inline-flex items-center justify-center rounded-lg font-semibold bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-xs transition-colors cursor-pointer"
                            >
                              <Icon name="done_all" size="xs" className="mr-1" />
                              Descontar en Sistema
                            </button>
                          )}

                          {(frente.estado === 'SEPARADO' || frente.estado === 'ENTREGADO') &&
                            canRetroceder && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetrocederFrente(frente.tipoFrente)}
                                className="w-full text-2xs h-7 text-warning-text hover:bg-warning-subtle"
                              >
                                <Icon name="undo" size="xs" className="mr-1" />
                                Retroceder
                              </Button>
                            )}

                          {frente.estado === 'DESCONTADO' && (
                            <div className="text-center text-3xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 py-1.5 bg-purple-100/60 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
                              ✓ Descontado en Sistema
                            </div>
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
        <Button type="button" variant="cancelar" onClick={onClose} className="h-9 text-xs">
          Cerrar
        </Button>
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

      {/* Modal de confirmación para Descontar en Sistema */}
      {confirmDescontarFrente && (
        <ListadoAccionModal
          isOpen={Boolean(confirmDescontarFrente)}
          onClose={() => setConfirmDescontarFrente(null)}
          listado={data}
          tipoFrente={confirmDescontarFrente}
          accion="descontar"
          onConfirm={handleConfirmDescontarAction}
          isSubmitting={operatingFrente === confirmDescontarFrente}
        />
      )}
    </Modal>
  );
}
