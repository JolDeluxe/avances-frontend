import { httpClient, type ApiResponse } from '@/lib/api/http-client';
import type { LoginCredentials, LoginResponseData, UsuarioAuth } from '../types/auth.types';

export const authApi = {
  /**
   * Inicia sesión en el backend con usuario y contraseña.
   * El backend devuelve accessToken y establece la cookie HttpOnly 'mp_session'.
   */
  async login(credentials: LoginCredentials): Promise<ApiResponse<LoginResponseData>> {
    return httpClient.post<ApiResponse<LoginResponseData>>('/auth/login', {
      usuario: credentials.usuario,
      password: credentials.password,
    });
  },

  /**
   * Renueva el accessToken utilizando la cookie HttpOnly 'mp_session'.
   */
  async refresh(): Promise<ApiResponse<LoginResponseData>> {
    return httpClient.post<ApiResponse<LoginResponseData>>('/auth/refresh');
  },

  /**
   * Cierra sesión en el backend invalidando la sesión en base de datos
   * y limpiando la cookie HttpOnly.
   */
  async logout(): Promise<ApiResponse<null>> {
    return httpClient.post<ApiResponse<null>>('/auth/logout');
  },

  /**
   * Obtiene los datos del usuario autenticado actual con su Access Token.
   */
  async getMe(): Promise<ApiResponse<UsuarioAuth>> {
    return httpClient.get<ApiResponse<UsuarioAuth>>('/auth/me');
  },

  /**
   * Obtiene la lista pública de usuarios activos para el selector de Login.
   */
  async getUsuariosLogin(): Promise<ApiResponse<{ id: number; nombre: string; usuario: string }[]>> {
    return httpClient.get<ApiResponse<{ id: number; nombre: string; usuario: string }[]>>('/auth/usuarios');
  },
};
