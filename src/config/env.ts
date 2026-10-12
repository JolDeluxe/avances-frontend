/**
 * Validación centralizada de variables de entorno (import.meta.env).
 *
 * MUST (SKILL.md §28): Toda variable de entorno en el frontend es pública
 * y visible en el navegador. Nunca incluir secretos aquí.
 *
 * Falla explícitamente en el arranque si faltan variables críticas (SKILL.md §21).
 */

function requireEnv(key: string): string {
  const value = import.meta.env[key] as string | undefined;
  if (!value) {
    throw new Error(
      `[env] Variable de entorno requerida no encontrada: ${key}. ` +
        `Revisa el archivo .env.local y .env.example.`,
    );
  }
  return value;
}

export const env = {
  /** URL base de la API del backend. Se inyecta en el cliente HTTP. */
  API_BASE_URL: requireEnv('VITE_API_BASE_URL'),

  /** Modo de la aplicación: 'development' | 'production' | 'test' */
  MODE: import.meta.env.MODE as 'development' | 'production' | 'test',

  /** true cuando el build es para producción */
  IS_PRODUCTION: import.meta.env.PROD,
} as const;
