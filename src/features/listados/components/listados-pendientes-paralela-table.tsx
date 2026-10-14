import { useState, useRef, useEffect, useMemo, Fragment, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/icon';
import { Pagination } from '@/components/ui/pagination';
import { TIPO_FRENTE_CONFIG } from '@/config/status-config';
import type {
  ListadoItem,
  EstadoFrenteMaterial,
  TipoFrenteMaterial,
} from '../types/listados.types';

export interface ListadoAccionesHandlers {
  onVerDetalle: (item: ListadoItem) => void;
  onEditar?: (item: ListadoItem) => void;
  onSeparar?: (item: ListadoItem) => void;
  onEntregar?: (item: ListadoItem) => void;
  onRetroceder?: (item: ListadoItem) => void;
  onSepararFrente?: (item: ListadoItem, tipoFrente: TipoFrenteMaterial) => void;
  onEntregarFrente?: (item: ListadoItem, tipoFrente: TipoFrenteMaterial) => void;
  onDescontarFrente?: (item: ListadoItem, tipoFrente: TipoFrenteMaterial) => void;
  onRetrocederFrente?: (item: ListadoItem, tipoFrente: TipoFrenteMaterial) => void;
  onCancelar?: (item: ListadoItem) => void;
  mutatingRows?: Record<number, string | null>;
  canSeparar?: boolean;
  canEntregar?: boolean;
  canDescontar?: boolean;
  canEditar?: boolean;
  canRetroceder?: boolean;
  canCancelar?: boolean;
}

interface ListadosParalelaTableProps {
  botaItems: ListadoItem[];
  accesoriosItems: ListadoItem[];
  formatFecha: (fecha: string) => string;
  isLoading?: boolean;
  acciones?: ListadoAccionesHandlers;
  page?: number;
  limit?: number;
  emptyMessage?: string;
  highlightedListadoId?: number | number[] | null;
  entregandoListadoId?: number | number[] | null;
  entregandoFrente?: TipoFrenteMaterial | null;
  descontandoListadoId?: number | number[] | null;
  descontandoFrente?: TipoFrenteMaterial | null;
  frentesPermitidos?: TipoFrenteMaterial[] | null;
  isBotaDisabled?: boolean;
  isAccesoriosDisabled?: boolean;
  allowSelection?: boolean;
  selectedBotaIds?: number[];
  selectedAccesoriosIds?: number[];
  onToggleSelectBota?: (id: number) => void;
  onToggleSelectAccesorios?: (id: number) => void;
  hideActions?: boolean;
  headerRight?: ReactNode;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems?: number;
    itemsPerPage?: number;
    onPageChange: (page: number) => void;
  };
}

/**
 * Renderiza el progreso acumulado de cada frente de surtido:
 * - PENDIENTE  → ⋯ (Materiales Pendientes)
 * - SEPARADO   → 🟡 (Separado en Almacén)
 * - ENTREGADO  → 🟡 ✔️ (Separado + Entregado a Producción)
 * - DESCONTADO → 🟡 ✔️ ☑️ (Separado + Entregado + Descontado en Sistema)
 * - Sin frente → —
 */
function IndicadorProgresoFrente({
  estado,
  label,
}: {
  estado?: EstadoFrenteMaterial;
  label?: string;
}): ReactNode {
  if (!estado) {
    return (
      <span className="text-text-muted/30 text-xs select-none font-bold" title="No aplica para este listado">
        —
      </span>
    );
  }

  if (estado === 'DESCONTADO') {
    return (
      <span
        className="inline-flex items-center justify-center gap-1 select-none"
        title={`${label ? `${label}: ` : ''}Separado + Entregado + Descontado en Sistema`}
      >
        <Icon name="circle" fill size="11px" className="text-amber-500 shrink-0" />
        <Icon name="check" size="13px" weight={700} className="text-emerald-600 shrink-0" />
        <Icon name="done_all" size="14px" weight={700} className="text-purple-600 shrink-0" />
      </span>
    );
  }

  if (estado === 'ENTREGADO') {
    return (
      <span
        className="inline-flex items-center justify-center gap-1 select-none"
        title={`${label ? `${label}: ` : ''}Separado en Almacén + Entregado a Producción`}
      >
        <Icon name="circle" fill size="11px" className="text-amber-500 shrink-0" />
        <Icon name="check" size="13px" weight={700} className="text-emerald-600 shrink-0" />
      </span>
    );
  }

  if (estado === 'SEPARADO') {
    return (
      <span
        className="inline-flex items-center justify-center select-none"
        title={`${label ? `${label}: ` : ''}Separado en Almacén`}
      >
        <Icon name="circle" fill size="12px" className="text-amber-500 shrink-0" />
      </span>
    );
  }

  // PENDIENTE
  return (
    <span
      className="inline-flex items-center justify-center select-none"
      title={`${label ? `${label}: ` : ''}Materiales Pendientes`}
    >
      <Icon name="more_horiz" size="16px" className="text-text-muted/70 shrink-0" />
    </span>
  );
}

