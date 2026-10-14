import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useListados } from '@/features/listados/hooks/use-listados';
import { useLineasProduccion } from '@/features/listados/hooks/use-lineas-produccion';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ListadosPendientesParalelaTable } from '@/features/listados/components/listados-pendientes-paralela-table';
import { clasificarListadosPorArea } from '@/features/listados/utils/classify-listados';
import { useListadosStreamListener } from '@/features/listados/context/listados-stream-context';
import type { ListadoEventoPayload } from '@/features/listados/types/listados-events.types';

/**
 * Formatea una fecha ISO/YYYY-MM-DD → dd/mm/aaaa sin desfase UTC.
 */
function formatFecha(fechaStr: string): string {
  const solo = fechaStr.includes('T') ? fechaStr.slice(0, 10) : fechaStr;
  const [year, month, day] = solo.split('-');
  if (!year || !month || !day) return fechaStr;
  return `${day}/${month}/${year}`;
}

/**
 * Módulo de PROYECCIÓN: Pantalla de LISTADOS PENDIENTES
 *
 * Características:
 * 1. Optimizado para pantallas de planta y proyectores con botón de "Proyectar" (Pantalla Completa nativa).
 * 2. Título exacto y limpio: "LISTADOS PENDIENTES" (sin etiqueta de "En Vivo").
 * 3. Reloj digital en vivo con fecha y hora actual en tiempo real (segundo a segundo).
 * 4. Desaparición estricta: Los listados permanecen en la pantalla hasta que DIR, IND y BOL (si aplica)
 *    estén COMPLETOS (al menos ENTREGADO o DESCONTADO).
 * 5. Reacción en tiempo real (SSE) con parpadeo reactivo:
 *    - Si un listado avanza (frente separado, entregado o descontado), la fila parpadea visualmente
 *      según la acción efectuada.
 *    - No requiere recargas cada 5 segundos ni polling continuo.
 */
