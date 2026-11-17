import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useVales } from '@/features/vales/hooks/use-vales';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { ValesPendientesParalelaTable } from '@/features/vales/components/vales-pendientes-paralela-table';
import { classifyVales } from '@/features/vales/utils/classify-vales';
import { useValesStreamListener } from '@/features/vales/context/vales-stream-context';
import type { ValeEventoPayload } from '@/features/vales/types/vales-events.types';

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
 * Módulo de PROYECCIÓN: Pantalla de VALES PENDIENTES
 *
 * Sigue la arquitectura y diseño exacto de ProyeccionPendientesPage (Listados).
 */
export function ProyeccionValesPendientesPage(): ReactNode {
  const { hasPermission } = usePermissions();
  const canVer = hasPermission('vale:ver');

  const {
    items,
    isLoading,
    error,
  } = useVales({
    scopeView: 'general',
    fixedEstado: 'PENDIENTE,SEPARADO,ENTREGADO',
    customLimit: 500,
  });

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

  useValesStreamListener((evento: ValeEventoPayload) => {
    const id = evento.valeId;
    if (!id) return;

    if (evento.tipo === 'VALE_ENTREGADO' || evento.tipo === 'VALE_SEPARADO_Y_ENTREGADO') {
      setEntregandoIds((prev) => [...prev, id]);
      setTimeout(() => {
        setEntregandoIds((prev) => prev.filter((item) => item !== id));
      }, 2500);
    } else if (evento.tipo === 'VALE_DESCONTADO') {
      setDescontandoIds((prev) => [...prev, id]);
      setTimeout(() => {
        setDescontandoIds((prev) => prev.filter((item) => item !== id));
      }, 2500);
    } else {
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

  // Mantener visibles los vales que aún no están descontados ni cancelados
  const itemsPendientes = useMemo(() => {
    return items.filter((item) => {
      if (descontandoIds.includes(item.id) || entregandoIds.includes(item.id)) {
        return true;
      }
      return item.estado !== 'CANCELADO' && item.estado !== 'DESCONTADO';
    });
  }, [items, descontandoIds, entregandoIds]);

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
          No tienes permiso para ver la proyección de vales.
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
            VALES PENDIENTES
          </h1>
          <span className="text-xs font-mono font-bold bg-cuadra-arena/80 text-text-primary px-2 py-0.5 rounded border border-border/80">
            {itemsPendientes.length}
          </span>
        </div>

        {/* Reloj Digital Discreto y Botón de Pantalla Completa */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end text-right leading-tight">
            <span className="text-xs sm:text-sm font-bold font-mono text-text-primary tracking-wide">
              {timeString}
            </span>
            <span className="text-[10px] text-text-muted capitalize">{dateString}</span>
          </div>

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

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleProyeccion}
            className="h-8 w-8 p-0 border-border bg-app-surface hover:bg-app-surface-muted/60 text-text-primary shadow-2xs"
            title={
              isProyectando
                ? 'Salir de pantalla completa (Esc)'
                : 'Maximizar a pantalla completa'
            }
          >
            <Icon
              name={isProyectando ? 'fullscreen_exit' : 'fullscreen'}
              size="18px"
              className="text-text-secondary hover:text-text-primary"
            />
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

      {/* ─── Tablero Paralelo (BOTA | ACCESORIOS) con Parpadeos Reactivos ─── */}
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
        emptyMessage="Todos los vales han sido completados y descontados."
      />
    </div>
  );
}
