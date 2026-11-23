import { useState, useEffect, useCallback, useRef } from 'react';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { listadosApi } from '@/features/listados/api/listados-api';
import { valesApi } from '@/features/vales/api/vales-api';
import { useListadosStreamListener } from '@/features/listados/context/listados-stream-context';
import { useValesStreamListener } from '@/features/vales/context/vales-stream-context';
import type { ListadoEventoPayload } from '@/features/listados/types/listados-events.types';
import type { ValeEventoPayload } from '@/features/vales/types/vales-events.types';

/**
 * Hook de contadores de auditoría en tiempo real para el layout.
 *
 * Características normativas:
 * 1. Consulta los endpoints ligeros del backend (listados/auditoria/count y vales/auditoria/count).
 * 2. Si el usuario no tiene permisos de descuento, retorna 0 inmediatamente sin llamadas innecesarias.
 * 3. En caso de error de red o servidor, preserva el último estado conocido (stale) en lugar de convertir a 0.
 * 4. Suscrito a eventos SSE de Listados y Vales: ante cualquier cambio relevante ejecuta una reconsulta debounced (250ms)
 *    hacia el backend. NUNCA realiza decrementos o incrementos manuales en memoria.
 * 5. Revalida periódicamente (cada 60s) y al recuperar el foco de ventana o conexión a internet.
 */
export function useAuditorCounts() {
  const { user, hasPermission } = usePermissions();

  const canDescontarListados = hasPermission('listado:descontar');
  const canDescontarVales = hasPermission('vale:descontar');

  const [listadosCount, setListadosCount] = useState<number | null>(null);
  const [valesCount, setValesCount] = useState<number | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!canDescontarListados) {
      setListadosCount(0);
    } else {
      try {
        const c = await listadosApi.getAuditoriaCount();
        setListadosCount(c);
      } catch (err) {
        console.error('Error al obtener conteo de auditoría de listados:', err);
      }
    }

    if (!canDescontarVales) {
      setValesCount(0);
    } else {
      try {
        const c = await valesApi.getAuditoriaCount();
        setValesCount(c);
      } catch (err) {
        console.error('Error al obtener conteo de auditoría de vales:', err);
      }
    }
  }, [canDescontarListados, canDescontarVales]);

  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void fetchCounts();
    }, 250);
  }, [fetchCounts]);

  // Carga inicial y ciclo de vida de sesión
  useEffect(() => {
    if (!user) {
      setListadosCount(0);
      setValesCount(0);
      return;
    }

    void fetchCounts();

    const interval = setInterval(() => {
      void fetchCounts();
    }, 60000);

    const handleFocus = () => {
      void fetchCounts();
    };

    const handleOnline = () => {
      void fetchCounts();
    };

    const handleTokenRefreshed = () => {
      void fetchCounts();
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('auth:token-refreshed', handleTokenRefreshed);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [user, fetchCounts]);

  // Escuchar eventos SSE de Listados
  useListadosStreamListener((event: ListadoEventoPayload) => {
    if (!canDescontarListados) return;
    const eventosRelevantes = [
      'FRENTE_ENTREGADO',
      'FRENTE_DESCONTADO',
      'FRENTE_RETROCEDIDO',
      'LISTADO_CANCELADO',
      'LOTE_TRANSICIONADO',
    ];
    if (eventosRelevantes.includes(event.tipo)) {
      debouncedRefresh();
    }
  });

  // Escuchar eventos SSE de Vales
  useValesStreamListener((event: ValeEventoPayload) => {
    if (!canDescontarVales) return;
    const eventosRelevantes = [
      'VALE_ENTREGADO',
      'VALE_DESCONTADO',
      'VALE_RETROCEDIDO',
      'VALE_CANCELADO',
      'VALES_LOTE_OPERADO',
    ];
    if (eventosRelevantes.includes(event.tipo)) {
      debouncedRefresh();
    }
  });

  return {
    listadosAuditoriaCount: listadosCount ?? 0,
    valesAuditoriaCount: valesCount ?? 0,
    refreshAuditorCounts: fetchCounts,
  };
}
