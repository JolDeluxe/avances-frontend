import { env } from '@/config/env';
import { authState } from '@/lib/api/http-client';
import type { ValeEventoPayload, ValeStreamEventListener } from '../types/vales-events.types';

/**
 * Opciones para la suscripción al stream de Vales.
 */
export interface ValesStreamOptions {
  onEvent: ValeStreamEventListener;
  onError?: (error: Error) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

/**
 * Cliente de streaming SSE de Vales con autenticación Bearer via fetch (ReadableStream).
 *
 * Características:
 * 1. Envía el token en `Authorization: Bearer <token>`, sin exponer credenciales en query params.
 * 2. Reconexión automática exponencial ante caídas transitorias de red (backoff entre 1.5s y 15s).
 * 3. Sincronización con 'auth:token-refreshed' para reconectar de inmediato con el token actualizado.
 * 4. Ante `event: permisos_obsoletos`, detiene el stream actual y dispara 'auth:permissions-stale'
 *    para que AuthProvider renueve el alcance/permisos en caliente (o cierre sesión si fue revocada).
 */
export class ValesStreamClient {
  private abortController: AbortController | null = null;
  private isExplicitlyClosed = false;
  private isWaitingPermissionRefresh = false;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1500;
  private readonly maxReconnectDelay = 15000;
  private readonly listeners = new Set<ValeStreamEventListener>();
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
          console.error('[ValesStream] Error en status listener:', e);
        }
      }
    }
  }

  /**
   * Suscribe un callback a los eventos recibidos.
   */
  public addEventListener(listener: ValeStreamEventListener): () => void {
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
    this.isWaitingPermissionRefresh = false;
    window.addEventListener('auth:token-refreshed', this.handleTokenRefreshed);

    if (this.currentStatus === 'connected' || this.currentStatus === 'connecting') {
      return;
    }

    void this.startStreaming();
  }

  /**
   * Detiene la conexión y limpia recursos.
   */
  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.isWaitingPermissionRefresh = false;
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
    this.isWaitingPermissionRefresh = false;
    if (this.currentStatus === 'disconnected') {
      this.reconnectDelay = 1500;
      void this.startStreaming();
    }
  }

  private async startStreaming(): Promise<void> {
    if (this.isExplicitlyClosed || this.isWaitingPermissionRefresh) return;

    const token = authState.getAccessToken();
    if (!token) {
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('connecting');

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const streamUrl = `${env.API_BASE_URL}/vales/stream`;

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
          this.setStatus('disconnected');
          this.scheduleReconnect(3000);
          return;
        }
        if (response.status === 403) {
          // Usuario autenticado pero sin permiso vale:ver -> no reintentar en bucle hasta cambio de token
          this.isWaitingPermissionRefresh = true;
          this.setStatus('disconnected');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('La respuesta HTTP no contiene un body legible (ReadableStream no disponible)');
      }

      this.setStatus('connected');
      this.reconnectDelay = 1500;

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = 'message';
        let currentData = '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (!trimmed) {
            if (currentData) {
              this.dispatchSSE(currentEvent, currentData);
              currentEvent = 'message';
              currentData = '';
            }
            continue;
          }

          if (trimmed.startsWith(':')) {
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
      console.warn('[ValesStream] Desconexión o error en stream SSE:', err);
    } finally {
      if (!this.isExplicitlyClosed && !this.isWaitingPermissionRefresh) {
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
      // Pausar reconexiones hasta que AuthProvider refresque el token y alcance del usuario
      this.isWaitingPermissionRefresh = true;
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }
      this.setStatus('disconnected');
      window.dispatchEvent(
        new CustomEvent('auth:permissions-stale', {
          detail: { reason: 'permisos_obsoletos' },
        }),
      );
      return;
    }

    try {
      const payload = JSON.parse(rawData) as ValeEventoPayload;
      for (const listener of this.listeners) {
        try {
          listener(payload);
        } catch (listenerError) {
          console.error('[ValesStream] Error en listener al procesar evento:', listenerError);
        }
      }
    } catch (jsonErr) {
      console.error('[ValesStream] Fallo al parsear payload JSON de SSE:', jsonErr, rawData);
    }
  }

  private scheduleReconnect(explicitDelay?: number): void {
    if (this.isExplicitlyClosed || this.isWaitingPermissionRefresh) return;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    const delay = explicitDelay ?? this.reconnectDelay;
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      if (!this.isExplicitlyClosed && !this.isWaitingPermissionRefresh) {
        void this.startStreaming();
      }
    }, delay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
  }
}

export const valesStreamClient = new ValesStreamClient();
