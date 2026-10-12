import { httpClient, type ApiResponse } from '@/lib/api/http-client';
import type {
  UsersListResponse,
  UserFilters,
  CreateUserInput,
  UpdateUserInput,
  ResetPasswordInput,
  UserCatalogs,
  RevealedPasswordResponse,
  UsuarioItem,
} from '../types/users.types';

export const usersApi = {
  getUsers: async (filters?: UserFilters): Promise<ApiResponse<UsersListResponse>> => {
    return httpClient.get<ApiResponse<UsersListResponse>>('/users', {
      params: filters as Record<string, unknown> | undefined,
    });
  },

  getUserById: async (id: number): Promise<ApiResponse<UsuarioItem>> => {
    return httpClient.get<ApiResponse<UsuarioItem>>(`/users/${id}`);
  },

  createUser: async (input: CreateUserInput): Promise<ApiResponse<UsuarioItem>> => {
    const payload = {
      ...input,
      lineaProduccionIds: input.lineaProduccionIds ?? input.lineasAsignadas,
    };
    return httpClient.post<ApiResponse<UsuarioItem>>('/users', payload);
  },

  updateUser: async (id: number, input: UpdateUserInput): Promise<ApiResponse<UsuarioItem>> => {
    const payload = {
      ...input,
      lineaProduccionIds: input.lineaProduccionIds ?? input.lineasAsignadas,
    };
    return httpClient.put<ApiResponse<UsuarioItem>>(`/users/${id}`, payload);
  },

  deleteUser: async (id: number): Promise<ApiResponse<void>> => {
    return httpClient.delete<ApiResponse<void>>(`/users/${id}`);
  },

  reactivateUser: async (id: number): Promise<ApiResponse<UsuarioItem>> => {
    return httpClient.patch<ApiResponse<UsuarioItem>>(`/users/${id}/reactivate`);
  },

  resetPassword: async (id: number, input: ResetPasswordInput): Promise<ApiResponse<void>> => {
    const payload = {
      newPassword: input.newPassword ?? input.passwordNueva,
    };
    return httpClient.post<ApiResponse<void>>(`/users/${id}/reset-password`, payload);
  },

  getRevealedPassword: async (id: number): Promise<ApiResponse<RevealedPasswordResponse>> => {
    return httpClient.get<ApiResponse<RevealedPasswordResponse>>(`/users/${id}/revealed-password`);
  },

  getCatalogs: async (): Promise<ApiResponse<UserCatalogs>> => {
    return httpClient.get<ApiResponse<UserCatalogs>>('/users/catalogs');
  },
};