export function ProyeccionPendientesPage(): ReactNode {
  const { hasPermission } = usePermissions();
  const canVer = hasPermission('listado:ver');

  // Consulta los listados con la misma cobertura global que /listados/pendientes
  const {
    items,
    isLoading,
    error,
  } = useListados({
    fixedEstado: 'PENDIENTE,EN_PROCESO,SEPARADO,ENTREGADO_A_PRODUCCION',
    modoGlobal: true,
    customLimit: 1000,
  });

  const { todasLasLineas } = useLineasProduccion();

  // ─── Reloj Digital en Vivo (actualización cada segundo) ─────────────────────
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateString = currentTime.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // ─── IDs con animación de parpadeo reactivo ante eventos en tiempo real ────
  const [highlightedIds, setHighlightedIds] = useState<number[]>([]);
  const [entregandoIds, setEntregandoIds] = useState<number[]>([]);
  const [descontandoIds, setDescontandoIds] = useState<number[]>([]);

  // Escuchar eventos SSE de Listados para activar el parpadeo
  useListadosStreamListener((evento: ListadoEventoPayload) => {
    const id = evento.listadoId;
    if (!id) return;

    if (evento.tipo === 'FRENTE_ENTREGADO') {
      setEntregandoIds((prev) => [...prev, id]);
      setTimeout(() => {
        setEntregandoIds((prev) => prev.filter((item) => item !== id));
      }, 2500);
    } else if (evento.tipo === 'FRENTE_DESCONTADO') {
      setDescontandoIds((prev) => [...prev, id]);
      setTimeout(() => {
        setDescontandoIds((prev) => prev.filter((item) => item !== id));
      }, 2500);
    } else {
      // LISTADO_CREADO, FRENTE_SEPARADO, FRENTE_RETROCEDIDO, etc.
      setHighlightedIds((prev) => [...prev, id]);
      setTimeout(() => {
        setHighlightedIds((prev) => prev.filter((item) => item !== id));
      }, 3500);
    }
  });

  // ─── Modo Proyección / Pantalla Completa ───────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [isProyectando, setIsProyectando] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsProyectando(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleProyeccion = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Bloqueo de API o no soportado por navegador
    }
  };

  // ─── Regla de Pendientes: Idéntica a /listados/pendientes ────────────────────
  // Desaparecen únicamente cuando TODOS sus frentes operativos (DIR, IND y BOL según aplique)
  // han sido completados (en DESCONTADO). Mientras falte alguno, permanece visible.
  const itemsPendientesCompletos = useMemo(() => {
    return items.filter((item) => {
      const isCurrentlyDescontando = descontandoIds.includes(item.id);
      const isCurrentlyEntregando = entregandoIds.includes(item.id);

      if (isCurrentlyDescontando || isCurrentlyEntregando) {
        return true;
      }

      if ((item.estado as string) === 'CANCELADO' || (item.estado as string) === 'DESCONTADO') {
        return false;
      }
      if (item.frentes && item.frentes.length > 0) {
        // Permanece mientras exista al menos un frente que NO esté DESCONTADO
        return item.frentes.some((f) => f.estado !== 'DESCONTADO');
      }
      return (item.estado as string) !== 'DESCONTADO' && (item.estado as string) !== 'CANCELADO';
    });
  }, [items, descontandoIds, entregandoIds]);

  // Clasificación dinámica en BOTA y ACCESORIOS
  const { botaItems, accesoriosItems, noClasificados } = useMemo(() => {
    return clasificarListadosPorArea(itemsPendientesCompletos, todasLasLineas);
  }, [itemsPendientesCompletos, todasLasLineas]);

  if (!canVer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
          <Icon name="lock" size="lg" className="text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Acceso restringido</h2>
        <p className="text-sm text-text-secondary max-w-sm">
          No tienes permiso para ver la proyección de listados.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`space-y-3 transition-colors ${
        isProyectando
          ? 'p-4 sm:p-6 bg-app-surface min-h-screen overflow-y-auto custom-scrollbar select-none'
          : ''
      }`}
    >
      {/* ─── Encabezado Compacto de la Pantalla de Proyección con Reloj ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-app-surface border border-border rounded-lg px-3 py-2 shadow-2xs">
        <div className="flex items-center gap-2">
          <h1 className="text-sm sm:text-base font-bold font-sans text-text-primary uppercase tracking-tight">
            LISTADOS PENDIENTES
          </h1>
          <span className="text-xs font-mono font-bold bg-cuadra-arena/80 text-text-primary px-2 py-0.5 rounded border border-border/80">
            {itemsPendientesCompletos.length}
          </span>
        </div>

        {/* Reloj Digital Discreto y Botón de Pantalla Completa */}
        <div className="flex items-center gap-3">
          {/* Reloj */}
          <div className="flex flex-col items-end text-right leading-tight">
            <span className="text-xs sm:text-sm font-bold font-mono text-text-primary tracking-wide">
              {timeString}
            </span>
            <span className="text-[10px] text-text-muted capitalize">
              {dateString}
            </span>
          </div>

          {/* Botón de Recarga / Sincronización */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((regs) => {
                  regs.forEach((r) => void r.update());
                });
              }
              window.location.reload();
            }}
            className="h-8 w-8 p-0 border-border bg-app-surface hover:bg-app-surface-muted/60 text-text-primary shadow-2xs group"
            title="Recargar datos y comprobar versión"
          >
            <Icon
              name="refresh"
              size="18px"
              className="text-text-secondary group-hover:text-text-primary group-hover:rotate-180 transition-transform duration-500"
            />
          </Button>

          {/* Botón de Pantalla Completa (solo icono) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleProyeccion}
            className="h-8 w-8 p-0 border-border bg-app-surface hover:bg-app-surface-muted/60 text-text-primary shadow-2xs"
            title={isProyectando ? 'Salir de pantalla completa (Esc)' : 'Maximizar a pantalla completa'}
          >
            <Icon
              name={isProyectando ? 'fullscreen_exit' : 'fullscreen'}
              size="18px"
              className="text-text-secondary hover:text-text-primary"
            />
          </Button>
        </div>
      </div>

      {/* Alerta de no clasificados si correspondiera */}
      {noClasificados.length > 0 && !isLoading && (
        <div className="p-2.5 bg-warning-subtle border border-warning/30 rounded-xl text-xs text-warning-text flex items-center gap-2">
          <Icon name="warning" size="xs" className="shrink-0" />
          <span>
            {noClasificados.length} listado(s) tienen línea sin área asignada ({noClasificados.map((i) => i.lineaProduccion.codigo).join(', ')}).
          </span>
        </div>
      )}

      {/* Error de conexión */}
      {error && !isLoading && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger font-medium flex items-center gap-2">
          <Icon name="error" size="xs" />
          {error}
        </div>
      )}

      {/* ─── Tablero Paralelo (BOTA | ACCESORIOS) con Parpadeos Reactivos ─── */}
      <ListadosPendientesParalelaTable
        botaItems={botaItems}
        accesoriosItems={accesoriosItems}
        formatFecha={formatFecha}
        isLoading={isLoading}
        allowSelection={false}
        hideActions={true}
        highlightedListadoId={highlightedIds}
        entregandoListadoId={entregandoIds}
        descontandoListadoId={descontandoIds}
        emptyMessage="Todos los listados de producción han sido completados y entregados."
      />
    </div>
  );
}