/**
 * Menú contextual compacto para acciones operativas por fila.
 */
function MenuAccionesFila({
  row,
  acciones,
  frentesPermitidos,
}: {
  row: ListadoItem;
  acciones?: ListadoAccionesHandlers;
  frentesPermitidos?: TipoFrenteMaterial[] | null;
}): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const updateMenuPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 224; // w-56 (224px)
      const menuHeight = 240; // aprox altura con varias opciones

      let left = rect.right - menuWidth;
      if (left < 10) left = 10;
      if (left + menuWidth > window.innerWidth - 10) {
        left = window.innerWidth - menuWidth - 10;
      }

      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight && rect.top - menuHeight > 0) {
        top = rect.top - menuHeight - 4;
      }

      setMenuPos({ top, left });
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      if (isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      updateMenuPosition();
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  if (!acciones) return null;

  const rowMutating = acciones.mutatingRows?.[row.id];
  if (rowMutating) {
    return (
      <div className="flex items-center justify-center w-7 h-7">
        <div className="w-3.5 h-3.5 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const frentes = row.frentes ?? [];
  const frentesPermitidosFiltrados = frentes.filter(
    (f) => !frentesPermitidos || frentesPermitidos.length === 0 || frentesPermitidos.includes(f.tipoFrente),
  );
  const frentesPendientes = frentesPermitidosFiltrados.filter((f) => f.estado === 'PENDIENTE');
  const frentesSeparados = frentesPermitidosFiltrados.filter((f) => f.estado === 'SEPARADO');
  const frentesEntregados = frentesPermitidosFiltrados.filter((f) => f.estado === 'ENTREGADO');
  const frentesParaRetroceder = frentesPermitidosFiltrados.filter(
    (f) => f.estado === 'SEPARADO' || f.estado === 'ENTREGADO',
  );

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) {
            updateMenuPosition();
          }
          setIsOpen(!isOpen);
        }}
        className="w-5 h-5 sm:w-6 sm:h-6 2xl:w-7 2xl:h-7 mx-auto flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-cuadra-arena/60 transition-colors cursor-pointer"
        title="Opciones de listado"
      >
        <Icon name="more_vert" size="14px" />
      </button>

      {isOpen &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
            }}
            className="w-56 rounded-xl bg-app-surface border border-border shadow-xl p-1.5 z-[9999] text-xs space-y-0.5"
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                acciones.onVerDetalle(row);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-text-primary hover:bg-cuadra-arena/40 text-left transition-colors cursor-pointer"
            >
              <Icon name="visibility" size="xs" className="text-text-muted" />
              <span>Ver detalles</span>
            </button>

            {/* Editar listado: ADMIN/SUPER_ADMIN pueden si no están todos en DESCONTADO ni cancelado/descontado; otros roles solo en PENDIENTE */}
            {acciones.canEditar &&
              acciones.onEditar &&
              (acciones.canEditar ? (!frentes.every((f) => f.estado === 'DESCONTADO') && row.estado !== 'CANCELADO' && row.estado !== 'DESCONTADO') : row.estado === 'PENDIENTE') && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    acciones.onEditar!(row);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-text-primary hover:bg-cuadra-arena/40 text-left transition-colors cursor-pointer"
                >
                  <Icon name="edit" size="xs" className="text-text-muted" />
                  <span>Editar listado</span>
                </button>
              )}

            {/* Separar material */}
            {acciones.canSeparar &&
              acciones.onSepararFrente &&
              frentesPendientes.map((frente) => (
                <button
                  key={`separar-${frente.id}`}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    acciones.onSepararFrente!(row, frente.tipoFrente);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-amber-700 font-semibold hover:bg-amber-500/10 text-left transition-colors cursor-pointer text-[13px] rounded-md"
                >
                  <Icon name="arrow_forward" size="sm" className="text-amber-600" />
                  <span>Separar {TIPO_FRENTE_CONFIG[frente.tipoFrente].shortLabel}</span>
                </button>
              ))}

            {/* Entregar material */}
            {acciones.canEntregar &&
              acciones.onEntregarFrente &&
              frentesSeparados.map((frente) => (
                <button
                  key={`entregar-${frente.id}`}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    acciones.onEntregarFrente!(row, frente.tipoFrente);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-emerald-700 font-semibold hover:bg-emerald-500/10 text-left transition-colors cursor-pointer text-[13px] rounded-md"
                >
                  <Icon name="arrow_forward" size="sm" className="text-emerald-600" />
                  <span>Entregar {TIPO_FRENTE_CONFIG[frente.tipoFrente].shortLabel}</span>
                </button>
              ))}

            {/* Descontar en Sistema */}
            {acciones.canDescontar &&
              acciones.onDescontarFrente &&
              frentesEntregados.map((frente) => (
                <button
                  key={`descontar-${frente.id}`}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    acciones.onDescontarFrente!(row, frente.tipoFrente);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-purple-700 font-semibold hover:bg-purple-500/10 text-left transition-colors cursor-pointer text-[13px] rounded-md"
                >
                  <Icon name="done_all" size="sm" className="text-purple-600" />
                  <span>Descontar {TIPO_FRENTE_CONFIG[frente.tipoFrente].shortLabel}</span>
                </button>
              ))}

            {/* Retroceder frente (opción única que abre el modal para elegir frente) */}
            {acciones.canRetroceder &&
              acciones.onRetrocederFrente &&
              frentesParaRetroceder.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    // Si solo hay un frente retrocedible, se pasa por defecto; si hay varios, undefined para elegirlo en el modal
                    const unicoFrente = frentesParaRetroceder.length === 1 ? frentesParaRetroceder[0]?.tipoFrente : undefined;
                    acciones.onRetrocederFrente!(row, unicoFrente as TipoFrenteMaterial);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-warning-text hover:bg-warning-subtle text-left transition-colors cursor-pointer border-t border-border/50"
                >
                  <Icon name="undo" size="xs" />
                  <span>Retroceder</span>
                </button>
              )}

            {/* Cancelar listado */}
            {acciones.canCancelar &&
              acciones.onCancelar &&
              row.estado !== 'CANCELADO' &&
              row.estado !== 'DESCONTADO' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    acciones.onCancelar!(row);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-danger hover:bg-danger/10 text-left transition-colors cursor-pointer border-t border-border/50"
                >
                  <Icon name="block" size="xs" />
                  <span>Cancelar listado</span>
                </button>
              )}
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * Tablero Operativo de Pendientes: Dos tablas HTML separadas e independientes (BOTA y ACCESORIOS)
 * dispuestas en paralelo (Side-by-Side).
 *
 * Cada tabla mide exactamente su cantidad de filas naturales, sin filas ni celdas vacías artificiales.
 *
 * Columnas BOTA:
 * LINEA / MAQ | LISTA | FECHA | DIR | IND | [Acciones]
 *
 * Columnas ACCESORIOS:
 * LINEA / MAQ | LISTA | FECHA | DIR | IND | BOL | [Acciones]
 */
