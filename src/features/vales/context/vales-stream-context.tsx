import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import { useAuthSession } from '@/app/providers/auth-provider';
import { PERMISOS } from '@/config/permissions';
import { usePermissions } from '@/shared/hooks/use-permissions';
import { valesStreamClient } from '../services/vales-stream.service';
import type { ValeEventoPayload, ValeStreamEventListener } from '../types/vales-events.types';

export interface ValesStreamContextValue {
  status: 'connecting' | 'connected' | 'disconnected';
  isConnected: boolean;
  lastEvent: ValeEventoPayload | null;
}

const ValesStreamContext = createContext<ValesStreamContextValue | null>(null);

/**
 * Proveedor global de la conexión SSE de Vales.
 *
 * Mantiene una sola conexión SSE activa mientras el usuario esté autenticado
 * y cuente con el permiso efectivo `vale:ver`.
 */
export function ValesStreamProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthSession();
  const { can } = usePermissions();
  const canVerVales = can(PERMISOS.VALE_VER);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastEvent, setLastEvent] = useState<ValeEventoPayload | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !canVerVales) {
      valesStreamClient.disconnect();
      return;
    }

    const unregisterStatus = valesStreamClient.addStatusListener((newStatus) => {
      setStatus(newStatus);
    });

    const unregisterEvents = valesStreamClient.addEventListener((event) => {
      setLastEvent(event);
    });

    valesStreamClient.connect();

    return () => {
      unregisterStatus();
      unregisterEvents();
    };
  }, [isAuthenticated, canVerVales]);

  return (
    <ValesStreamContext.Provider value={{ status, isConnected: status === 'connected', lastEvent }}>
      {children}
    </ValesStreamContext.Provider>
  );
}

/**
 * Hook para consultar el estado global de la conexión en tiempo real de vales.
 */
// oxlint-disable-next-line react/only-export-components
export function useValesStreamStatus(): ValesStreamContextValue {
  const context = useContext(ValesStreamContext);
  if (!context) {
    return {
      status: 'disconnected',
      isConnected: false,
      lastEvent: null,
    };
  }
  return context;
}

/**
 * Hook para suscribir un componente a los eventos en tiempo real de Vales emitidos por el backend.
 */
// oxlint-disable-next-line react/only-export-components
export function useValesStreamListener(listener: ValeStreamEventListener): void {
  const listenerRef = useRef<ValeStreamEventListener>(listener);

  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(() => {
    const handleEvent: ValeStreamEventListener = (event) => {
      if (listenerRef.current) {
        listenerRef.current(event);
      }
    };

    const unsubscribe = valesStreamClient.addEventListener(handleEvent);
    return () => {
      unsubscribe();
    };
  }, []);
}
