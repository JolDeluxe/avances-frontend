import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useListados } from '@/features/listados/hooks/use-listados';
import { useLineasProduccion } from '@/features/listados/hooks/use-lineas-produccion';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ListadosPendientesParalelaTable } from '@/features/listados/components/listados-pendientes-paralela-table';
import { clasificarListadosPorArea } from '@/features/listados/utils/classify-listados';

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
 * Módulo Independiente: MONITOR DE LISTADOS PENDIENTES
 *
 * Propósito:
 * - Tablero en vivo optimizado para proyección en pantallas de planta y almacén.
 * - Muestra la totalidad de listados pendientes en paralelo (BOTA y ACCESORIOS) sin ruido visual.
 * - Desaparecen de la vista únicamente cuando TODOS sus frentes (DIR, IND y BOL según aplique)
 *   hayan sido entregados a producción.
 * - Sin botones de interacción, sin checkboxes, sin menús contextuales.
 * - Refresco automático silencioso cada 20 segundos.
 * - Modo Pantalla Completa nativo que maximiza únicamente los indicadores y el tablero.
 */
export function MonitorPendientesPage(): ReactNode {
  const { hasPermission } = usePermissions();
  const canVer = hasPermission('listado:ver');

  // Consulta todos los listados en estado PENDIENTE o EN_PROCESO con límite amplio
  const {
    items,
    isLoading,
    error,
    reloadListados,
  } = useListados({
    fixedEstado: 'PENDIENTE,EN_PROCESO',
    customLimit: 1000,
  });

  const { todasLasLineas } = useLineasProduccion();

  // ─── Refresco de Respaldo Silencioso (fallback periódico cada 2 minutos) ──────
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    // Los eventos en tiempo real (SSE) actualizan el tablero inmediatamente.
    // Mantenemos un fallback espaciado a 120s únicamente como reaseguro de red de largo plazo.
    const interval = setInterval(async () => {
      setIsRefreshing(true);
      await reloadListados();
      setUltimaActualizacion(new Date());
      setIsRefreshing(false);
    }, 120000); // 2 minutos

    return () => clearInterval(interval);
  }, [reloadListados]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await reloadListados();
    setUltimaActualizacion(new Date());
    setIsRefreshing(false);
  };

  // ─── Modo Pantalla Completa (Full Screen API) ──────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Si la API del navegador no está disponible o es bloqueada
    }
  };

  // ─── Regla del Monitor: Mostrar solo listados que aún tengan frentes por entregar ──
  // Un listado desaparece únicamente cuando TODOS sus frentes operativos
  // (DIR, IND y BOL según aplique) han llegado al menos a estado ENTREGADO o DESCONTADO.
  const itemsPendientesCompletos = useMemo(() => {
    return items.filter((item) => {
      if (item.estado === 'CANCELADO' || item.estado === 'ENTREGADO_A_PRODUCCION' || item.estado === 'DESCONTADO') {
        return false;
      }
      const frentes = item.frentes ?? [];
      if (frentes.length === 0) {
        return item.estado === 'PENDIENTE' || item.estado === 'EN_PROCESO';
      }
      // Permanece si AL MENOS UNO de sus frentes está en PENDIENTE o SEPARADO
      return frentes.some((f) => f.estado === 'PENDIENTE' || f.estado === 'SEPARADO');
    });
  }, [items]);

  // Clasificación dinámica en BOTA y ACCESORIOS
  const { botaItems, accesoriosItems, noClasificados } = useMemo(() => {
    return clasificarListadosPorArea(itemsPendientesCompletos, todasLasLineas);
  }, [itemsPendientesCompletos, todasLasLineas]);

  // ─── Acceso denegado ───────────────────────────────────────────────────────
  if (!canVer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
          <Icon name="lock" size="lg" className="text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Acceso restringido</h2>
        <p className="text-sm text-text-secondary max-w-sm">
          No tienes permiso para ver el monitor de listados.
        </p>
      </div>
    );
  }

  const horaStr = ultimaActualizacion.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      ref={containerRef}
      className={`space-y-3 transition-colors ${
        isFullscreen
          ? 'p-4 sm:p-6 bg-app-surface min-h-screen overflow-y-auto custom-scrollbar'
          : ''
      }`}
    >
      {/* ─── Encabezado del Monitor / Tablero en Vivo ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black font-sans text-text-primary uppercase tracking-tight">
              Listados Pendientes
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              EN VIVO
            </span>
          </div>
          <p className="text-xs text-text-secondary font-lectura mt-0.5">
            Monitor de producción y almacén en tiempo real ({itemsPendientesCompletos.length} listados por completar).
          </p>
        </div>

        {/* Controles de Pantalla Completa y Actualización */}
        <div className="flex items-center gap-2">
          {/* Hora de última sincronización */}
          <span className="text-[11px] font-mono text-text-muted hidden sm:inline-block">
            Sincronizado: {horaStr}
          </span>

          {/* Botón de Refresco Manual */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="h-8 px-2.5 text-xs text-text-secondary hover:text-text-primary gap-1.5"
            title="Actualizar listados ahora"
          >
            <Icon
              name="refresh"
              size="15px"
              className={isRefreshing || isLoading ? 'animate-spin text-brand-primary' : ''}
            />
            <span className="hidden md:inline">Actualizar</span>
          </Button>

          {/* Botón Pantalla Completa */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 px-3 text-xs font-semibold gap-1.5 border-border bg-app-surface hover:bg-app-surface-muted/60 text-text-primary shadow-2xs"
            title={isFullscreen ? 'Salir de pantalla completa (Esc)' : 'Ver en pantalla completa para proyectar'}
          >
            <Icon name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'} size="16px" className="text-brand-primary" />
            <span>{isFullscreen ? 'Salir' : 'Pantalla Completa'}</span>
          </Button>
        </div>
      </div>

      {/* Alerta de no clasificados si existiera */}
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

      {/* ─── Tablero Paralelo sin Interacciones ni Checkboxes ─── */}
      <ListadosPendientesParalelaTable
        botaItems={botaItems}
        accesoriosItems={accesoriosItems}
        formatFecha={formatFecha}
        isLoading={isLoading}
        allowSelection={false}
        hideActions={true}
        emptyMessage="Todos los listados de producción han sido completados y entregados."
      />
    </div>
  );
}
