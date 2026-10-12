import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils/cn';
import { useListados } from '../../hooks/use-listados';
import { useLineasProduccion } from '../../hooks/use-lineas-produccion';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { listadosApi } from '../../api/listados-api';
import { ListadosPendientesParalelaTable } from '../../components/listados-pendientes-paralela-table';
import { ListadoDetailModal } from '../../components/listado-detail-modal';
import { ListadoTransitionModal, type TransitionAction } from '../../components/listado-transition-modal';
import { clasificarListadosPorArea } from '../../utils/classify-listados';
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

const MESES = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

/**
 * Submódulo HISTORIAL de Listados.
 *
 * Muestra el registro histórico segmentado por Mes y Año según la fecha requerida.
 * No utiliza paginación de 100 en 100: muestra la totalidad de registros correspondientes al mes.
 * Los años disponibles se obtienen dinámicamente de los registros reales existentes.
 */
export function ListadosHistorialPage(): ReactNode {
  const { user, hasPermission, isSuperAdmin, isAdmin } = usePermissions();
  const canVer = hasPermission('listado:ver');
  const canRetroceder = (isSuperAdmin || isAdmin) && hasPermission('listado:retroceder');

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

  // ─── Control de Año y Mes (Por defecto Mes y Año actual) ───────────────────
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');

  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([anioActual]);
  const [selectedAnio, setSelectedAnio] = useState<number>(anioActual);
  const [selectedMes, setSelectedMes] = useState<string>(mesActual);

  // Cargar años con registros reales desde el backend
  useEffect(() => {
    let isMounted = true;
    listadosApi.getAnios().then((res) => {
      if (isMounted && res.success && res.data && res.data.length > 0) {
        setAniosDisponibles(res.data);
        // Si el año actual no estuviera en la lista, fijar el primer año disponible
        if (!res.data.includes(selectedAnio)) {
          setSelectedAnio(res.data[0]);
        }
      }
    }).catch(() => {
      // Silencioso: fallback a anioActual ya configurado
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Calcular rango de fechas para el mes completo seleccionado
  const { fechaDesdeCalculada, fechaHastaCalculada } = useMemo(() => {
    const ultimoDia = new Date(selectedAnio, Number(selectedMes), 0).getDate();
    const padUltimoDia = String(ultimoDia).padStart(2, '0');
    return {
      fechaDesdeCalculada: `${selectedAnio}-${selectedMes}-01`,
      fechaHastaCalculada: `${selectedAnio}-${selectedMes}-${padUltimoDia}`,
    };
  }, [selectedAnio, selectedMes]);

  // Hook principal de listados configurado para traer todo el mes (customLimit: 1000)
  const {
    items,
    pagination,
    isLoading,
    error,
    reloadListados,
    estado,
    setEstado,
    searchTerm,
    setSearchTerm,
    setFechaDesde,
    setFechaHasta,
  } = useListados({ customLimit: 1000 });

  // Sincronizar el rango del mes seleccionado con los filtros de la URL/hook
  useEffect(() => {
    setFechaDesde(fechaDesdeCalculada);
    setFechaHasta(fechaHastaCalculada);
  }, [fechaDesdeCalculada, fechaHastaCalculada, setFechaDesde, setFechaHasta]);

  const { todasLasLineas } = useLineasProduccion();

  // ─── Estado de modales y feedback ──────────────────────────────────────────
  const [selectedListado, setSelectedListado] = useState<ListadoItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isTransitionOpen, setIsTransitionOpen] = useState<boolean>(false);
  const [transitionAction, setTransitionAction] = useState<TransitionAction>('retroceder');
  const [transitionTipoFrente, setTransitionTipoFrente] = useState<TipoFrenteMaterial | undefined>(undefined);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenDetail = (listado: ListadoItem) => {
    setSelectedListado(listado);
    setIsDetailOpen(true);
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

  // Clasificación dinámica en BOTA y ACCESORIOS
  const { botaItems, accesoriosItems, noClasificados } = useMemo(() => {
    return clasificarListadosPorArea(items, todasLasLineas);
  }, [items, todasLasLineas]);

  // ─── Sin permiso ──────────────────────────────────────────────────────────
  if (!canVer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
          <Icon name="lock" size="lg" className="text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Acceso restringido</h2>
        <p className="text-sm text-text-secondary max-w-sm">
          No tienes permiso para ver el historial de Listados.
        </p>
      </div>
    );
  }

  const mesNombre = MESES.find((m) => m.value === selectedMes)?.label ?? selectedMes;

  return (
    <div className="space-y-4">
      {/* Encabezado Principal con Indicador de Segmento Actual */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Historial General</h2>
          <p className="text-xs text-text-secondary font-lectura mt-0.5">
            Registro mensual de listados por fecha requerida. Mostrando todos los registros de{' '}
            <span className="font-semibold text-text-primary capitalize">{mesNombre} {selectedAnio}</span> ({items.length} listados).
          </p>
        </div>
      </div>

      {/* ─── Barra de Filtros: [ BÚSQUEDA + FECHAS ] a la izquierda | [ VER CANCELADAS ] a la derecha ─── */}
      <div className="py-2.5 px-3.5 bg-app-surface border border-border rounded-xl shadow-2xs flex items-center justify-between gap-4 flex-wrap">
        {/* Bloque Izquierdo: Barra de Búsqueda + Selectores de Fechas juntos */}
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          {/* 1. BARRA DE BÚSQUEDA */}
          <div className="w-64 sm:w-72 max-w-xs shrink-0">
            <div className="relative w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número de listado..."
                className="w-full text-xs pl-8 pr-8 py-1.5 rounded-lg border border-border bg-app-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary placeholder:text-text-muted"
              />
              <Icon
                name="search"
                size="xs"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <Icon name="close" size="xs" />
                </button>
              )}
            </div>
          </div>

          {/* 2. FECHAS: AÑO Y MES (Pegados a la búsqueda) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Selector de AÑO */}
            <div className="flex items-center bg-app-surface rounded-lg border border-border shadow-2xs overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-text-muted px-2 select-none bg-app-surface-muted/50 border-r border-border py-1.5">
                Año
              </span>
              <select
                value={selectedAnio}
                onChange={(e) => setSelectedAnio(Number(e.target.value))}
                className="text-xs px-2.5 py-1.5 bg-transparent text-text-primary font-bold focus:outline-none cursor-pointer"
              >
                {aniosDisponibles.map((a) => (
                  <option key={`anio-${a}`} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de MES */}
            <div className="flex items-center bg-app-surface rounded-lg border border-border shadow-2xs overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-text-muted px-2 select-none bg-app-surface-muted/50 border-r border-border py-1.5">
                Mes
              </span>
              <select
                value={selectedMes}
                onChange={(e) => setSelectedMes(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-transparent text-text-primary font-bold focus:outline-none cursor-pointer"
              >
                {MESES.map((m) => (
                  <option key={`mes-${m.value}`} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Bloque Derecho: VER CANCELADAS a la derecha */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => {
              if (estado === 'CANCELADO') {
                setEstado(undefined);
              } else {
                setEstado('CANCELADO');
              }
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border shadow-2xs',
              estado === 'CANCELADO'
                ? 'bg-danger/10 text-danger border-danger/30 font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-cuadra-arena/50 border-border',
            )}
            title={estado === 'CANCELADO' ? 'Mostrar listados de todos los estados' : 'Filtrar listados cancelados'}
          >
            <Icon name="cancel" size="xs" />
            <span>Ver Canceladas</span>
          </button>
        </div>
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

      {/* Discrepancias / No clasificados de Materia Prima */}
      {noClasificados.length > 0 && !isLoading && (
        <div className="p-3 bg-warning-subtle border border-warning/30 rounded-xl text-xs text-warning-text flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="warning" size="xs" className="shrink-0" />
            <span>
              Hay {noClasificados.length} listado(s) con línea sin área asignada ({noClasificados.map((i) => i.lineaProduccion.codigo).join(', ')}).
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
        isBotaDisabled={isBotaDisabled}
        isAccesoriosDisabled={isAccesoriosDisabled}
        emptyMessage="No hay listados históricos registrados para el mes seleccionado."
        acciones={{
          onVerDetalle: handleOpenDetail,
          onRetrocederFrente: handleOpenRetrocederFrente,
          onCancelar: handleOpenCancelarListado,
          canRetroceder,
          canCancelar: false,
        }}
      />

      {/* Modales */}
      <ListadoDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        listado={selectedListado}
        onRequestRetroceder={(listado, tipoFrente) => {
          setIsDetailOpen(false);
          handleOpenRetrocederFrente(listado, tipoFrente);
        }}
        onListadoUpdated={() => {
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
          showFeedback('success', `Operación completada en listado ${updated.numeroListado}.`);
          reloadListados();
        }}
      />
    </div>
  );
}
