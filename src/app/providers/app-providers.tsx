import type { ReactNode } from 'react';
import { AuthProvider } from './auth-provider';
import { ListadosStreamProvider } from '@/features/listados/context/listados-stream-context';

/**
 * Ensamble jerárquico de todos los proveedores de contexto globales (SKILL.md §8).
 * Centraliza los providers en un único punto ordenado y evita el anidamiento excesivo en app.tsx.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ListadosStreamProvider>
        {children}
      </ListadosStreamProvider>
    </AuthProvider>
  );
}
