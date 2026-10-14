import { useState, useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useListados } from '../../hooks/use-listados';
import { useLineasProduccion } from '../../hooks/use-lineas-produccion';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ListadosPendientesParalelaTable } from '../../components/listados-pendientes-paralela-table';
import { ListadoFormModal } from '../../components/listado-form-modal';
import { ListadoDetailModal } from '../../components/listado-detail-modal';
import { ListadoTransitionModal, type TransitionAction } from '../../components/listado-transition-modal';
import { listadosApi } from '../../api/listados-api';
import { clasificarListadosPorArea } from '../../utils/classify-listados';
import { TIPO_FRENTE_CONFIG } from '@/config/status-config';
import type { ListadoItem, TipoFrenteMaterial } from '../../types/listados.types';

/**
 * Formatea una fecha ISO/YYYY-MM-DD → dd/mm/aaaa sin UTC shift.
 */
function formatFecha(fechaStr: string): string {
  const solo = fechaStr.includes('T') ? fechaStr.slice(0, 10) : fechaStr;
  const [year, month, day] = solo.split('-');
  if (!year || !month || !day) return fechaStr;
  return `${day}/${month}/${year}`;
}

/**
 * Submódulo ADMINISTRACIÓN de Listados.
 *
 * Tablero Operativo Completo en dos bloques paralelos (BOTA / ACCESORIOS).
 * Contiene todas las columnas operativas y de trazabilidad:
 * BOTA:       NO | LISTADO | Fecha Req. | Estado | Línea | DIR | IND | Acciones
 * ACCESORIOS: NO | LISTADO | Fecha Req. | Estado | Línea | DIR | IND | BOL | Acciones
 */
