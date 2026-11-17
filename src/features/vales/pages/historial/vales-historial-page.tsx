import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils/cn';
import { useVales } from '../../hooks/use-vales';
import { useDepartamentosVale } from '../../hooks/use-departamentos-vale';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ValesPendientesParalelaTable } from '../../components/vales-pendientes-paralela-table';
import { ValeDetailModal } from '../../components/vale-detail-modal';
import { ValeFormModal } from '../../components/vale-form-modal';
import { ValeTransitionModal, type TransitionAction } from '../../components/vale-transition-modal';
import { ValeAccionModal, type TipoAccionVale } from '../../components/vale-accion-modal';
import { classifyVales, getValesColumnDisabledFlags } from '../../utils/classify-vales';
import type { ValeItem } from '../../types/vales.types';

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
 * Submódulo HISTORIAL de Vales.
 *
 * Muestra el registro histórico segmentado por Mes y Año según la fecha de solicitud.
 * Los años disponibles se obtienen dinámicamente de los registros reales existentes.
 */
export function ValesHistorialPage(): ReactNode {
  const { user, hasPermission, hasAnyPermission, isSuperAdmin, isAdmin } = usePermissions();
  const canVer = hasPermission('vale:ver');
  const canRetroceder =
    (isSuperAdmin || isAdmin) &&
    hasAnyPermission(['vale:retroceder', 'vale:retroceder_descuento']);
  const canEditar = (isSuperAdmin || isAdmin) && hasPermission('vale:editar');
  const canCancelar = (isSuperAdmin || isAdmin) && hasPermission('vale:cancelar');

  // ─── Desactivación / Atenuación visual de bloques por alcance asignado ─────
  const { isBotaDisabled, isAccesoriosDisabled, isOtroDisabled } = useMemo(
    () => getValesColumnDisabledFlags(user),
    [user],
  );

  // ─── Control de Año y Mes (Sincronizado con URL SearchParams) ───────────
  const [searchParams, setSearchParams] = useSearchParams();
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');

  const anioParam = searchParams.get('anio');
  const mesParam = searchParams.get('mes');
  const initialAnio =
    anioParam && !Number.isNaN(Number(anioParam)) ? Number(anioParam) : anioActual;
  const initialMes = mesParam && MESES.some((m) => m.value === mesParam) ? mesParam : mesActual;

  const [aniosDisponibles] = useState<number[]>(() => {
    const base = [anioActual, anioActual - 1];
    if (!base.includes(initialAnio)) base.push(initialAnio);
    return base.sort((a, b) => b - a);
  });
  const [selectedAnio, setSelectedAnio] = useState<number>(initialAnio);
  const [selectedMes, setSelectedMes] = useState<string>(initialMes);

  useEffect(() => {
    if (anioParam && !Number.isNaN(Number(anioParam)) && Number(anioParam) !== selectedAnio) {
      setSelectedAnio(Number(anioParam));
    }
  }, [anioParam]);

  useEffect(() => {
    if (mesParam && MESES.some((m) => m.value === mesParam) && mesParam !== selectedMes) {
      setSelectedMes(mesParam);
    }
  }, [mesParam]);

  const handleChangeAnio = (nuevoAnio: number) => {
    setSelectedAnio(nuevoAnio);
    setSearchParams((prev: URLSearchParams) => {
      const next = new URLSearchParams(prev);
      next.set('anio', String(nuevoAnio));
      next.set('mes', selectedMes);
      return next;
    });
  };

  const handleChangeMes = (nuevoMes: string) => {
    setSelectedMes(nuevoMes);
    setSearchParams((prev: URLSearchParams) => {
      const next = new URLSearchParams(prev);
      next.set('anio', String(selectedAnio));
      next.set('mes', nuevoMes);
      return next;
    });
  };

  // Calcular rango de fechas para el mes completo seleccionado
  const { fechaDesdeCalculada, fechaHastaCalculada } = useMemo(() => {
    const ultimoDia = new Date(selectedAnio, Number(selectedMes), 0).getDate();
    const padUltimoDia = String(ultimoDia).padStart(2, '0');
    return {
      fechaDesdeCalculada: `${selectedAnio}-${selectedMes}-01`,
      fechaHastaCalculada: `${selectedAnio}-${selectedMes}-${padUltimoDia}`,
    };
  }, [selectedAnio, selectedMes]);

  // Si hay término de búsqueda activo en la URL, se omite el filtro de fechas para buscar en TODO el registro histórico
  const isBuscandoGlobal = Boolean(searchParams.get('busqueda')?.trim());

  const {
    items,
    pagination,
    isLoading,
    error,
    reload,
    estado,
    setEstado,
    searchTerm,
    setSearchTerm,
    highlightedIds,
    entregandoIds,
    descontandoIds,
    triggerHighlight,
  } = useVales({
    scopeView: 'general',
    customLimit: 500,
    fixedFechaDesde: isBuscandoGlobal ? undefined : fechaDesdeCalculada,
    fixedFechaHasta: isBuscandoGlobal ? undefined : fechaHastaCalculada,
  });

  const { series, departamentosVale, reloadCatalogos } = useDepartamentosVale();

  // ─── Estado de modales y feedback ──────────────────────────────────────────
  const [selectedVale, setSelectedVale] = useState<ValeItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isTransitionOpen, setIsTransitionOpen] = useState<boolean>(false);
  const [transitionAction, setTransitionAction] = useState<TransitionAction>('retroceder');
  const [accionState, setAccionState] = useState<{
    isOpen: boolean;
    vale: ValeItem | null;
    accion: TipoAccionVale | null;
  }>({ isOpen: false, vale: null, accion: null });
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [shouldReopenDetailOnTransitionClose, setShouldReopenDetailOnTransitionClose] =
    useState<boolean>(false);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleOpenDetail = (vale: ValeItem) => {
    setSelectedVale(vale);
    setIsDetailOpen(true);
  };

  const handleOpenEditar = (vale: ValeItem) => {
    setSelectedVale(vale);
    setIsFormOpen(true);
  };

  const handleOpenRetroceder = (vale: ValeItem, fromDetail = false) => {
    setSelectedVale(vale);
    setTransitionAction('retroceder');
    setShouldReopenDetailOnTransitionClose(fromDetail);
    setIsTransitionOpen(true);
  };

  const handleOpenCancelar = (vale: ValeItem) => {
    setSelectedVale(vale);
    setTransitionAction('cancelar');
    setIsTransitionOpen(true);
  };

  const handleOpenAccion = (vale: ValeItem, accion: TipoAccionVale) => {
    setAccionState({ isOpen: true, vale, accion });
  };

  // Clasificación en BOTA, ACCESORIOS y OTRO
  const { botaItems, accesoriosItems, otroItems } = useMemo(() => {
    return classifyVales(items);
  }, [items]);

  // ─── Sin permiso ──────────────────────────────────────────────────────────
  if (!canVer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
          <Icon name="lock" size="lg" className="text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Acceso restringido</h2>
        <p className="text-sm text-text-secondary max-w-sm">
          No tienes permiso para ver el historial de Vales.
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
            {isBuscandoGlobal ? (
              <>
                Búsqueda en{' '}
                <span className="font-semibold text-brand-primary">
                  todo el registro histórico
                </span>{' '}
                para &quot;{searchParams.get('busqueda')}&quot; ({items.length}{' '}
                {items.length === 1 ? 'vale encontrado' : 'vales encontrados'}).
              </>
            ) : (
              <>
                Registro mensual de vales por fecha de solicitud. Mostrando todos los registros de{' '}
                <span className="font-semibold text-text-primary capitalize">
                  {mesNombre} {selectedAnio}
                </span>{' '}
                ({items.length} vales).
              </>
            )}
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
                placeholder="Buscar por serie, folio o línea..."
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
          <div
            className={cn(
              'flex items-center gap-2 flex-wrap transition-opacity duration-200',
              isBuscandoGlobal && 'opacity-60',
            )}
          >
            {/* Selector de AÑO */}
            <div className="flex items-center bg-app-surface rounded-lg border border-border shadow-2xs overflow-hidden">
              <span className="text-[10px] uppercase font-bold text-text-muted px-2 select-none bg-app-surface-muted/50 border-r border-border py-1.5">
                Año
              </span>
              <select
                value={selectedAnio}
                onChange={(e) => handleChangeAnio(Number(e.target.value))}
                className="text-xs px-2.5 py-1.5 bg-transparent text-text-primary font-bold focus:outline-none cursor-pointer"
                title={
                  isBuscandoGlobal ? 'Limpia la búsqueda para filtrar por este año' : undefined
                }
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
                onChange={(e) => handleChangeMes(e.target.value)}
                className="text-xs px-2.5 py-1.5 bg-transparent text-text-primary font-bold focus:outline-none cursor-pointer"
                title={
                  isBuscandoGlobal ? 'Limpia la búsqueda para filtrar por este mes' : undefined
                }
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
            title={
              estado === 'CANCELADO'
                ? 'Mostrar vales de todos los estados'
                : 'Filtrar vales cancelados'
            }
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
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
            <Icon name="close" size="xs" />
          </button>
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
      <ValesPendientesParalelaTable
        botaItems={botaItems}
        accesoriosItems={accesoriosItems}
        otroItems={otroItems}
        formatFecha={formatFecha}
        isLoading={isLoading}
        page={pagination.page}
        limit={pagination.limit}
        isBotaDisabled={isBotaDisabled}
        isAccesoriosDisabled={isAccesoriosDisabled}
        isOtroDisabled={isOtroDisabled}
        highlightedValeId={highlightedIds}
        entregandoValeId={entregandoIds}
        descontandoValeId={descontandoIds}
        emptyMessage="No hay vales históricos registrados para el mes seleccionado."
        allowSelection={false}
        acciones={{
          onVerDetalle: handleOpenDetail,
          onEditar: handleOpenEditar,
          onRetroceder: (v) => handleOpenRetroceder(v, false),
          onCancelar: handleOpenCancelar,
          canRetroceder,
          canEditar,
          canCancelar,
        }}
      />

      {/* Modales */}
      <ValeDetailModal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        vale={selectedVale}
        onEdit={(v) => {
          setIsDetailOpen(false);
          handleOpenEditar(v);
        }}
        onAccion={(v, acc) => {
          setIsDetailOpen(false);
          handleOpenAccion(v, acc);
        }}
        onTransition={(v, act) => {
          setIsDetailOpen(false);
          if (act === 'cancelar') {
            handleOpenCancelar(v);
          } else {
            handleOpenRetroceder(v, true);
          }
        }}
        onValeUpdated={() => {
          void reload();
        }}
      />

      <ValeFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedVale(null);
        }}
        valeToEdit={selectedVale}
        series={series}
        departamentosVale={departamentosVale}
        onCatalogosChanged={reloadCatalogos}
        onSuccess={(updated) => {
          showFeedback('success', `Vale ${updated?.folio ?? ''} actualizado correctamente.`);
          void reload();
        }}
      />

      <ValeTransitionModal
        isOpen={isTransitionOpen}
        onClose={() => {
          setIsTransitionOpen(false);
          if (shouldReopenDetailOnTransitionClose) {
            setShouldReopenDetailOnTransitionClose(false);
            setIsDetailOpen(true);
          }
        }}
        vale={selectedVale}
        action={transitionAction}
        onSuccess={(updated) => {
          setShouldReopenDetailOnTransitionClose(false);
          showFeedback('success', `Operación completada en vale ${updated.folio}.`);
          if (updated.id) {
            triggerHighlight(updated.id);
          }
          void reload(true);
        }}
      />

      <ValeAccionModal
        isOpen={accionState.isOpen}
        onClose={() => setAccionState((prev) => ({ ...prev, isOpen: false }))}
        vale={accionState.vale}
        accion={accionState.accion}
        onSuccess={(updated) => {
          showFeedback('success', `Vale ${updated.folio} actualizado correctamente.`);
          void reload();
        }}
      />
    </div>
  );
}
