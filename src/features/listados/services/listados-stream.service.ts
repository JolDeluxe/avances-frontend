import { env } from '@/config/env';
import { authState } from '@/lib/api/http-client';
import type { ListadoEventoPayload, ListadoStreamEventListener } from '../types/listados-events.types';

/**
 * Opciones para la suscripción al stream de Listados.
 */
export interface ListadosStreamOptions {
  onEvent: ListadoStreamEventListener;
  onError?: (error: Error) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

/**
 * Cliente de streaming SSE con autenticación Bearer via fetch (ReadableStream).
 *
 * Ventajas:
 * 1. Envía el token de autenticación en el encabezado `Authorization: Bearer <token>`, evitando exponer tokens en URLs.
 * 2. Reconexión automática exponencial ante caídas transitorias de red (backoff entre 1.5s y 15s).
 * 3. Se sincroniza con el evento 'auth:token-refreshed' para reconectar inmediatamente con el token fresco.
 * 4. Parsea eventos estándar de SSE (`event: ...`, `data: ...`).
 */
export class ListadosStreamClient {
  private abortController: AbortController | null = null;
  private isExplicitlyClosed = false;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1500;
  private readonly maxReconnectDelay = 15000;
  private readonly listeners = new Set<ListadoStreamEventListener>();
  private readonly statusListeners = new Set<(status: 'connecting' | 'connected' | 'disconnected') => void>();
  private currentStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';

  constructor() {
    this.handleTokenRefreshed = this.handleTokenRefreshed.bind(this);
  }

  public get status(): 'connecting' | 'connected' | 'disconnected' {
    return this.currentStatus;
  }

  private setStatus(newStatus: 'connecting' | 'connected' | 'disconnected') {
    if (this.currentStatus !== newStatus) {
      this.currentStatus = newStatus;
      for (const listener of this.statusListeners) {
        try {
          listener(newStatus);
        } catch (e) {
          console.error('[ListadosStream] Error en status listener:', e);
        }
      }
    }
  }

  /**
   * Suscribe un callback a los eventos recibidos.
   */
  public addEventListener(listener: ListadoStreamEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Suscribe un listener a cambios en el estado de conexión.
   */
  public addStatusListener(listener: (status: 'connecting' | 'connected' | 'disconnected') => void): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Inicia la conexión continua de SSE.
   */
  public connect(): void {
    this.isExplicitlyClosed = false;
    window.addEventListener('auth:token-refreshed', this.handleTokenRefreshed);

    if (this.currentStatus === 'connected' || this.currentStatus === 'connecting') {
      return;
    }

    this.startStreaming();
  }

  /**
   * Detiene la conexión y limpia recursos.
   */
  public disconnect(): void {
    this.isExplicitlyClosed = true;
    window.removeEventListener('auth:token-refreshed', this.handleTokenRefreshed);

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.setStatus('disconnected');
  }

  private handleTokenRefreshed(): void {
    if (this.isExplicitlyClosed) return;
    // Si el token se renovó y estábamos en error o desconectados, reconectar de inmediato.
    // Si estábamos conectados, el stream existente suele seguir vivo hasta que el backend envíe permisos_obsoletos o cierre.
    if (this.currentStatus === 'disconnected') {
      this.reconnectDelay = 1500;
      this.startStreaming();
    }
  }

  private async startStreaming(): Promise<void> {
    if (this.isExplicitlyClosed) return;

    const token = authState.getAccessToken();
    if (!token) {
      // Sin token en memoria, no podemos autenticar el stream
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('connecting');

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const streamUrl = `${env.API_BASE_URL}/listados/stream`;

    try {
      const response = await fetch(streamUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expirado o inválido; esperar evento auth:token-refreshed o reintentar
          this.setStatus('disconnected');
          this.scheduleReconnect(3000);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('La respuesta HTTP no contiene un body legible (ReadableStream no disponible)');
      }

      this.setStatus('connected');
      this.reconnectDelay = 1500; // Reset backoff

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Mantener la última línea incompleta en el buffer
        buffer = lines.pop() ?? '';

        let currentEvent = 'message';
        let currentData = '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed) {
            // Línea en blanco -> delimitador de evento SSE
            if (currentData) {
              this.dispatchSSE(currentEvent, currentData);
              currentEvent = 'message';
              currentData = '';
            }
            continue;
          }

          if (trimmed.startsWith(':')) {
            // Comentario SSE (ej. : ping) -> ignorar
            continue;
          }

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const dataPart = trimmed.slice(5).trim();
            currentData = currentData ? `${currentData}\n${dataPart}` : dataPart;
          }
        }
      }
    } catch (err: unknown) {
      if (signal.aborted || this.isExplicitlyClosed) {
        return;
      }
      console.warn('[ListadosStream] Desconexión o error en stream SSE:', err);
    } finally {
      if (!this.isExplicitlyClosed) {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      }
    }
  }

  private dispatchSSE(eventType: string, rawData: string): void {
    if (eventType === 'conectado') {
      return;
    }

    if (eventType === 'permisos_obsoletos') {
      // Backend notifica que los permisos del usuario cambiaron
      window.dispatchEvent(new CustomEvent('auth:session-expired', { detail: { reason: 'permisos_actualizados' } }));
      this.disconnect();
      return;
    }

    try {
      const payload = JSON.parse(rawData) as ListadoEventoPayload;
      for (const listener of this.listeners) {
        try {
          listener(payload);
        } catch (listenerError) {
          console.error('[ListadosStream] Error en listener al procesar evento:', listenerError);
        }
      }
    } catch (jsonErr) {
      console.error('[ListadosStream] Fallo al parsear payload JSON de SSE:', jsonErr, rawData);
    }
  }

  private scheduleReconnect(explicitDelay?: number): void {
    if (this.isExplicitlyClosed) return;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    const delay = explicitDelay ?? this.reconnectDelay;
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      if (!this.isExplicitlyClosed) {
        this.startStreaming();
      }
    }, delay);

    // Incrementar backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
  }
}

// Instancia singleton compartida en toda la aplicación
export const listadosStreamClient = new ListadosStreamClient();
