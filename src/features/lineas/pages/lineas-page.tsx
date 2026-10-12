import { useState, useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/cn';
import { useLineas } from '../hooks/use-lineas';
import { LineaFormModal } from '../components/linea-form-modal';
import { LineaDeactivateModal } from '../components/linea-deactivate-modal';
import type { LineaProduccionItem, AreaProduccion } from '../types/lineas.types';

export function LineasPage(): ReactNode {
  const {
    departamentos,
    allLines,
    isLoading,
    error,
    createLinea,
    updateLinea,
    deleteLinea,
    reactivateLinea,
    reorderLineas,
  } = useLineas();

  // Alternador discreto de inactivas (por defecto false = ver activas)
  const [verInactivas, setVerInactivas] = useState<boolean>(false);

  // Búsqueda simple por texto
  const [busqueda, setBusqueda] = useState<string>('');

  // Estados de modales
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [selectedLineaForEdit, setSelectedLineaForEdit] = useState<LineaProduccionItem | null>(null);

  const [isDeactivateOpen, setIsDeactivateOpen] = useState<boolean>(false);
  const [selectedLineaForStatus, setSelectedLineaForStatus] = useState<LineaProduccionItem | null>(null);

  // Estado para feedback de guardado/reordenamiento
  const [isSavingOrder, setIsSavingOrder] = useState<boolean>(false);
  const [draggedLineId, setDraggedLineId] = useState<number | null>(null);
  const [dragOverLineId, setDragOverLineId] = useState<number | null>(null);

  // Separar líneas en BOTA y ACCESORIOS respetando el orden secuencial
  const { botaLines, accesoriosLines } = useMemo(() => {
    const targetEstado = verInactivas ? 'INACTIVO' : 'ACTIVO';
    let lines = allLines.filter((l) => l.estado === targetEstado);

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lines = lines.filter(
        (l) =>
          l.nombre.toLowerCase().includes(q) ||
          (l.departamentoNombre || '').toLowerCase().includes(q) ||
          l.area.toLowerCase().includes(q),
      );
    }

    // Ordenar por 'orden' asc (fallback: id asc)
    const sorted = [...lines].sort((a, b) => {
      const ordA = a.orden ?? 0;
      const ordB = b.orden ?? 0;
      if (ordA !== ordB) return ordA - ordB;
      return a.id - b.id;
    });

    const bota = sorted.filter((l) => l.area === 'BOTA');
    const accesorios = sorted.filter((l) => l.area === 'ACCESORIOS');

    return { botaLines: bota, accesoriosLines: accesorios };
  }, [allLines, verInactivas, busqueda]);

  const handleOpenCreate = () => {
    setSelectedLineaForEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (linea: LineaProduccionItem) => {
    setSelectedLineaForEdit(linea);
    setIsFormOpen(true);
  };

  const handleOpenToggleStatus = (linea: LineaProduccionItem) => {
    setSelectedLineaForStatus(linea);
    setIsDeactivateOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedLineaForStatus) return;
    if (selectedLineaForStatus.estado === 'ACTIVO') {
      await deleteLinea(selectedLineaForStatus.id);
    } else {
      await reactivateLinea(selectedLineaForStatus.id);
    }
  };

  // ─── Drag and Drop Handler ───────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, lineId: number) => {
    setDraggedLineId(lineId);
    e.dataTransfer.setData('text/plain', String(lineId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetLineId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverLineId !== targetLineId) {
      setDragOverLineId(targetLineId);
    }
  };

  const handleDragLeave = (targetLineId: number) => {
    if (dragOverLineId === targetLineId) {
      setDragOverLineId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetLine: LineaProduccionItem, area: AreaProduccion) => {
    e.preventDefault();
    setDragOverLineId(null);
    const sourceId = draggedLineId || Number(e.dataTransfer.getData('text/plain'));
    setDraggedLineId(null);

    if (!sourceId || sourceId === targetLine.id) return;

    // Obtener lista del área afectada
    const currentList = area === 'BOTA' ? [...botaLines] : [...accesoriosLines];
    const sourceIndex = currentList.findIndex((l) => l.id === sourceId);
    const targetIndex = currentList.findIndex((l) => l.id === targetLine.id);

    if (sourceIndex === -1 || targetIndex === -1) return;

    // Reordenar array en memoria
    const [movedItem] = currentList.splice(sourceIndex, 1);
    currentList.splice(targetIndex, 0, movedItem);

    // Calcular nuevos órdenes secuenciales (1, 2, 3...)
    const payload = currentList.map((item, index) => ({
      id: item.id,
      orden: index + 1,
    }));

    setIsSavingOrder(true);
    try {
      await reorderLineas(payload);
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDragEnd = () => {
    setDraggedLineId(null);
    setDragOverLineId(null);
  };

  // Renderizar una columna de tabla (BOTA o ACCESORIOS)
  const renderTableSection = (
    titulo: string,
    area: AreaProduccion,
    items: LineaProduccionItem[],
    colorBadge: string,
  ) => {
    return (
      <div className="flex flex-col min-w-0 bg-app-surface">
        {/* Encabezado del bloque centrado */}
        <div className="py-2.5 sm:py-3 px-4 bg-app-surface-muted/60 border-b border-border flex items-center justify-between">
          <span className={cn('font-black tracking-widest text-sm sm:text-base uppercase', colorBadge)}>
            {titulo}
          </span>
          <span className="text-2xs text-text-muted font-mono font-medium">
            {items.length} {items.length === 1 ? 'línea' : 'líneas'}
          </span>
        </div>

        <table className="w-full table-fixed border-collapse text-left bg-app-surface">
          <colgroup>
            <col className="w-[10%]" /> {/* Drag Handle */}
            <col className="w-[12%]" /> {/* Posición # */}
            <col className="w-[48%]" /> {/* Línea / Maquila */}
            <col className="w-[18%]" /> {/* Acciones */}
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-app-surface text-text-secondary text-xs font-bold uppercase tracking-wider">
              <th className="py-2 px-1 text-center"></th>
              <th className="py-2 px-2 text-center whitespace-nowrap">#</th>
              <th className="py-2 px-2 truncate">LÍNEA / MAQUILA</th>
              <th className="py-2 px-2 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-app-surface">
            {items.length > 0 ? (
              items.map((line, index) => {
                const isDragging = draggedLineId === line.id;
                const isOver = dragOverLineId === line.id;

                return (
                  <tr
                    key={line.id}
                    draggable={!verInactivas && !busqueda.trim()}
                    onDragStart={(e) => handleDragStart(e, line.id)}
                    onDragOver={(e) => handleDragOver(e, line.id)}
                    onDragLeave={() => handleDragLeave(line.id)}
                    onDrop={(e) => handleDrop(e, line, area)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'transition-all duration-150 h-10',
                      !verInactivas && !busqueda.trim() && 'cursor-grab active:cursor-grabbing',
                      isDragging && 'opacity-30 bg-cuadra-arena/40',
                      isOver && 'bg-brand-primary/10 border-t-2 border-brand-primary',
                      !isDragging && !isOver && 'hover:bg-app-surface-muted/60',
                    )}
                  >
                    {/* Icono de arrastre */}
                    <td className="px-1 text-center text-text-muted/60 hover:text-text-primary select-none">
                      {!verInactivas && !busqueda.trim() ? (
                        <Icon name="drag_indicator" size="16px" className="cursor-grab active:cursor-grabbing mx-auto" />
                      ) : (
                        <span className="text-text-muted/30 text-2xs">—</span>
                      )}
                    </td>

                    {/* Posición numérica ordinal */}
                    <td className="px-2 text-center font-mono font-bold text-xs text-text-secondary select-none">
                      {index + 1}
                    </td>

                    {/* Nombre de Línea */}
                    <td className="px-2 font-bold text-xs sm:text-sm text-text-primary truncate" title={line.nombre}>
                      {line.nombre.toUpperCase()}
                    </td>

                    {/* Acciones */}
                    <td className="px-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {!verInactivas ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(line)}
                              className="h-7 w-7 p-0 text-text-secondary hover:text-text-primary"
                              title="Editar línea"
                            >
                              <Icon name="edit" size="14px" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenToggleStatus(line)}
                              className="h-7 w-7 p-0 text-danger hover:bg-danger/10"
                              title="Inactivar línea"
                            >
                              <Icon name="power_settings_new" size="14px" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenToggleStatus(line)}
                            className="h-7 px-2 text-success hover:bg-success/10 font-medium text-xs flex items-center gap-1"
                            title="Reactivar línea"
                          >
                            <Icon name="check_circle" size="14px" />
                            Reactivar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="py-10 text-center text-text-muted text-xs">
                  Sin líneas en {titulo}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Encabezado del módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-sans text-text-primary">
            Líneas de Producción
          </h1>
          <p className="text-xs text-text-secondary font-lectura mt-0.5">
            Configura el orden operativo de las líneas arrastrándolas. Este orden define cómo se agrupan y muestran en los listados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSavingOrder && (
            <div className="flex items-center gap-1.5 text-xs text-brand-primary font-medium px-2 py-1 bg-brand-primary/10 rounded-lg animate-pulse">
              <Spinner size="14px" />
              <span>Guardando orden...</span>
            </div>
          )}

          <Button
            variant="guardar"
            icon="add_circle"
            size="sm"
            onClick={handleOpenCreate}
            className="shrink-0 text-xs h-8 px-3"
          >
            Nueva Línea
          </Button>
        </div>
      </div>

      {/* Barra de herramientas: Búsqueda y Botón para Inactivas */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar línea..."
            className="pl-8 h-8 text-xs"
          />
          <Icon
            name="search"
            size="xs"
            className="absolute left-2.5 top-2 text-text-muted pointer-events-none"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setVerInactivas((prev) => !prev)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border',
              verInactivas
                ? 'bg-danger/10 text-danger border-danger/30 font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-cuadra-arena/50 border-border',
            )}
            title={verInactivas ? 'Desactivar filtro de inactivas' : 'Ver líneas inactivas'}
          >
            <Icon name="cancel" size="xs" />
            <span>Ver Inactivas</span>
          </button>
        </div>
      </div>

      {/* Indicador informativo de Drag & Drop */}
      {!verInactivas && !busqueda.trim() && (
        <div className="py-1.5 px-3 bg-app-surface/90 border border-border/80 rounded-lg shadow-2xs flex items-center justify-between text-[11px] text-text-muted">
          <div className="flex items-center gap-2">
            <Icon name="swap_vert" size="14px" className="text-brand-primary" />
            <span>
              <strong className="text-text-primary">Arrastra cualquier línea hacia arriba o abajo</strong> para definir la prioridad de los listados en planta.
            </span>
          </div>
        </div>
      )}

      {/* Feedback de error */}
      {error && (
        <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2 font-medium">
          <Icon name="error" size="sm" />
          <span>{error}</span>
        </div>
      )}

      {/* Contenido principal: Tablero Dividido BOTA | ACCESORIOS */}
      {isLoading ? (
        <div className="w-full p-12 flex flex-col items-center justify-center gap-3 bg-app-surface rounded-xl border border-border">
          <Spinner size="lg" />
          <p className="text-sm text-text-secondary font-medium">Cargando líneas y maquilas...</p>
        </div>
      ) : (
        <div className="bg-app-surface border border-border rounded-xl shadow-2xs overflow-hidden w-full">
          <div className="overflow-x-auto w-full">
            <div className="w-full grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border items-stretch">
              {/* Lado Izquierdo: BOTA */}
              {renderTableSection('BOTA', 'BOTA', botaLines, 'text-brand-primary')}

              {/* Lado Derecho: ACCESORIOS */}
              {renderTableSection('ACCESORIOS', 'ACCESORIOS', accesoriosLines, 'text-brand-secondary')}
            </div>
          </div>
        </div>
      )}

      {/* Modales */}
      <LineaFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        linea={selectedLineaForEdit}
        departamentos={departamentos}
        onCreate={createLinea}
        onUpdate={updateLinea}
      />

      <LineaDeactivateModal
        isOpen={isDeactivateOpen}
        onClose={() => setIsDeactivateOpen(false)}
        linea={selectedLineaForStatus}
        onConfirm={handleConfirmStatusChange}
      />
    </div>
  );
}

export default LineasPage;
