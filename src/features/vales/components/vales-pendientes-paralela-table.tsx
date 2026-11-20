import { useState, useRef, useEffect, useMemo, Fragment, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/icon';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { classifyVales, canOperateValeItem } from '../utils/classify-vales';
import { usePermissions } from '@/shared/hooks/use-permissions';
import type { ValeItem, EstadoVale } from '../types/vales.types';

/**
 * Formatea una fecha ISO/YYYY-MM-DD → dd/mm/aaaa sin UTC shift.
 */
function defaultFormatFecha(fechaStr: string): string {
  if (!fechaStr) return '—';
  const solo = fechaStr.includes('T') ? fechaStr.slice(0, 10) : fechaStr;
  const [year, month, day] = solo.split('-');
  if (!year || !month || !day) return fechaStr;
  return `${day}/${month}/${year}`;
}

export interface AccionesFilaVale {
  onVerDetalle: (vale: ValeItem) => void;
  onEditar?: (vale: ValeItem) => void;
  onSeparar?: (vale: ValeItem) => void;
  onEntregar?: (vale: ValeItem) => void;
  onDescontar?: (vale: ValeItem) => void;
  onRetroceder?: (vale: ValeItem) => void;
  onCancelar?: (vale: ValeItem) => void;
  canSeparar?: boolean;
  canEntregar?: boolean;
  canDescontar?: boolean;
  canRetroceder?: boolean;
  canEditar?: boolean;
  canCancelar?: boolean;
}

export interface ValesPendientesParalelaTableProps {
  items?: ValeItem[];
  botaItems?: ValeItem[];
  accesoriosItems?: ValeItem[];
  otroItems?: ValeItem[];
  formatFecha?: (fechaStr: string) => string;
  isLoading: boolean;
  emptyMessage?: string;
  page?: number;
  limit?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  selectedBotaIds?: number[];
  selectedAccesoriosIds?: number[];
  selectedOtroIds?: number[];
  onToggleBotaId?: (id: number) => void;
  onToggleAccesoriosId?: (id: number) => void;
  onToggleOtroId?: (id: number) => void;
  onToggleAllBota?: (checked: boolean) => void;
  onToggleAllAccesorios?: (checked: boolean) => void;
  allowSelection?: boolean;
  isItemOperable?: (vale: ValeItem) => boolean;
  acciones?: AccionesFilaVale;
  isBotaDisabled?: boolean;
  isAccesoriosDisabled?: boolean;
  isOtroDisabled?: boolean;
  hideActions?: boolean;
  headerRight?: ReactNode;
  highlightedValeId?: number | number[] | null;
  entregandoValeId?: number | number[] | null;
  descontandoValeId?: number | number[] | null;
}

/**
 * Renderiza el progreso acumulado del vale con el mismo diseño exacto de IndicadorProgresoFrente en Listados:
 * - PENDIENTE  → ⋯ (Materiales Pendientes)
 * - SEPARADO   → 🟡 (Separado en Almacén)
 * - ENTREGADO  → 🟡 ✔️ (Separado + Entregado a Producción)
 * - DESCONTADO → 🟡 ✔️ ☑️ (Separado + Entregado + Descontado en Sistema)
 */
function IndicadorProgresoVale({ estado }: { estado?: EstadoVale }): ReactNode {
  if (!estado) {
    return (
      <span className="text-text-muted/30 text-xs select-none font-bold" title="No aplica">
        —
      </span>
    );
  }

  if (estado === 'DESCONTADO') {
    return (
      <span
        className="inline-flex items-center justify-center gap-1.5 select-none"
        title="Separado + Entregado + Descontado en Sistema"
      >
        <Icon name="circle" fill size="13px" className="text-amber-500 shrink-0" />
        <Icon name="check" size="15px" weight={700} className="text-emerald-600 shrink-0" />
        <Icon name="done_all" size="17px" weight={700} className="text-purple-600 shrink-0" />
      </span>
    );
  }

  if (estado === 'ENTREGADO') {
    return (
      <span
        className="inline-flex items-center justify-center gap-1.5 select-none"
        title="Separado en Almacén + Entregado a Producción"
      >
        <Icon name="circle" fill size="13px" className="text-amber-500 shrink-0" />
        <Icon name="check" size="15px" weight={700} className="text-emerald-600 shrink-0" />
      </span>
    );
  }

  if (estado === 'SEPARADO') {
    return (
      <span
        className="inline-flex items-center justify-center select-none"
        title="Separado en Almacén"
      >
        <Icon name="circle" fill size="14px" className="text-amber-500 shrink-0" />
      </span>
    );
  }

  if (estado === 'CANCELADO') {
    return (
      <span className="inline-flex items-center justify-center select-none" title="Cancelado">
        <Icon name="cancel" size="15px" className="text-danger shrink-0" />
      </span>
    );
  }

  // PENDIENTE
  return (
    <span
      className="inline-flex items-center justify-center select-none"
      title="Materiales Pendientes"
    >
      <Icon name="more_horiz" size="16px" className="text-text-muted/70 shrink-0" />
    </span>
  );
}

/**
 * Menú contextual compacto para acciones operativas por fila.
 * Idéntico a MenuAccionesFila de ListadosPendientesParalelaTable.
 */
function MenuAccionesFila({
  row,
  acciones,
}: {
  row: ValeItem;
  acciones?: AccionesFilaVale;
}): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const updateMenuPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 224;
      const menuHeight = 220;

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

  const { user } = usePermissions();
  const canOperate = canOperateValeItem(user, row);

  const isCancelado = row.estado === 'CANCELADO';
  const isDescontado = row.estado === 'DESCONTADO';
  const isTerminal = isCancelado || isDescontado;

  const canRetroceder =
    Boolean(acciones.canRetroceder && acciones.onRetroceder && canOperate) &&
    (row.estado === 'SEPARADO' || row.estado === 'ENTREGADO');
  const canEditar =
    Boolean(acciones.canEditar && acciones.onEditar) && !isTerminal;
  const canCancelar =
    Boolean(acciones.canCancelar && acciones.onCancelar) && !isTerminal;
  const canSeparar =
    Boolean(acciones.canSeparar && acciones.onSeparar && canOperate) && row.estado === 'PENDIENTE';
  const canEntregar =
    Boolean(acciones.canEntregar && acciones.onEntregar && canOperate) && row.estado === 'SEPARADO';
  const canDescontar =
    Boolean(acciones.canDescontar && acciones.onDescontar && canOperate) && row.estado === 'ENTREGADO';

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
        title="Opciones de vale"
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

            {canEditar && !isTerminal && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  acciones.onEditar!(row);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-text-primary hover:bg-cuadra-arena/40 text-left transition-colors cursor-pointer"
              >
                <Icon name="edit" size="xs" className="text-text-muted" />
                <span>Editar vale</span>
              </button>
            )}

            {canSeparar && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  acciones.onSeparar!(row);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-amber-700 font-semibold hover:bg-amber-500/10 text-left transition-colors cursor-pointer text-[13px] rounded-md"
              >
                <Icon name="arrow_forward" size="sm" className="text-amber-600" />
                <span>Separar</span>
              </button>
            )}

            {canEntregar && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  acciones.onEntregar!(row);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-emerald-700 font-semibold hover:bg-emerald-500/10 text-left transition-colors cursor-pointer text-[13px] rounded-md"
              >
                <Icon name="arrow_forward" size="sm" className="text-emerald-600" />
                <span>Entregar</span>
              </button>
            )}

            {canDescontar && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  acciones.onDescontar!(row);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-purple-700 font-semibold hover:bg-purple-500/10 text-left transition-colors cursor-pointer text-[13px] rounded-md"
              >
                <Icon name="done_all" size="sm" className="text-purple-600" />
                <span>Descontar</span>
              </button>
            )}

            {canRetroceder && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  acciones.onRetroceder!(row);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-warning-text hover:bg-warning-subtle text-left transition-colors cursor-pointer border-t border-border/50"
              >
                <Icon name="undo" size="xs" />
                <span>Retroceder</span>
              </button>
            )}

            {canCancelar && !isTerminal && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  acciones.onCancelar!(row);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-danger hover:bg-danger/10 text-left transition-colors cursor-pointer border-t border-border/50"
              >
                <Icon name="block" size="xs" />
                <span>Cancelar vale</span>
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

/**
 * Proporciones de columnas para: [Checkbox] | LINEA / MAQ | SERIE | VALE | FECHA | EST | [Acciones]
 */
function renderColGroup(withSelection: boolean, hideActions: boolean = false) {
  if (hideActions) {
    if (!withSelection) {
      return (
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[18%]" />
          <col className="w-[24%]" />
          <col className="w-[18%]" />
          <col className="w-[12%]" />
        </colgroup>
      );
    }
    return (
      <colgroup>
        <col className="w-[5%]" />
        <col className="w-[26%]" />
        <col className="w-[17%]" />
        <col className="w-[23%]" />
        <col className="w-[17%]" />
        <col className="w-[12%]" />
      </colgroup>
    );
  }

  if (!withSelection) {
    return (
      <colgroup>
        <col className="w-[26%]" />
        <col className="w-[17%]" />
        <col className="w-[23%]" />
        <col className="w-[16%]" />
        <col className="w-[11%]" />
        <col className="w-[7%]" />
      </colgroup>
    );
  }

  return (
    <colgroup>
      <col className="w-[5%]" />
      <col className="w-[24%]" />
      <col className="w-[16%]" />
      <col className="w-[22%]" />
      <col className="w-[16%]" />
      <col className="w-[10%]" />
      <col className="w-[7%]" />
    </colgroup>
  );
}

/**
 * Ordenamiento independiente por Orden de Línea, Nombre de Línea, Fecha de Solicitud y Folio.
 */
function sortVales(items: ValeItem[]): ValeItem[] {
  return [...items].sort((a, b) => {
    const ordA = a.departamentoVale?.orden ?? 9999;
    const ordB = b.departamentoVale?.orden ?? 9999;
    if (ordA !== ordB) return ordA - ordB;

    const lineaA = (a.departamentoVale?.nombre ?? '').toUpperCase();
    const lineaB = (b.departamentoVale?.nombre ?? '').toUpperCase();
    const lineaComp = lineaA.localeCompare(lineaB, 'es', { numeric: true });
    if (lineaComp !== 0) return lineaComp;

    const fA = a.fechaSolicitud.includes('T') ? a.fechaSolicitud.slice(0, 10) : a.fechaSolicitud;
    const fB = b.fechaSolicitud.includes('T') ? b.fechaSolicitud.slice(0, 10) : b.fechaSolicitud;
    if (fA !== fB) return fA.localeCompare(fB);

    return (a.folio ?? '').localeCompare(b.folio ?? '', 'es', { numeric: true });
  });
}

/**
 * Renderiza una columna individual (BOTA, ACCESORIOS u OTRO).
 * Cuando `compact` es false (solo BOTA y ACCESORIOS), usa el tamaño amplio idéntico a Listados.
 * Cuando `compact` es true (también está OTRO presente), ajusta los tamaños de texto y paddings.
 */
function SeccionTablaArea({
  titulo,
  tituloClassName,
  emptyLabel,
  items,
  isDisabled,
  allowSelection,
  hideActions,
  selectedIds,
  onToggleSelect,
  formatFecha,
  acciones,
  highlightedValeId,
  entregandoValeId,
  descontandoValeId,
  compact = false,
  isItemOperable,
}: {
  titulo: string;
  tituloClassName: string;
  emptyLabel: string;
  items: ValeItem[];
  isDisabled: boolean;
  allowSelection: boolean;
  hideActions: boolean;
  selectedIds: number[];
  onToggleSelect?: (id: number) => void;
  formatFecha: (f: string) => string;
  acciones?: AccionesFilaVale;
  highlightedValeId?: number | number[] | null;
  entregandoValeId?: number | number[] | null;
  descontandoValeId?: number | number[] | null;
  compact?: boolean;
  isItemOperable?: (vale: ValeItem) => boolean;
}): ReactNode {
  const { user } = usePermissions();
  const totalCols = (allowSelection ? 1 : 0) + 5 + (hideActions ? 0 : 1);

  return (
    <div
      className={`flex flex-col min-w-0 bg-app-surface transition-all ${
        isDisabled ? 'opacity-35 pointer-events-none select-none grayscale-[0.6]' : ''
      }`}
    >
      {/* Encabezado centrado sin contador */}
      <div className="py-2.5 sm:py-3.5 px-4 bg-app-surface-muted/60 border-b border-border flex items-center justify-center gap-2 text-center">
        <span className={tituloClassName}>{titulo}</span>
      </div>

      <table className="w-full table-fixed border-collapse text-left bg-app-surface">
        {renderColGroup(allowSelection, hideActions)}
        <thead>
          <tr
            className={`border-b border-border bg-app-surface text-text-secondary font-bold uppercase tracking-wider ${
              compact ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'
            }`}
          >
            {allowSelection && (
              <th
                className={`${compact ? 'py-2' : 'py-2.5 sm:py-3'} px-1 text-center`}
                aria-label="Selección de vales"
              ></th>
            )}
            <th
              className={`${
                compact ? 'py-2 px-1.5 sm:px-2' : 'py-2.5 sm:py-3 px-2 sm:px-2.5'
              } whitespace-nowrap`}
            >
              LINEA / MAQ
            </th>
            <th
              className={`${
                compact ? 'py-2 px-1.5 sm:px-2' : 'py-2.5 sm:py-3 px-2 sm:px-2.5'
              } truncate`}
            >
              SERIE
            </th>
            <th
              className={`${
                compact ? 'py-2 px-1.5 sm:px-2' : 'py-2.5 sm:py-3 px-2 sm:px-2.5'
              } truncate`}
            >
              VALE
            </th>
            <th
              className={`${
                compact ? 'py-2 px-1.5 sm:px-2' : 'py-2.5 sm:py-3 px-2 sm:px-2.5'
              } text-right whitespace-nowrap`}
            >
              FECHA
            </th>
            <th
              className={`${compact ? 'py-2' : 'py-2.5 sm:py-3'} px-1 text-center whitespace-nowrap`}
              title="Estado del Vale"
            >
              EST
            </th>
            {!hideActions && (
              <th className={`${compact ? 'py-2' : 'py-2.5 sm:py-3'} px-1 text-center`}></th>
            )}
          </tr>
        </thead>
        <tbody className="bg-app-surface">
          {items.length > 0 ? (
            items.map((item, idx) => {
              const isNewGroup =
                idx > 0 &&
                item.departamentoVale?.nombre !== items[idx - 1]?.departamentoVale?.nombre;
              const isHighlighted = Array.isArray(highlightedValeId)
                ? highlightedValeId.includes(item.id)
                : highlightedValeId === item.id;
              const isEntregando = Array.isArray(entregandoValeId)
                ? entregandoValeId.includes(item.id)
                : entregandoValeId === item.id;
              const isDescontando = Array.isArray(descontandoValeId)
                ? descontandoValeId.includes(item.id)
                : descontandoValeId === item.id;
              const isSelected = allowSelection && selectedIds.includes(item.id);
              const serieCodigo = item.serie?.codigo ?? '—';

              const estadoVisual: EstadoVale = isDescontando
                ? 'DESCONTADO'
                : isEntregando
                  ? 'ENTREGADO'
                  : item.estado;

              const cellVerticalPad = compact
                ? 'py-1'
                : isNewGroup
                  ? 'pt-1.5 pb-1 sm:pt-2 sm:pb-1.5'
                  : 'py-1 sm:py-1.5';

              return (
                <Fragment key={`${titulo}-row-fragment-${item.id}`}>
                  {isNewGroup && (
                    <tr
                      key={`${titulo}-separator-${item.id}`}
                      className="bg-slate-100/70 border-y border-border/80 h-3 select-none pointer-events-none"
                      aria-hidden="true"
                    >
                      <td colSpan={totalCols} className="p-0"></td>
                    </tr>
                  )}
                  <tr
                    key={`${titulo}-${item.id}`}
                    className={`transition-colors ${
                      compact ? 'h-8 sm:h-9' : 'h-9 sm:h-10 md:h-11'
                    } ${
                      isDescontando
                        ? 'animate-descontar-success'
                        : isEntregando
                          ? 'animate-entregar-success'
                          : isHighlighted
                            ? 'animate-highlight-row'
                            : 'bg-app-surface hover:bg-app-surface-muted/60'
                    } ${idx > 0 && !isNewGroup ? 'border-t border-border/60' : ''}`}
                  >
                    {/* Checkbox de selección individual (solo si es operable por el usuario y dentro de su alcance) */}
                    {allowSelection && (
                      <td className="px-1 text-center whitespace-nowrap py-1 sm:py-1.5">
                        {isItemOperable ? (
                          isItemOperable(item) ? (
                            <input
                              type="checkbox"
                              aria-label={`Seleccionar vale ${item.folio}`}
                              checked={isSelected}
                              onChange={() => onToggleSelect?.(item.id)}
                              className="w-4 h-4 rounded border-border text-brand-primary accent-brand-primary focus:ring-0 focus:outline-hidden cursor-pointer"
                            />
                          ) : (
                            <span className="text-text-muted/20 text-xs select-none">—</span>
                          )
                        ) : canOperateValeItem(user, item) && item.estado !== 'CANCELADO' && item.estado !== 'DESCONTADO' ? (
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar vale ${item.folio}`}
                            checked={isSelected}
                            onChange={() => onToggleSelect?.(item.id)}
                            className="w-4 h-4 rounded border-border text-brand-primary accent-brand-primary focus:ring-0 focus:outline-hidden cursor-pointer"
                          />
                        ) : (
                          <span className="text-text-muted/20 text-xs select-none">—</span>
                        )}
                      </td>
                    )}

                    {/* LINEA / MAQ */}
                    <td
                      title={item.departamentoVale?.nombre?.toUpperCase()}
                      className={`${
                        compact
                          ? 'px-1.5 sm:px-2 text-[11px] sm:text-xs py-1'
                          : 'px-2 sm:px-2.5 text-xs sm:text-[13px] md:text-sm py-1 sm:py-1.5'
                      } truncate font-bold text-text-primary`}
                    >
                      {item.departamentoVale?.nombre?.toUpperCase() ?? '—'}
                    </td>

                    {/* SERIE (separada del número de vale) */}
                    <td
                      title={serieCodigo}
                      className={`${
                        compact
                          ? 'px-1.5 sm:px-2 text-[11px] sm:text-xs'
                          : 'px-2 sm:px-2.5 text-xs sm:text-sm md:text-[15px]'
                      } truncate font-mono font-bold text-text-secondary ${cellVerticalPad}`}
                    >
                      {serieCodigo}
                    </td>

                    {/* VALE (únicamente el folio / número de vale) */}
                    <td
                      title={item.folio}
                      className={`${
                        compact
                          ? 'px-1.5 sm:px-2 text-[11px] sm:text-xs md:text-[13px]'
                          : 'px-2 sm:px-2.5 text-xs sm:text-sm md:text-[15px]'
                      } truncate font-mono font-bold text-text-primary ${cellVerticalPad}`}
                    >
                      {item.folio}
                    </td>

                    {/* FECHA a la derecha */}
                    <td
                      className={`${
                        compact
                          ? 'px-1.5 sm:px-2 text-[10px] sm:text-[11px]'
                          : 'px-2 sm:px-2.5 text-[11px] sm:text-xs md:text-[13px]'
                      } text-right whitespace-nowrap text-text-secondary font-medium ${cellVerticalPad}`}
                    >
                      {formatFecha(item.fechaSolicitud)}
                    </td>

                    {/* Estado visual */}
                    <td className={`px-1 text-center whitespace-nowrap ${cellVerticalPad}`}>
                      <IndicadorProgresoVale estado={estadoVisual} />
                    </td>

                    {/* Acciones */}
                    {!hideActions && (
                      <td className="px-1 text-center whitespace-nowrap py-1 sm:py-1.5">
                        <MenuAccionesFila row={item} acciones={acciones} />
                      </td>
                    )}
                  </tr>
                </Fragment>
              );
            })
          ) : (
            <tr>
              <td
                colSpan={totalCols}
                className="py-10 text-center text-text-muted text-xs sm:text-sm"
              >
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Tablero Operativo Paralelo de Vales:
 * - Columnas separadas: LINEA / MAQ | SERIE | VALE | FECHA | EST
 * - Cuando solo hay BOTA y ACCESORIOS, utiliza los mismos tamaños de texto amplios que Listados.
 * - Cuando también hay OTRO, ajusta los textos a un tamaño compacto adaptable a 3 columnas.
 */
export function ValesPendientesParalelaTable({
  items,
  botaItems: botaItemsProp,
  accesoriosItems: accesoriosItemsProp,
  otroItems: otroItemsProp,
  formatFecha = defaultFormatFecha,
  isLoading,
  emptyMessage = 'No hay vales de Almacén MBC para mostrar.',
  pagination,
  onPageChange,
  selectedBotaIds = [],
  selectedAccesoriosIds = [],
  selectedOtroIds = [],
  onToggleBotaId,
  onToggleAccesoriosId,
  onToggleOtroId,
  allowSelection = false,
  acciones,
  isBotaDisabled = false,
  isAccesoriosDisabled = false,
  isOtroDisabled = false,
  hideActions = false,
  isItemOperable,
  headerRight,
  highlightedValeId = null,
  entregandoValeId = null,
  descontandoValeId = null,
}: ValesPendientesParalelaTableProps): ReactNode {
  const { botaItems, accesoriosItems, otroItems } = useMemo(() => {
    if (botaItemsProp !== undefined && accesoriosItemsProp !== undefined) {
      return {
        botaItems: botaItemsProp,
        accesoriosItems: accesoriosItemsProp,
        otroItems: otroItemsProp ?? [],
      };
    }
    return classifyVales(items ?? []);
  }, [items, botaItemsProp, accesoriosItemsProp, otroItemsProp]);

  const sortedBota = useMemo(() => sortVales(botaItems), [botaItems]);
  const sortedAccesorios = useMemo(() => sortVales(accesoriosItems), [accesoriosItems]);
  const sortedOtro = useMemo(() => sortVales(otroItems), [otroItems]);

  const hasOtro = sortedOtro.length > 0;

  if (isLoading) {
    return (
      <div className="w-full space-y-4">
        {/* Barra superior skeleton */}
        <div className="py-2 px-3 bg-app-surface/90 border border-border/80 rounded-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-32 hidden sm:block" />
            <Skeleton className="h-4 w-36 hidden md:block" />
            <Skeleton className="h-4 w-36 hidden lg:block" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>

        {/* Tablero paralelo skeleton */}
        <div className="bg-app-surface border border-border rounded-xl shadow-2xs overflow-hidden w-full">
          <div className={`w-full grid ${hasOtro ? 'grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x' : 'grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x'} divide-border`}>
            {/* Lado Bota */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-center pb-2 border-b border-border">
                <Skeleton className="h-6 w-24" />
              </div>
              <div className="space-y-2.5 pt-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={`sk-bota-${i}`} className="flex items-center justify-between gap-3 py-2 px-2 border-b border-border/40">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Lado Accesorios */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-center pb-2 border-b border-border">
                <Skeleton className="h-6 w-32" />
              </div>
              <div className="space-y-2.5 pt-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={`sk-acc-${i}`} className="flex items-center justify-between gap-3 py-2 px-2 border-b border-border/40">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-6 w-6 rounded-full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Lado Otro si aplica */}
            {hasOtro && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-center pb-2 border-b border-border">
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="space-y-2.5 pt-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={`sk-otro-${i}`} className="flex items-center justify-between gap-3 py-2 px-2 border-b border-border/40">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-6 w-6 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (sortedBota.length === 0 && sortedAccesorios.length === 0 && sortedOtro.length === 0) {
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
      {/* ─── Barra Superior de Leyenda de Progreso (Idéntica a Listados) ────────── */}
      <div className="py-1.5 px-3 bg-app-surface/90 border border-border/80 rounded-lg shadow-2xs flex items-center justify-between text-xs text-text-muted gap-3 flex-wrap">
        <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
          <span className="flex items-center gap-1.5 font-medium">
            <Icon name="more_horiz" size="18px" className="text-text-muted/70 shrink-0" />
            <span className="text-text-secondary font-semibold">Materiales Pendientes</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <Icon name="circle" fill size="13px" className="text-amber-500 shrink-0" />
            <span className="text-text-secondary font-semibold">Separado en Almacén</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <Icon name="check" size="15px" weight={700} className="text-emerald-600 shrink-0" />
            <span className="text-text-secondary font-semibold">Entregado a Producción</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <Icon name="done_all" size="17px" weight={700} className="text-purple-600 shrink-0" />
            <span className="text-text-secondary font-semibold">Descontado en Sistema</span>
          </span>
        </div>
        {headerRight && <div className="flex items-center gap-2 shrink-0">{headerRight}</div>}
      </div>

      {/* ─── Tabla Unificada Fluida (BOTA | ACCESORIOS | [OTRO si existe]) ──── */}
      <div className="bg-app-surface border border-border rounded-xl shadow-2xs overflow-hidden w-full">
        <div className="overflow-x-auto w-full custom-scrollbar">
          <div
            className={`w-full ${
              hasOtro ? 'min-w-[1280px] grid grid-cols-3' : 'min-w-[1040px] grid grid-cols-2'
            } divide-x divide-border items-stretch`}
          >
            {/* LADO IZQUIERDO: BOTA */}
            <SeccionTablaArea
              titulo="BOTA"
              tituloClassName="font-black text-brand-primary tracking-widest text-sm sm:text-base md:text-lg uppercase"
              emptyLabel="Sin vales de BOTA"
              items={sortedBota}
              isDisabled={isBotaDisabled}
              allowSelection={allowSelection}
              hideActions={hideActions}
              selectedIds={selectedBotaIds}
              onToggleSelect={onToggleBotaId}
              formatFecha={formatFecha}
              acciones={acciones}
              highlightedValeId={highlightedValeId}
              entregandoValeId={entregandoValeId}
              descontandoValeId={descontandoValeId}
              compact={hasOtro}
              isItemOperable={isItemOperable}
            />

            {/* LADO DERECHO (O CENTRAL): ACCESORIOS */}
            <SeccionTablaArea
              titulo="ACCESORIOS"
              tituloClassName="font-extrabold text-brand-secondary tracking-widest text-sm sm:text-base md:text-lg uppercase"
              emptyLabel="Sin vales de ACCESORIOS"
              items={sortedAccesorios}
              isDisabled={isAccesoriosDisabled}
              allowSelection={allowSelection}
              hideActions={hideActions}
              selectedIds={selectedAccesoriosIds}
              onToggleSelect={onToggleAccesoriosId}
              formatFecha={formatFecha}
              acciones={acciones}
              highlightedValeId={highlightedValeId}
              entregandoValeId={entregandoValeId}
              descontandoValeId={descontandoValeId}
              compact={hasOtro}
              isItemOperable={isItemOperable}
            />

            {/* LADO OTRO (Solo cuando existen registros del área OTRO) */}
            {hasOtro && (
              <SeccionTablaArea
                titulo="OTRO"
                tituloClassName="font-extrabold text-text-primary tracking-widest text-sm sm:text-base md:text-lg uppercase"
                emptyLabel="Sin vales de OTRO"
                items={sortedOtro}
                isDisabled={isOtroDisabled}
                allowSelection={allowSelection}
                hideActions={hideActions}
                selectedIds={selectedOtroIds}
                onToggleSelect={onToggleOtroId}
                formatFecha={formatFecha}
                acciones={acciones}
                highlightedValeId={highlightedValeId}
                entregandoValeId={entregandoValeId}
                descontandoValeId={descontandoValeId}
                compact={true}
                isItemOperable={isItemOperable}
              />
            )}
          </div>
        </div>
      </div>

      {/* ─── Paginación ──────────────────────────────────────────────────────── */}
      {pagination && pagination.totalPages > 1 && onPageChange && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={onPageChange}
          variant="bar"
        />
      )}
    </div>
  );
}