function renderColGroup(frentesCount: number, withSelection: boolean, hideActions: boolean = false) {
  if (hideActions) {
    if (!withSelection) {
      if (frentesCount <= 1) {
        return (
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[44%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
          </colgroup>
        );
      }
      if (frentesCount === 2) {
        return (
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[38%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
          </colgroup>
        );
      }
      return (
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[34%]" />
          <col className="w-[13%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
        </colgroup>
      );
    }
  }

  if (!withSelection) {
    if (frentesCount <= 1) {
      return (
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[36%]" />
          <col className="w-[20%]" />
          <col className="w-[12%]" />
          <col className="w-[6%]" />
        </colgroup>
      );
    }
    if (frentesCount === 2) {
      return (
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[30%]" />
          <col className="w-[20%]" />
          <col className="w-[11%]" />
          <col className="w-[11%]" />
          <col className="w-[6%]" />
        </colgroup>
      );
    }
    return (
      <colgroup>
        <col className="w-[20%]" />
        <col className="w-[27%]" />
        <col className="w-[18%]" />
        <col className="w-[11%]" />
        <col className="w-[11%]" />
        <col className="w-[11%]" />
        <col className="w-[6%]" />
      </colgroup>
    );
  }

  if (frentesCount <= 1) {
    return (
      <colgroup>
        <col className="w-[5%]" />
        <col className="w-[24%]" />
        <col className="w-[34%]" />
        <col className="w-[19%]" />
        <col className="w-[12%]" />
        <col className="w-[6%]" />
      </colgroup>
    );
  }
  if (frentesCount === 2) {
    return (
      <colgroup>
        <col className="w-[5%]" />
        <col className="w-[20%]" />
        <col className="w-[28%]" />
        <col className="w-[19%]" />
        <col className="w-[11%]" />
        <col className="w-[11%]" />
        <col className="w-[6%]" />
      </colgroup>
    );
  }
  return (
    <colgroup>
      <col className="w-[5%]" />
      <col className="w-[18%]" />
      <col className="w-[25%]" />
      <col className="w-[17%]" />
      <col className="w-[11%]" />
      <col className="w-[11%]" />
      <col className="w-[11%]" />
      <col className="w-[6%]" />
    </colgroup>
  );
}

export function ListadosPendientesParalelaTable({
  botaItems,
  accesoriosItems,
  formatFecha,
  isLoading,
  acciones,
  emptyMessage = 'No hay listados de Almacén MBC para mostrar.',
  highlightedListadoId,
  entregandoListadoId,
  entregandoFrente,
  descontandoListadoId,
  descontandoFrente,
  frentesPermitidos,
  isBotaDisabled = false,
  isAccesoriosDisabled = false,
  allowSelection = false,
  selectedBotaIds = [],
  selectedAccesoriosIds = [],
  onToggleSelectBota,
  onToggleSelectAccesorios,
  hideActions = false,
  headerRight,
  pagination,
}: ListadosParalelaTableProps): ReactNode {
  // Columnas operativas dinámicas según perfil del usuario
  const botaFrentesVisibles = useMemo(() => {
    const base: TipoFrenteMaterial[] = ['DIRECTOS', 'INDIRECTOS'];
    if (!frentesPermitidos || frentesPermitidos.length === 0) return base;
    return base.filter((f) => frentesPermitidos.includes(f));
  }, [frentesPermitidos]);

  const accesoriosFrentesVisibles = useMemo(() => {
    const base: TipoFrenteMaterial[] = ['DIRECTOS', 'INDIRECTOS', 'BOLSAS'];
    if (!frentesPermitidos || frentesPermitidos.length === 0) return base;
    return base.filter((f) => frentesPermitidos.includes(f));
  }, [frentesPermitidos]);

  // Ordenamiento independiente por Orden de Línea, Fecha Requerida y Número de Listado
  const sortedBota = useMemo(() => {
    return [...botaItems].sort((a, b) => {
      const ordA = a.lineaProduccion.orden ?? 9999;
      const ordB = b.lineaProduccion.orden ?? 9999;
      if (ordA !== ordB) return ordA - ordB;
      const lineaComp = a.lineaProduccion.nombre.localeCompare(b.lineaProduccion.nombre);
      if (lineaComp !== 0) return lineaComp;
      return a.fechaRequerida.localeCompare(b.fechaRequerida) || a.numeroListado.localeCompare(b.numeroListado);
    });
  }, [botaItems]);

  const sortedAccesorios = useMemo(() => {
    return [...accesoriosItems].sort((a, b) => {
      const ordA = a.lineaProduccion.orden ?? 9999;
      const ordB = b.lineaProduccion.orden ?? 9999;
      if (ordA !== ordB) return ordA - ordB;
      const lineaComp = a.lineaProduccion.nombre.localeCompare(b.lineaProduccion.nombre);
      if (lineaComp !== 0) return lineaComp;
      return a.fechaRequerida.localeCompare(b.fechaRequerida) || a.numeroListado.localeCompare(b.numeroListado);
    });
  }, [accesoriosItems]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // En pantallas pequeñas donde la tabla desborda con scroll horizontal, si el usuario
  // solo puede operar el lado derecho (ACCESORIOS), posicionamos el scroll en el extremo derecho por default.
  useEffect(() => {
    if (isBotaDisabled && !isAccesoriosDisabled && !isLoading) {
      const container = scrollContainerRef.current;
      if (!container) return;

      const scrollToRight = () => {
        if (container) {
          container.scrollLeft = container.scrollWidth;
        }
      };

      scrollToRight();
      const rafId = requestAnimationFrame(scrollToRight);
      const timeoutId = setTimeout(scrollToRight, 120);

      const handleResize = () => {
        scrollToRight();
      };
      window.addEventListener('resize', handleResize);

      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timeoutId);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isBotaDisabled, isAccesoriosDisabled, isLoading, pagination?.currentPage, sortedAccesorios.length]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-app-surface rounded-xl border border-border">
        <div className="w-8 h-8 border-3 border-brand-accent border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-sm text-text-secondary font-medium">Cargando tablero de listados...</span>
      </div>
    );
  }

  if (sortedBota.length === 0 && sortedAccesorios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-app-surface rounded-xl border border-border text-center px-4">
        <p className="text-text-secondary font-medium">{emptyMessage}</p>
        <p className="text-xs text-text-muted mt-1">
          Los registros correspondientes aparecerán aquí divididos en Bota y Accesorios.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* ─── Barra Superior de Leyenda de Progreso (Discreta y compacta) ────────── */}
      <div className="py-1.5 px-3 bg-app-surface/90 border border-border/80 rounded-lg shadow-2xs flex items-center justify-between text-[11px] text-text-muted gap-3 flex-wrap">
        <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
          <span className="flex items-center gap-1 font-medium">
            <Icon name="more_horiz" size="14px" className="text-text-muted/70 shrink-0" />
            <span className="text-text-secondary">Materiales Pendientes</span>
          </span>
          <span className="flex items-center gap-1 font-medium">
            <Icon name="circle" fill size="10px" className="text-amber-500 shrink-0" />
            <span className="text-text-secondary">Separado en Almacén</span>
          </span>
          <span className="flex items-center gap-1 font-medium">
            <Icon name="check" size="12px" weight={700} className="text-emerald-600 shrink-0" />
            <span className="text-text-secondary">Entregado a Producción</span>
          </span>
          <span className="flex items-center gap-1 font-medium">
            <Icon name="done_all" size="13px" weight={700} className="text-purple-600 shrink-0" />
            <span className="text-text-secondary">Descontado en Sistema</span>
          </span>
        </div>
        {headerRight && <div className="flex items-center gap-2 shrink-0">{headerRight}</div>}
      </div>

      {/* ─── Tabla Unificada Fluida (BOTA a la Izquierda | ACCESORIOS a la Derecha) ──── */}
      <div className="bg-app-surface border border-border rounded-xl shadow-2xs overflow-hidden w-full">
        <div ref={scrollContainerRef} className="overflow-x-auto w-full custom-scrollbar">
          <div className="w-full min-w-[1040px] grid grid-cols-2 divide-x divide-border items-stretch">
            {/* ================================================================= */}
            {/* LADO IZQUIERDO: BOTA                                              */}
            {/* ================================================================= */}
            <div className={`flex flex-col min-w-0 bg-app-surface transition-all ${
              isBotaDisabled ? 'opacity-35 pointer-events-none select-none grayscale-[0.6]' : ''
            }`}>
              {/* Encabezado BOTA centrado */}
              <div className="py-2.5 sm:py-3.5 px-4 bg-app-surface-muted/60 border-b border-border flex items-center justify-center gap-2 text-center">
                <span className="font-black text-brand-primary tracking-widest text-sm sm:text-base md:text-lg uppercase">
                  BOTA
                </span>
              </div>

              <table className="w-full table-fixed border-collapse text-left bg-app-surface">
                {renderColGroup(botaFrentesVisibles.length, allowSelection, hideActions)}
                <thead>
                  <tr className="border-b border-border bg-app-surface text-text-secondary text-xs sm:text-sm font-bold uppercase tracking-wider">
                    {allowSelection && (
                      <th className="py-2.5 sm:py-3 px-1 text-center" aria-label="Selección de listados"></th>
                    )}
                    <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 whitespace-nowrap">LINEA / MAQ</th>
                    <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 truncate">LISTA</th>
                    <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 text-right whitespace-nowrap">FECHA</th>
                    {botaFrentesVisibles.map((frenteKey) => (
                      <th
                        key={`th-bota-${frenteKey}`}
                        className="py-2.5 sm:py-3 px-1 text-center whitespace-nowrap"
                        title={TIPO_FRENTE_CONFIG[frenteKey].nombre}
                      >
                        {TIPO_FRENTE_CONFIG[frenteKey].shortLabel}
                      </th>
                    ))}
                    {!hideActions && <th className="py-2.5 sm:py-3 px-1 text-center"></th>}
                  </tr>
                </thead>
                <tbody className="bg-app-surface">
                  {sortedBota.length > 0 ? (
                    sortedBota.map((bota, idx) => {
                      const isNewGroup = idx > 0 && bota.lineaProduccion.nombre !== sortedBota[idx - 1].lineaProduccion.nombre;
                      const frentes = bota.frentes ?? [];
                      const isHighlighted = Array.isArray(highlightedListadoId)
                        ? highlightedListadoId.includes(bota.id)
                        : highlightedListadoId === bota.id;
                      const isEntregando = Array.isArray(entregandoListadoId)
                        ? entregandoListadoId.includes(bota.id)
                        : entregandoListadoId === bota.id;
                      const isDescontando = Array.isArray(descontandoListadoId)
                        ? descontandoListadoId.includes(bota.id)
                        : descontandoListadoId === bota.id;
                      const isSelected = allowSelection && selectedBotaIds.includes(bota.id);

                      return (
                        <Fragment key={`bota-row-fragment-${bota.id}`}>
                          {isNewGroup && (
                            <tr key={`bota-separator-${bota.id}`} className="bg-slate-100/70 border-y border-border/80 h-3 select-none pointer-events-none" aria-hidden="true">
                              <td colSpan={(allowSelection ? 5 : 4) + botaFrentesVisibles.length} className="p-0"></td>
                            </tr>
                          )}
                          <tr
                            key={`bota-${bota.id}`}
                            className={`transition-colors h-9 sm:h-10 md:h-11 ${
                              isDescontando
                                ? 'animate-descontar-success'
                                : isEntregando
                                ? 'animate-entregar-success'
                                : isHighlighted
                                ? 'animate-highlight-row'
                                : 'bg-app-surface hover:bg-app-surface-muted/60'
                            } ${idx > 0 && !isNewGroup ? 'border-t border-border/60' : ''}`}
                          >
                            {/* Checkbox de selección individual */}
                            {allowSelection && (
                              <td className="px-1 text-center whitespace-nowrap py-1 sm:py-1.5">
                                <input
                                  type="checkbox"
                                  aria-label={`Seleccionar listado ${bota.numeroListado}`}
                                  checked={isSelected}
                                  onChange={() => onToggleSelectBota?.(bota.id)}
                                  className="w-4 h-4 rounded border-border text-brand-primary accent-brand-primary focus:ring-0 focus:outline-hidden cursor-pointer"
                                />
                              </td>
                            )}
                            {/* LINEA / MAQ visible en TODAS las filas */}
                            <td
                              title={bota.lineaProduccion.nombre.toUpperCase()}
                              className="px-2 sm:px-2.5 truncate text-xs sm:text-[13px] md:text-sm py-1 sm:py-1.5 font-bold text-text-primary"
                            >
                              {bota.lineaProduccion.nombre.toUpperCase()}
                            </td>

                            {/* LISTA con truncate (...) y tooltip */}
                            <td
                              title={bota.numeroListado}
                              className={`px-2 sm:px-2.5 truncate font-mono font-bold text-text-primary text-xs sm:text-sm md:text-[15px] ${
                                isNewGroup ? 'pt-1.5 pb-1 sm:pt-2 sm:pb-1.5' : 'py-1 sm:py-1.5'
                              }`}
                            >
                              {bota.numeroListado}
                            </td>

                            {/* FECHA a la derecha */}
                            <td className={`px-2 sm:px-2.5 text-right whitespace-nowrap text-text-secondary text-[11px] sm:text-xs md:text-[13px] font-medium ${
                              isNewGroup ? 'pt-1.5 pb-1 sm:pt-2 sm:pb-1.5' : 'py-1 sm:py-1.5'
                            }`}>
                              {formatFecha(bota.fechaRequerida)}
                            </td>

                            {/* Frentes operativos visibles */}
                            {botaFrentesVisibles.map((frenteKey) => {
                              const f = frentes.find((item) => item.tipoFrente === frenteKey);
                              const estadoVisual =
                                isDescontando && descontandoFrente === frenteKey
                                  ? 'DESCONTADO'
                                  : isEntregando && entregandoFrente === frenteKey
                                  ? 'ENTREGADO'
                                  : f?.estado;
                              return (
                                <td
                                  key={`td-bota-${bota.id}-${frenteKey}`}
                                  className={`px-1 text-center whitespace-nowrap ${
                                    isNewGroup ? 'pt-1.5 pb-1 sm:pt-2 sm:pb-1.5' : 'py-1 sm:py-1.5'
                                  }`}
                                >
                                  <IndicadorProgresoFrente
                                    estado={estadoVisual}
                                    label={TIPO_FRENTE_CONFIG[frenteKey].nombre}
                                  />
                                </td>
                              );
                            })}

                            {/* Acciones */}
                            {!hideActions && (
                              <td className="px-1 text-center whitespace-nowrap py-1 sm:py-1.5">
                                <MenuAccionesFila row={bota} acciones={acciones} frentesPermitidos={frentesPermitidos} />
                              </td>
                            )}
                          </tr>
                        </Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={(hideActions ? 3 : 4) + botaFrentesVisibles.length} className="py-10 text-center text-text-muted text-xs sm:text-sm">
                        Sin listados de BOTA
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ================================================================= */}
            {/* LADO DERECHO: ACCESORIOS                                          */}
            {/* ================================================================= */}
            <div className={`flex flex-col min-w-0 bg-app-surface transition-all ${
              isAccesoriosDisabled ? 'opacity-35 pointer-events-none select-none grayscale-[0.6]' : ''
            }`}>
              {/* Encabezado ACCESORIOS centrado */}
              <div className="py-2.5 sm:py-3.5 px-4 bg-app-surface-muted/60 border-b border-border flex items-center justify-center gap-2 text-center">
                <span className="font-extrabold text-brand-secondary tracking-widest text-sm sm:text-base md:text-lg uppercase">
                  ACCESORIOS
                </span>
              </div>

              <table className="w-full table-fixed border-collapse text-left bg-app-surface">
                {renderColGroup(accesoriosFrentesVisibles.length, allowSelection, hideActions)}
                <thead>
                  <tr className="border-b border-border bg-app-surface text-text-secondary text-xs sm:text-sm font-bold uppercase tracking-wider">
                    {allowSelection && (
                      <th className="py-2.5 sm:py-3 px-1 text-center" aria-label="Selección de listados"></th>
                    )}
                    <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 whitespace-nowrap">LINEA / MAQ</th>
                    <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 truncate">LISTA</th>
                    <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 text-right whitespace-nowrap">FECHA</th>
                    {accesoriosFrentesVisibles.map((frenteKey) => (
                      <th
                        key={`th-acc-${frenteKey}`}
                        className="py-2.5 sm:py-3 px-1 text-center whitespace-nowrap"
                        title={TIPO_FRENTE_CONFIG[frenteKey].nombre}
                      >
                        {TIPO_FRENTE_CONFIG[frenteKey].shortLabel}
                      </th>
                    ))}
                    {!hideActions && <th className="py-2.5 sm:py-3 px-1 text-center"></th>}
                  </tr>
                </thead>
                <tbody className="bg-app-surface">
                  {sortedAccesorios.length > 0 ? (
                    sortedAccesorios.map((acc, idx) => {
                      const isNewGroup = idx > 0 && acc.lineaProduccion.nombre !== sortedAccesorios[idx - 1].lineaProduccion.nombre;
                      const frentes = acc.frentes ?? [];
                      const isHighlighted = Array.isArray(highlightedListadoId)
                        ? highlightedListadoId.includes(acc.id)
                        : highlightedListadoId === acc.id;
                      const isEntregando = Array.isArray(entregandoListadoId)
                        ? entregandoListadoId.includes(acc.id)
                        : entregandoListadoId === acc.id;
                      const isDescontando = Array.isArray(descontandoListadoId)
                        ? descontandoListadoId.includes(acc.id)
                        : descontandoListadoId === acc.id;
                      const isSelected = allowSelection && selectedAccesoriosIds.includes(acc.id);

                      return (
                        <Fragment key={`acc-row-fragment-${acc.id}`}>
                          {isNewGroup && (
                            <tr key={`acc-separator-${acc.id}`} className="bg-slate-100/70 border-y border-border/80 h-3 select-none pointer-events-none" aria-hidden="true">
                              <td colSpan={(allowSelection ? 5 : 4) + accesoriosFrentesVisibles.length} className="p-0"></td>
                            </tr>
                          )}
                          <tr
                            key={`acc-${acc.id}`}
                            className={`transition-colors h-9 sm:h-10 md:h-11 ${
                              isDescontando
                                ? 'animate-descontar-success'
                                : isEntregando
                                ? 'animate-entregar-success'
                                : isHighlighted
                                ? 'animate-highlight-row'
                                : 'bg-app-surface hover:bg-app-surface-muted/60'
                            } ${idx > 0 && !isNewGroup ? 'border-t border-border/60' : ''}`}
                          >
                            {/* Checkbox de selección individual */}
                            {allowSelection && (
                              <td className="px-1 text-center whitespace-nowrap py-1 sm:py-1.5">
                                <input
                                  type="checkbox"
                                  aria-label={`Seleccionar listado ${acc.numeroListado}`}
                                  checked={isSelected}
                                  onChange={() => onToggleSelectAccesorios?.(acc.id)}
                                  className="w-4 h-4 rounded border-border text-brand-primary accent-brand-primary focus:ring-0 focus:outline-hidden cursor-pointer"
                                />
                              </td>
                            )}
                            {/* LINEA / MAQ visible en TODAS las filas */}
                            <td
                              title={acc.lineaProduccion.nombre.toUpperCase()}
                              className="px-2 sm:px-2.5 truncate text-xs sm:text-[13px] md:text-sm py-1 sm:py-1.5 font-bold text-text-primary"
                            >
                              {acc.lineaProduccion.nombre.toUpperCase()}
                            </td>

                            {/* LISTA con truncate (...) y tooltip */}
                            <td
                              title={acc.numeroListado}
                              className={`px-2 sm:px-2.5 truncate font-mono font-bold text-text-primary text-xs sm:text-sm md:text-[15px] ${
                                isNewGroup ? 'pt-1.5 pb-1 sm:pt-2 sm:pb-1.5' : 'py-1 sm:py-1.5'
                              }`}
                            >
                              {acc.numeroListado}
                            </td>

                            {/* FECHA a la derecha */}
                            <td className={`px-2 sm:px-2.5 text-right whitespace-nowrap text-text-secondary text-[11px] sm:text-xs md:text-[13px] font-medium ${
                              isNewGroup ? 'pt-1.5 pb-1 sm:pt-2 sm:pb-1.5' : 'py-1 sm:py-1.5'
                            }`}>
                              {formatFecha(acc.fechaRequerida)}
                            </td>

                            {/* Frentes operativos visibles */}
                            {accesoriosFrentesVisibles.map((frenteKey) => {
                              const f = frentes.find((item) => item.tipoFrente === frenteKey);
                              const estadoVisual =
                                isDescontando && descontandoFrente === frenteKey
                                  ? 'DESCONTADO'
                                  : isEntregando && entregandoFrente === frenteKey
                                  ? 'ENTREGADO'
                                  : f?.estado;
                              return (
                                <td
                                  key={`td-acc-${acc.id}-${frenteKey}`}
                                  className={`px-1 text-center whitespace-nowrap ${
                                    isNewGroup ? 'pt-1.5 pb-1 sm:pt-2 sm:pb-1.5' : 'py-1 sm:py-1.5'
                                  }`}
                                >
                                  <IndicadorProgresoFrente
                                    estado={estadoVisual}
                                    label={TIPO_FRENTE_CONFIG[frenteKey].nombre}
                                  />
                                </td>
                              );
                            })}

                            {/* Acciones */}
                            {!hideActions && (
                              <td className="px-1 text-center whitespace-nowrap py-1 sm:py-1.5">
                               <MenuAccionesFila row={acc} acciones={acciones} frentesPermitidos={frentesPermitidos} />
                              </td>
                            )}
                          </tr>
                        </Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={(hideActions ? 3 : 4) + accesoriosFrentesVisibles.length} className="py-10 text-center text-text-muted text-xs sm:text-sm">
                        Sin listados de ACCESORIOS
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Paginación ──────────────────────────────────────────────────────── */}
      {pagination && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          itemsPerPage={pagination.itemsPerPage}
          onPageChange={pagination.onPageChange}
          variant="bar"
        />
      )}
    </div>
  );
}