export function ListadosAdministracionPage(): ReactNode {
  const { user, hasPermission, isSuperAdmin, isAdmin } = usePermissions();
  const canVer = hasPermission('listado:ver');
  const canCrear = hasPermission('listado:crear');
  const canEditar = hasPermission('listado:editar');
  const canEntregar = hasPermission('listado:entregar');
  const canRetroceder = (isSuperAdmin || isAdmin) && hasPermission('listado:retroceder');
  const canCancelar = hasPermission('listado:cancelar');

  const {
    items,
    pagination,
    isLoading,
    error,
    reloadListados,
    setPage,
  } = useListados({ fixedEstado: 'PENDIENTE' });

  const { departamentos, todasLasLineas } = useLineasProduccion();

  // ─── Desactivación / Atenuación visual de bloques por línea asignada ────────
  const { isBotaDisabled, isAccesoriosDisabled } = useMemo(() => {
    if (isSuperAdmin || isAdmin) {
      return { isBotaDisabled: false, isAccesoriosDisabled: false };
    }
    const lineas = user?.lineasAsignadas ?? [];
    if (lineas.length === 0) {
      return { isBotaDisabled: false, isAccesoriosDisabled: false };
    }
    const hasBota = lineas.some((l) => l.area === 'BOTA');
    const hasAccesorios = lineas.some((l) => l.area === 'ACCESORIOS');
    return {
      isBotaDisabled: !hasBota,
      isAccesoriosDisabled: !hasAccesorios,
    };
  }, [isSuperAdmin, isAdmin, user?.lineasAsignadas]);

  // ─── Estado de modales y feedback ──────────────────────────────────────────
  const [selectedListado, setSelectedListado] = useState<ListadoItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formListado, setFormListado] = useState<ListadoItem | null>(null);
  const [isTransitionOpen, setIsTransitionOpen] = useState<boolean>(false);
  const [transitionAction, setTransitionAction] = useState<TransitionAction>('retroceder');
  const [transitionTipoFrente, setTransitionTipoFrente] = useState<TipoFrenteMaterial | undefined>(undefined);
  const [mutatingRows, setMutatingRows] = useState<Record<number, string | null>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [highlightedListadoId, setHighlightedListadoId] = useState<number | null>(null);
  const [entregandoListadoId, setEntregandoListadoId] = useState<number | null>(null);
  const [entregandoFrente, setEntregandoFrente] = useState<TipoFrenteMaterial | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenDetail = (listado: ListadoItem) => {
    setSelectedListado(listado);
    setIsDetailOpen(true);
  };

  const handleOpenCreate = () => {
    setFormListado(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (listado: ListadoItem) => {
    setFormListado(listado);
    setIsFormOpen(true);
  };

  const handleOpenRetrocederFrente = (listado: ListadoItem, tipoFrente?: TipoFrenteMaterial) => {
    setSelectedListado(listado);
    setTransitionTipoFrente(tipoFrente);
    setTransitionAction('retroceder');
    setIsTransitionOpen(true);
  };

  const handleOpenCancelarListado = (listado: ListadoItem) => {
    setSelectedListado(listado);
    setTransitionTipoFrente(undefined);
    setTransitionAction('cancelar');
    setIsTransitionOpen(true);
  };

  const handleEntregarFrente = async (listado: ListadoItem, tipoFrente: TipoFrenteMaterial) => {
    setMutatingRows((prev) => ({ ...prev, [listado.id]: 'entregar' }));
    try {
      const res = await listadosApi.entregar(listado.id, tipoFrente);
      if (res.success) {
        showFeedback(
          'success',
          `${TIPO_FRENTE_CONFIG[tipoFrente]?.nombre ?? tipoFrente} de listado ${listado.numeroListado} entregado a producción.`,
        );
        setEntregandoListadoId(listado.id);
        setEntregandoFrente(tipoFrente);
        setTimeout(() => {
          setEntregandoListadoId((curr) => (curr === listado.id ? null : curr));
          setEntregandoFrente((curr) => (curr === tipoFrente ? null : curr));
          reloadListados();
        }, 2000);
      } else {
        showFeedback('error', res.message || 'Error al entregar el frente.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al entregar.';
      showFeedback('error', msg);
      reloadListados();
    } finally {
      setMutatingRows((prev) => ({ ...prev, [listado.id]: null }));
    }
  };

  // Filtrar exclusivamente los listados en PENDIENTE que NO tengan ningún avance de Almacén
  // (es decir, ningún frente separado, entregado ni descontado). En cuanto Almacén interactúe, salen de esta pestaña.
  const itemsPendientesSinAvance = useMemo(() => {
    return items.filter((it) => {
      if (it.estado !== 'PENDIENTE') return false;
      const frentes = it.frentes ?? [];
      const tieneAvance = frentes.some(
        (f) => f.estado === 'SEPARADO' || f.estado === 'ENTREGADO' || f.estado === 'DESCONTADO',
      );
      return !tieneAvance;
    });
  }, [items]);

  // Clasificación dinámica de registros en BOTA y ACCESORIOS desde el catálogo del backend
  const { botaItems, accesoriosItems, noClasificados } = useMemo(() => {
    return clasificarListadosPorArea(itemsPendientesSinAvance, todasLasLineas);
  }, [itemsPendientesSinAvance, todasLasLineas]);

  // ─── Sin permiso ──────────────────────────────────────────────────────────
  if (!canVer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
          <Icon name="lock" size="lg" className="text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Acceso restringido</h2>
        <p className="text-sm text-text-secondary max-w-sm">
          No tienes permiso para ver el módulo de Listados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
        {canCrear && (
          <Button
            variant="guardar"
            size="sm"
            icon="add_circle"
            onClick={handleOpenCreate}
            className="shrink-0 text-xs h-8 px-3"
          >
            Nuevo Listado
          </Button>
        )}
      </div>

      {/* Feedback flotante */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-xs ${
            feedback.type === 'success'
              ? 'bg-success-subtle border-success/30 text-success-text'
              : 'bg-danger/10 border-danger/30 text-danger'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            <Icon name={feedback.type === 'success' ? 'check_circle' : 'error'} size="sm" />
            {feedback.message}
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-current opacity-70 hover:opacity-100">
            <Icon name="close" size="xs" />
          </button>
        </div>
      )}

      {/* Discrepancias / No clasificados de Almacén MBC */}
      {noClasificados.length > 0 && !isLoading && (
        <div className="p-3 bg-warning-subtle border border-warning/30 rounded-xl text-xs text-warning-text flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="warning" size="xs" className="shrink-0" />
            <span>
              Hay {noClasificados.length} listado(s) de Almacén MBC con línea sin clasificación provisional ({noClasificados.map((i) => i.lineaProduccion.codigo).join(', ')}). No se enviaron a ningún bloque para evitar clasificaciones erróneas.
            </span>
          </div>
        </div>
      )}

      {/* Error de red */}
      {error && !isLoading && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger font-medium flex items-center gap-2">
          <Icon name="error" size="xs" />
          {error}
        </div>
      )}

      {/* ─── TABLA OPERATIVA PARALELA (BOTA / ACCESORIOS) ────────────────── */}
      <ListadosPendientesParalelaTable
        botaItems={botaItems}
        accesoriosItems={accesoriosItems}
        formatFecha={formatFecha}
        isLoading={isLoading}
        page={pagination.page}
        limit={pagination.limit}
        highlightedListadoId={highlightedListadoId}
        entregandoListadoId={entregandoListadoId}
        entregandoFrente={entregandoFrente}
        emptyMessage="No hay listados de Almacén MBC para mostrar."
        isBotaDisabled={isBotaDisabled}
        isAccesoriosDisabled={isAccesoriosDisabled}
        pagination={{
          currentPage: pagination.page,
          totalPages: pagination.totalPages,
          totalItems: pagination.total,
          itemsPerPage: pagination.limit,
          onPageChange: setPage,
        }}
        acciones={{
          onVerDetalle: handleOpenDetail,
          onEditar: handleOpenEdit,
          onSepararFrente: undefined,
          onEntregarFrente: handleEntregarFrente,
          onRetrocederFrente: handleOpenRetrocederFrente,
          onCancelar: handleOpenCancelarListado,
          mutatingRows,
          canSeparar: false,
          canEntregar,
          canEditar,
          canRetroceder,
          canCancelar,
        }}
      />

      {/* Modales */}
      <ListadoDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        listado={selectedListado}
        allowSeparar={false}
        onEdit={canEditar ? handleOpenEdit : undefined}
        onRequestCancelar={canCancelar ? (listado) => {
          setIsDetailOpen(false);
          handleOpenCancelarListado(listado);
        } : undefined}
        onRequestRetroceder={(listado, tipoFrente) => {
          setIsDetailOpen(false);
          handleOpenRetrocederFrente(listado, tipoFrente);
        }}
        onListadoUpdated={() => {
          reloadListados();
        }}
      />

      <ListadoFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        listado={formListado}
        departamentos={departamentos}
        onSuccess={(savedItem) => {
          const isEdit = Boolean(formListado);
          showFeedback(
            'success',
            isEdit ? 'Listado actualizado correctamente.' : 'Listado creado con éxito.',
          );
          if (savedItem?.id) {
            setHighlightedListadoId(savedItem.id);
            // El destello se desvanece automáticamente; limpiamos el estado a los 5 segundos
            setTimeout(() => {
              setHighlightedListadoId((curr) => (curr === savedItem.id ? null : curr));
            }, 5000);
          }
          reloadListados();
        }}
      />

      <ListadoTransitionModal
        isOpen={isTransitionOpen}
        onClose={() => {
          setIsTransitionOpen(false);
          setTransitionTipoFrente(undefined);
        }}
        listado={selectedListado}
        action={transitionAction}
        tipoFrente={transitionTipoFrente}
        onSuccess={(updated) => {
          const msg =
            transitionAction === 'cancelar'
              ? `Listado ${updated.numeroListado} cancelado.`
              : `Operación completada en listado ${updated.numeroListado}.`;
          showFeedback('success', msg);
          reloadListados();
        }}
      />
    </div>
  );
}
