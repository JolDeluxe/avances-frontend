import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useVales } from '@/features/vales/hooks/use-vales';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ValesPendientesParalelaTable } from '@/features/vales/components/vales-pendientes-paralela-table';
import { classifyVales } from '@/features/vales/utils/classify-vales';

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
 * Módulo Independiente: MONITOR DE VALES PENDIENTES
 *
 * Propósito:
 * - Tablero en vivo optimizado para proyección en pantallas de planta y almacén.
 * - Muestra la totalidad de vales pendientes en paralelo (BOTA y ACCESORIOS) sin ruido visual.
 * - Sin botones de interacción, sin checkboxes, sin menús contextuales.
 * - Modo Pantalla Completa nativo.
 */
export function MonitorValesPendientesPage(): ReactNode {
  const { hasPermission } = usePermissions();
  const canVer = hasPermission('vale:ver');

  const {
    items,
    isLoading,
    error,
    reload,
    highlightedIds,
    entregandoIds,
    descontandoIds,
  } = useVales({
    scopeView: 'general',
    fixedEstado: 'PENDIENTE,SEPARADO,ENTREGADO',
    customLimit: 500,
  });

  // ─── Refresco de Respaldo Silencioso (fallback periódico cada 2 minutos) ──────
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      setIsRefreshing(true);
      await reload(true);
      setUltimaActualizacion(new Date());
      setIsRefreshing(false);
    }, 120000);

    return () => clearInterval(interval);
  }, [reload]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await reload();
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

  // Mostrar vales aún pendientes de entregar o descontar (o en animación de salida)
  const itemsPendientes = useMemo(() => {
    return items.filter((item) => {
      if (descontandoIds.includes(item.id) || entregandoIds.includes(item.id)) {
        return true;
      }
      return item.estado !== 'CANCELADO' && item.estado !== 'DESCONTADO';
    });
  }, [items, descontandoIds, entregandoIds]);

  // Clasificación en BOTA, ACCESORIOS y OTRO
  const { botaItems, accesoriosItems, otroItems } = useMemo(() => {
    return classifyVales(itemsPendientes);
  }, [itemsPendientes]);

  if (!canVer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
          <Icon name="lock" size="lg" className="text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Acceso restringido</h2>
        <p className="text-sm text-text-secondary max-w-sm">
          No tienes permiso para ver el monitor de vales.
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
              Vales Pendientes
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              EN VIVO
            </span>
          </div>
          <p className="text-xs text-text-secondary font-lectura mt-0.5">
            Monitor de producción y almacén en tiempo real ({itemsPendientes.length} vales por
            completar).
          </p>
        </div>

        {/* Controles de Pantalla Completa y Actualización */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-text-muted hidden sm:inline-block">
            Sincronizado: {horaStr}
          </span>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="h-8 px-2.5 text-xs text-text-secondary hover:text-text-primary gap-1.5"
            title="Actualizar vales ahora"
          >
            <Icon
              name="refresh"
              size="15px"
              className={isRefreshing || isLoading ? 'animate-spin text-brand-primary' : ''}
            />
            <span className="hidden md:inline">Actualizar</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 px-3 text-xs font-semibold gap-1.5 border-border bg-app-surface hover:bg-app-surface-muted/60 text-text-primary shadow-2xs"
            title={
              isFullscreen
                ? 'Salir de pantalla completa (Esc)'
                : 'Ver en pantalla completa para proyectar'
            }
          >
            <Icon
              name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              size="16px"
              className="text-brand-primary"
            />
            <span>{isFullscreen ? 'Salir' : 'Pantalla Completa'}</span>
          </Button>
        </div>
      </div>

      {/* Error de conexión */}
      {error && !isLoading && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger font-medium flex items-center gap-2">
          <Icon name="error" size="xs" />
          {error}
        </div>
      )}

      {/* ─── Tablero Paralelo sin Interacciones ni Checkboxes ─── */}
      <ValesPendientesParalelaTable
        botaItems={botaItems}
        accesoriosItems={accesoriosItems}
        otroItems={otroItems}
        formatFecha={formatFecha}
        isLoading={isLoading}
        allowSelection={false}
        hideActions={true}
        highlightedValeId={highlightedIds}
        entregandoValeId={entregandoIds}
        descontandoValeId={descontandoIds}
        emptyMessage="Todos los vales han sido completados."
      />
    </div>
  );
}
