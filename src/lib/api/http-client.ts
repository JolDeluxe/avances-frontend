/**
 * Cliente HTTP centralizado (SKILL.md §18-19).
 *
 * Configura la URL base, inyección de credenciales seguras (cookies HttpOnly),
 * serialización JSON, inyección de tokens de autorización, refresco coordinado
 * ante 401 (sin tormentas de peticiones ni bucles) y distinción estricta entre 401 y 403.
 */

import { env } from '@/config/env';

/** Respuesta estándar de la API del backend. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
}

/** Respuesta de error de la API del backend. */
export interface ApiErrorResponse {
  success?: boolean;
  message: string;
  errors?: unknown;
  statusCode?: number;
}

/** Error tipado para distinguir errores de API de errores de red. */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly body: ApiErrorResponse;

  constructor(statusCode: number, body: ApiErrorResponse) {
    super(body.message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

// Opciones extendidas de petición para control interno de reintentos y query params
export interface CustomRequestInit extends RequestInit {
  _isRetry?: boolean;
  params?: Record<string, unknown>;
}

// Almacenamiento seguro en memoria del token de acceso activo
let inMemoryAccessToken: string | null = null;

export const authState = {
  getAccessToken: (): string | null => inMemoryAccessToken,
  setAccessToken: (token: string | null): void => {
    inMemoryAccessToken = token;
  },
};

// Promesa compartida para coordinar refrescos concurrentes y evitar "refresh storms"
let activeRefreshPromise: Promise<string | null> | null = null;

/**
 * Ejecuta el refresco de token llamando al endpoint /auth/refresh con cookie HttpOnly.
 * Si ya hay un refresco en curso, todas las llamadas concurrentes reutilizan la misma promesa.
 */
async function performTokenRefresh(): Promise<string | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const url = `${env.API_BASE_URL}/auth/refresh`;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        authState.setAccessToken(null);
        return null;
      }

      const payload = (await response.json()) as ApiResponse<{
        accessToken: string;
        usuario?: unknown;
      }>;

      const newToken = payload.data?.accessToken ?? null;
      authState.setAccessToken(newToken);

      if (newToken) {
        window.dispatchEvent(
          new CustomEvent('auth:token-refreshed', {
            detail: { token: newToken, user: payload.data?.usuario },
          }),
        );
      }

      return newToken;
    } catch {
      authState.setAccessToken(null);
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

/**
 * Realiza una petición HTTP contra la API del backend.
 * Incluye credenciales (cookies HttpOnly) e inyecta Bearer token si existe.
 */
async function request<T>(
  path: string,
  options: CustomRequestInit = {},
): Promise<T> {
  let url = `${env.API_BASE_URL}${path}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Inyección automática de token de acceso si existe y no fue provisto manualmente
  const token = authState.getAccessToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    credentials: 'include', // Imprescindible para cookies HttpOnly (mp_session)
    ...options,
    headers,
  });

  // =========================================================================
  // TRATAMIENTO ESTRICTO DE ERRORES DE AUTENTICACIÓN Y AUTORIZACIÓN (SKILL.md §18, §23)
  // =========================================================================

  // Caso 1: 401 Unauthorized (Sesión inválida o token expirado)
  if (response.status === 401) {
    const isAuthEndpoint = path.startsWith('/auth/login') || path.startsWith('/auth/refresh');

    // Si el fallo ocurre en login/refresh o la petición ya era un reintento: la sesión feneció definitivamente
    if (isAuthEndpoint || options._isRetry) {
      if (!path.startsWith('/auth/login')) {
        authState.setAccessToken(null);
        window.dispatchEvent(
          new CustomEvent('auth:session-expired', { detail: { status: 401 } }),
        );
      }

      const errorBody = (await response.json().catch(() => ({
        message: `Error 401: No autorizado`,
      }))) as ApiErrorResponse;
      throw new ApiError(401, errorBody);
    }

    // Si es un endpoint protegido ordinario y no ha sido reintentado: intentar refresh transparente
    const newToken = await performTokenRefresh();

    if (newToken) {
      // Reintentar la petición original UNA sola vez con el nuevo token
      return request<T>(path, {
        ...options,
        _isRetry: true,
        headers: {
          ...headers,
          Authorization: `Bearer ${newToken}`,
        },
      });
    }

    // Si el refresh falló (cookie expirada/revocada en MySQL): notificar expiración y expulsar limpiamente
    authState.setAccessToken(null);
    window.dispatchEvent(
      new CustomEvent('auth:session-expired', { detail: { status: 401 } }),
    );

    const errorBody = (await response.json().catch(() => ({
      message: `Error 401: Sesión expirada`,
    }))) as ApiErrorResponse;
    throw new ApiError(401, errorBody);
  }

  // Caso 2: 403 Forbidden (Usuario autenticado pero sin permiso)
  // CRÍTICO: Un 403 NUNCA debe disparar 'auth:session-expired' ni cerrar sesión.
  if (response.status === 403) {
    const errorBody = (await response.json().catch(() => ({
      message: `Error 403: Acceso denegado`,
    }))) as ApiErrorResponse;
    throw new ApiError(403, errorBody);
  }

  // Otros errores HTTP (400, 404, 500, etc.)
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({
      message: `Error ${response.status}: ${response.statusText}`,
    }))) as ApiErrorResponse;
    throw new ApiError(response.status, errorBody);
  }

  // Respuestas sin cuerpo (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/** Métodos de conveniencia del cliente HTTP. */
export const httpClient = {
  get: <T>(path: string, options?: CustomRequestInit) =>
    request<T>(path, { method: 'GET', ...options }),

  post: <T>(path: string, body?: unknown, options?: CustomRequestInit) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  put: <T>(path: string, body?: unknown, options?: CustomRequestInit) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  patch: <T>(path: string, body?: unknown, options?: CustomRequestInit) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...options,
    }),

  delete: <T>(path: string, options?: CustomRequestInit) =>
    request<T>(path, { method: 'DELETE', ...options }),
};
