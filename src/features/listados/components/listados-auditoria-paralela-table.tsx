import { useState, useRef, useEffect, useMemo, Fragment, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/icon';
import { Pagination } from '@/components/ui/pagination';
import type {
  ListadoItem,
  EstadoFrenteMaterial,
  TipoFrenteMaterial,
} from '../types/listados.types';

export interface AuditoriaAccionesHandlers {
  onVerDetalle: (item: ListadoItem) => void;
  onDescontarFrente?: (item: ListadoItem, tipoFrente: TipoFrenteMaterial) => void;
  onRetrocederFrente?: (item: ListadoItem, tipoFrente: TipoFrenteMaterial) => void;
  mutatingRows?: Record<number, string | null>;
  canDescontar?: boolean;
  canRetroceder?: boolean;
  puedeOperarFrente?: (tipoFrente: TipoFrenteMaterial) => boolean;
}

interface ListadosAuditoriaParalelaTableProps {
  directosItems: ListadoItem[];
  indirectosItems: ListadoItem[];
  formatFecha: (fecha: string) => string;
  isLoading?: boolean;
  acciones?: AuditoriaAccionesHandlers;
  emptyMessage?: string;
  isDirectosDisabled?: boolean;
  isIndirectosDisabled?: boolean;
  descontandoListadoId?: number | number[] | null;
  descontandoFrente?: TipoFrenteMaterial | null;
  selectedDirectosIds?: number[];
  selectedIndirectosIds?: number[];
  onToggleSelectDirectos?: (id: number) => void;
  onToggleSelectIndirectos?: (id: number) => void;
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

  return (
    <span
      className="inline-flex items-center justify-center text-text-muted/70 select-none"
      title={`${label ? `${label}: ` : ''}Materiales Pendientes`}
    >
      <Icon name="more_horiz" size="16px" />
    </span>
  );
}

/**
 * Menú contextual para la vista de Auditoría (acciones directas de Descontar en ERP y Retroceder).
 */
function MenuAccionesAuditoria({
  row,
  tipoFrenteColumna,
  acciones,
}: {
  row: ListadoItem;
  tipoFrenteColumna: TipoFrenteMaterial;
  acciones?: AuditoriaAccionesHandlers;
}): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const updateMenuPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 208;
      const menuHeight = 140;

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
  const frenteCol = frentes.find((f) => f.tipoFrente === tipoFrenteColumna);
  const puedeOperar = acciones.puedeOperarFrente ? acciones.puedeOperarFrente(tipoFrenteColumna) : true;

  const puedeDescontarEste =
    acciones.canDescontar &&
    puedeOperar &&
    frenteCol?.estado === 'ENTREGADO';

  const puedeRetrocederEste =
    acciones.canRetroceder &&
    puedeOperar &&
    (frenteCol?.estado === 'ENTREGADO' || frenteCol?.estado === 'SEPARADO');

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
        title="Opciones de auditoría"
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
            className="w-52 rounded-xl bg-app-surface border border-border shadow-xl py-1.5 z-[9999] text-xs"
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

            {/* Descontar en Sistema */}
            {puedeDescontarEste && acciones.onDescontarFrente && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  acciones.onDescontarFrente!(row, tipoFrenteColumna);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-purple-700 font-semibold hover:bg-purple-50 text-left transition-colors cursor-pointer border-t border-border/50"
              >
                <Icon name="done_all" size="xs" />
                <span>Descontar en Sistema</span>
              </button>
            )}

            {/* Retroceder frente */}
            {puedeRetrocederEste && acciones.onRetrocederFrente && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  acciones.onRetrocederFrente!(row, tipoFrenteColumna);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-warning-text hover:bg-warning-subtle text-left transition-colors cursor-pointer border-t border-border/50"
              >
                <Icon name="undo" size="xs" />
                <span>Retroceder</span>
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * Tabla Operativa de Auditoría dividida en DIRECTOS (Izquierda) e INDIRECTOS (Derecha).
 * Muestra listados listos para validación de auditoría y descuento en ERP.
 */
export function ListadosAuditoriaParalelaTable({
  directosItems,
  indirectosItems,
  formatFecha,
  isLoading,
  acciones,
  emptyMessage = 'No hay listados entregados a producción para auditar.',
  isDirectosDisabled = false,
  isIndirectosDisabled = false,
  descontandoListadoId = null,
  descontandoFrente = null,
  selectedDirectosIds = [],
  selectedIndirectosIds = [],
  onToggleSelectDirectos,
  onToggleSelectIndirectos,
  pagination,
}: ListadosAuditoriaParalelaTableProps): ReactNode {
  // Ordenamiento independiente por Orden de Línea, Fecha y Número de Listado
  const sortedDirectos = useMemo(() => {
    return [...directosItems].sort((a, b) => {
      const ordA = a.lineaProduccion.orden ?? 9999;
      const ordB = b.lineaProduccion.orden ?? 9999;
      if (ordA !== ordB) return ordA - ordB;
      const lineaComp = a.lineaProduccion.nombre.localeCompare(b.lineaProduccion.nombre);
      if (lineaComp !== 0) return lineaComp;
      return a.fechaRequerida.localeCompare(b.fechaRequerida) || a.numeroListado.localeCompare(b.numeroListado);
    });
  }, [directosItems]);

  const sortedIndirectos = useMemo(() => {
    return [...indirectosItems].sort((a, b) => {
      const ordA = a.lineaProduccion.orden ?? 9999;
      const ordB = b.lineaProduccion.orden ?? 9999;
      if (ordA !== ordB) return ordA - ordB;
      const lineaComp = a.lineaProduccion.nombre.localeCompare(b.lineaProduccion.nombre);
      if (lineaComp !== 0) return lineaComp;
      return a.fechaRequerida.localeCompare(b.fechaRequerida) || a.numeroListado.localeCompare(b.numeroListado);
    });
  }, [indirectosItems]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // En pantallas pequeñas donde la tabla desborda con scroll horizontal, si el auditor
  // solo puede operar el lado derecho (INDIRECTOS), posicionamos el scroll en el extremo derecho por default.
  useEffect(() => {
    if (isDirectosDisabled && !isIndirectosDisabled && !isLoading) {
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
  }, [isDirectosDisabled, isIndirectosDisabled, isLoading, pagination?.currentPage, sortedIndirectos.length]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-app-surface rounded-xl border border-border">
        <div className="w-8 h-8 border-3 border-brand-accent border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-sm text-text-secondary font-medium">Cargando tablero de auditoría...</span>
      </div>
    );
  }

  if (sortedDirectos.length === 0 && sortedIndirectos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-app-surface rounded-xl border border-border text-center px-4">
        <p className="text-text-secondary font-medium">{emptyMessage}</p>
        <p className="text-xs text-text-muted mt-1">
          Aquí aparecerán los listados entregados a producción divididos por Directos e Indirectos.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* ─── Barra Superior de Leyenda de Progreso (Discreta y compacta) ────────── */}
      <div className="py-1.5 px-3 bg-app-surface/90 border border-border/80 rounded-lg shadow-2xs flex items-center justify-start text-[11px] text-text-muted">
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
      </div>

      {/* ─── Tabla Unificada Fluida (DIRECTOS Izquierda | INDIRECTOS Derecha) ──── */}
      <div className="bg-app-surface border border-border rounded-xl shadow-2xs overflow-hidden w-full">
        <div ref={scrollContainerRef} className="overflow-x-auto w-full custom-scrollbar">
          <div className="w-full min-w-[1040px] grid grid-cols-2 divide-x divide-border items-stretch">
            {/* ================================================================= */}
            {/* LADO IZQUIERDO: MATERIAL DIRECTO                                  */}
            {/* ================================================================= */}
            <div className={`flex flex-col min-w-0 bg-app-surface transition-all ${
              isDirectosDisabled ? 'opacity-35 pointer-events-none select-none grayscale-[0.6]' : ''
            }`}>
              <div className="py-2.5 sm:py-3.5 px-4 bg-app-surface-muted/60 border-b border-border text-center flex items-center justify-center">
                <span className="font-extrabold text-brand-primary tracking-widest text-sm sm:text-base md:text-lg uppercase">
                  DIRECTOS
                </span>
              </div>

              <table className="w-full table-fixed border-collapse text-left bg-app-surface">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[24%]" />
                  <col className="w-[30%]" />
                  <col className="w-[19%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-app-surface text-text-secondary text-xs sm:text-sm font-bold uppercase tracking-wider">
                    <th className="py-2.5 sm:py-3 px-1 text-center" aria-label="Selección de listados"></th>
                    <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 whitespace-nowrap">LINEA / MAQ</th>
                    <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 truncate">LISTA</th>
                    <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 text-right whitespace-nowrap">FECHA</th>
                    <th className="py-2.5 sm:py-3 px-1 text-center whitespace-nowrap" title="Estado de Directos / Bolsas">ESTADO</th>
                    <th className="py-2.5 sm:py-3 px-1 text-center"></th>
                  </tr>
                </thead>
                <tbody className="bg-app-surface">
                  {sortedDirectos.length > 0 ? (
                    sortedDirectos.map((dirItem, idx) => {
                      const isNewGroup = idx > 0 && dirItem.lineaProduccion.nombre !== sortedDirectos[idx - 1].lineaProduccion.nombre;
                      const frentes = dirItem.frentes ?? [];
                      const dir =
                        frentes.find((f) => (f.tipoFrente === 'DIRECTOS' || f.tipoFrente === 'BOLSAS') && f.estado === 'ENTREGADO') ||
                        frentes.find((f) => f.tipoFrente === 'DIRECTOS' || f.tipoFrente === 'BOLSAS');
                      const tipoFrenteDir = dir?.tipoFrente || 'DIRECTOS';
                      const puedeOperar = acciones?.puedeOperarFrente ? acciones.puedeOperarFrente(tipoFrenteDir) : true;
                      const isDescontando =
                        (Array.isArray(descontandoListadoId)
                          ? descontandoListadoId.includes(dirItem.id)
                          : descontandoListadoId === dirItem.id) &&
                        (!descontandoFrente || descontandoFrente === tipoFrenteDir);
                      const isSelected = selectedDirectosIds.includes(dirItem.id);

                      return (
                        <Fragment key={`dir-row-fragment-${dirItem.id}`}>
                          {isNewGroup && (
                            <tr key={`dir-separator-${dirItem.id}`} className="bg-slate-100/70 border-y border-border/80 h-3 select-none pointer-events-none" aria-hidden="true">
                              <td colSpan={6} className="p-0"></td>
                            </tr>
                          )}
                          <tr
                            key={`dir-${dirItem.id}`}
                            className={`transition-colors h-9 sm:h-10 md:h-11 ${
                              isDescontando
                                ? 'animate-descontar-success'
                                : 'hover:bg-app-surface-muted/60 bg-app-surface'
                            } ${
                              !puedeOperar ? 'opacity-60' : ''
                            } ${idx > 0 && !isNewGroup ? 'border-t border-border/60' : ''}`}
                          >
                            {/* Checkbox de selección individual */}
                            <td className="px-1 text-center whitespace-nowrap py-1 sm:py-1.5">
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar listado ${dirItem.numeroListado}`}
                                checked={isSelected}
                                onChange={() => onToggleSelectDirectos?.(dirItem.id)}
                                className="w-4 h-4 rounded border-border text-brand-primary accent-brand-primary focus:ring-0 focus:outline-hidden cursor-pointer"
                              />
                            </td>
                            <td
                              title={dirItem.lineaProduccion.nombre.toUpperCase()}
                              className="px-2 sm:px-2.5 truncate text-xs sm:text-[13px] md:text-sm py-1 sm:py-1.5 font-bold text-text-primary"
                            >
                              {dirItem.lineaProduccion.nombre.toUpperCase()}
                            </td>

                            <td
                              title={dirItem.numeroListado}
                              className={`px-2 sm:px-2.5 truncate font-mono font-bold text-text-primary text-xs sm:text-sm md:text-[15px] ${
                                isNewGroup ? 'pt-1.5 pb-1 sm:pt-2 sm:pb-1.5' : 'py-1 sm:py-1.5'
                              }`}
                            >
                              {dirItem.numeroListado}
                            </td>

                            <td className={`px-2 sm:px-2.5 text-right whitespace-nowrap text-text-secondary text-[11px] sm:text-xs md:text-[13px] font-medium ${
                              isNewGroup ? 'pt-1.5 pb-1 sm:pt-2 sm:pb-1.5' : 'py-1 sm:py-1.5'
                            }`}>
                              {formatFecha(dirItem.fechaRequerida)}
                            </td>

                            <td className="px-1 text-center whitespace-nowrap py-1 sm:py-1.5">
                              <IndicadorProgresoFrente
                                estado={isDescontando ? 'DESCONTADO' : dir?.estado}
                                label={tipoFrenteDir === 'BOLSAS' ? 'Bolsas' : 'Directos'}
                              />
                            </td>

                            <td className="px-1 text-center whitespace-nowrap py-1 sm:py-1.5">
                              <MenuAccionesAuditoria row={dirItem} tipoFrenteColumna={tipoFrenteDir} acciones={acciones} />
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-text-muted text-xs sm:text-sm">
                        Sin listados de DIRECTOS
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ================================================================= */}
            {/* LADO DERECHO: MATERIAL INDIRECTO                                  */}
            {/* ================================================================= */}
            <div className={`flex flex-col min-w-0 bg-app-surface transition-all ${
              isIndirectosDisabled ? 'opacity-35 pointer-events-none select-none grayscale-[0.6]' : ''
            }`}>
              <div className="py-2.5 sm:py-3.5 px-4 bg-app-surface-muted/60 border-b border-border text-center flex items-center justify-center">
                <span className="font-extrabold text-brand-secondary tracking-widest text-sm sm:text-base md:text-lg uppercase">
                  INDIRECTOS
                </span>
              </div>

              <table className="w-full table-fixed border-collapse text-left bg-app-surface">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[24%]" />
                  <col className="w-[30%]" />
                  <col className="w-[19%]" />
                  <col className="w-[14%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-app-surface text-text-secondary text-xs sm:text-sm font-bold uppercase tracking-wider">
                    <th className="py-2.5 sm:py-3 px-1 text-center" aria-label="Selección de listados"></th>
                    <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 whitespace-nowrap">LINEA / MAQ</th>
                    <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 truncate">LISTA</th>
                    <th className="py-2.5 sm:py-3 px-2 sm:px-2.5 text-right whitespace-nowrap">FECHA</th>
                    <th className="py-2.5 sm:py-3 px-1 text-center whitespace-nowrap" title="Estado de Indirectos">ESTADO</th>
                    <th className="py-2.5 sm:py-3 px-1 text-center"></th>
                  </tr>
                </thead>
                <tbody className="bg-app-surface">
                  {sortedIndirectos.length > 0 ? (
                    sortedIndirectos.map((indItem, idx) => {
                      const isNewGroup = idx > 0 && indItem.lineaProduccion.nombre !== sortedIndirectos[idx - 1].lineaProduccion.nombre;
                      const frentes = indItem.frentes ?? [];
                      const ind = frentes.find((f) => f.tipoFrente === 'INDIRECTOS');
                      const puedeOperar = acciones?.puedeOperarFrente ? acciones.puedeOperarFrente('INDIRECTOS') : true;
                      const isDescontando =
                        (Array.isArray(descontandoListadoId)
                          ? descontandoListadoId.includes(indItem.id)
                          : descontandoListadoId === indItem.id) &&
                        (!descontandoFrente || descontandoFrente === 'INDIRECTOS');
                      const isSelected = selectedIndirectosIds.includes(indItem.id);

                      return (
                        <Fragment key={`ind-row-fragment-${indItem.id}`}>
                          {isNewGroup && (
                            <tr key={`ind-separator-${indItem.id}`} className="bg-slate-100/70 border-y border-border/80 h-3 select-none pointer-events-none" aria-hidden="true">
                              <td colSpan={6} className="p-0"></td>
                            </tr>
                          )}
                          <tr
                            key={`ind-${indItem.id}`}
                            className={`transition-colors h-9 sm:h-10 md:h-11 ${
                              isDescontando
                                ? 'animate-descontar-success'
                                : 'hover:bg-app-surface-muted/60 bg-app-surface'
                            } ${
                              !puedeOperar ? 'opacity-60' : ''
                            } ${idx > 0 && !isNewGroup ? 'border-t border-border/60' : ''}`}
                          >
                            {/* Checkbox de selección individual */}
                            <td className="px-1 text-center whitespace-nowrap py-1 sm:py-1.5">
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar listado ${indItem.numeroListado}`}
                                checked={isSelected}
                                onChange={() => onToggleSelectIndirectos?.(indItem.id)}
                                className="w-4 h-4 rounded border-border text-brand-primary accent-brand-primary focus:ring-0 focus:outline-hidden cursor-pointer"
                              />
                            </td>
                            <td
                              title={indItem.lineaProduccion.nombre.toUpperCase()}
                              className="px-2 sm:px-2.5 truncate text-xs sm:text-[13px] md:text-sm py-1 sm:py-1.5 font-bold text-text-primary"
                            >
                              {indItem.lineaProduccion.nombre.toUpperCase()}
                            </td>

                            <td
                              title={indItem.numeroListado}
                              className={`px-2 sm:px-2.5 truncate font-mono font-bold text-text-primary text-xs sm:text-sm md:text-[15px] ${
                                isNewGroup ? 'pt-1.5 pb-1 sm:pt-2 sm:pb-1.5' : 'py-1 sm:py-1.5'
                              }`}
                            >
                              {indItem.numeroListado}
                            </td>

                            <td className={`px-2 sm:px-2.5 text-right whitespace-nowrap text-text-secondary text-[11px] sm:text-xs md:text-[13px] font-medium ${
                              isNewGroup ? 'pt-1.5 pb-1 sm:pt-2 sm:pb-1.5' : 'py-1 sm:py-1.5'
                            }`}>
                              {formatFecha(indItem.fechaRequerida)}
                            </td>

                            <td className="px-1 text-center whitespace-nowrap py-1 sm:py-1.5">
                              <IndicadorProgresoFrente
                                estado={isDescontando ? 'DESCONTADO' : ind?.estado}
                                label="Indirectos"
                              />
                            </td>

                            <td className="px-1 text-center whitespace-nowrap py-1 sm:py-1.5">
                              <MenuAccionesAuditoria row={indItem} tipoFrenteColumna="INDIRECTOS" acciones={acciones} />
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-text-muted text-xs sm:text-sm">
                        Sin listados de INDIRECTOS
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
