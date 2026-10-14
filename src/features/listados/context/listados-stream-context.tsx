import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import { useAuthSession } from '@/app/providers/auth-provider';
import { listadosStreamClient } from '../services/listados-stream.service';
import type { ListadoEventoPayload, ListadoStreamEventListener } from '../types/listados-events.types';

export interface ListadosStreamContextValue {
  status: 'connecting' | 'connected' | 'disconnected';
  lastEvent: ListadoEventoPayload | null;
}

const ListadosStreamContext = createContext<ListadosStreamContextValue | null>(null);

/**
 * Proveedor global de la conexión SSE de Listados.
 *
 * Mantiene exactamente UNA sola conexión SSE activa mientras el usuario esté autenticado.
 * Si el usuario cierra sesión, desconecta el stream de forma inmediata y limpia recursos.
 */
export function ListadosStreamProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthSession();
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [lastEvent, setLastEvent] = useState<ListadoEventoPayload | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      listadosStreamClient.disconnect();
      return;
    }

    // Suscribir a cambios de estado del cliente SSE
    const unregisterStatus = listadosStreamClient.addStatusListener((newStatus) => {
      setStatus(newStatus);
    });

    // Suscribir para registrar el último evento recibido
    const unregisterEvents = listadosStreamClient.addEventListener((event) => {
      setLastEvent(event);
    });

    // Iniciar conexión
    listadosStreamClient.connect();

    return () => {
      unregisterStatus();
      unregisterEvents();
    };
  }, [isAuthenticated]);

  return (
    <ListadosStreamContext.Provider value={{ status, lastEvent }}>
      {children}
    </ListadosStreamContext.Provider>
  );
}

/**
 * Hook para consultar el estado global de la conexión en tiempo real de listados.
 */
// oxlint-disable-next-line react/only-export-components
export function useListadosStreamStatus(): ListadosStreamContextValue {
  const context = useContext(ListadosStreamContext);
  if (!context) {
    return {
      status: 'disconnected',
      lastEvent: null,
    };
  }
  return context;
}

/**
 * Hook para suscribir un componente a los eventos en tiempo real emitidos por el backend.
 *
 * Se desuscribe automáticamente al desmontar el componente.
 * Utiliza una referencia estable al callback para evitar resuscripciones innecesarias.
 */
// oxlint-disable-next-line react/only-export-components
export function useListadosStreamListener(listener: ListadoStreamEventListener): void {
  const listenerRef = useRef<ListadoStreamEventListener>(listener);

  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  useEffect(() => {
    const handleEvent: ListadoStreamEventListener = (event) => {
      if (listenerRef.current) {
        listenerRef.current(event);
      }
    };

    const unsubscribe = listadosStreamClient.addEventListener(handleEvent);
    return () => {
      unsubscribe();
    };
  }, []);
}
