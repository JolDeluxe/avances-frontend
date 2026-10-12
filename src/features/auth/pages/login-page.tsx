import { useState } from 'react';
import { useIsDesktop } from '@/shared/hooks/use-media-query';
import { useAuth } from '../hooks/use-auth';
import { LoginDesktop } from '../views/login-desktop';
import { LoginMobile } from '../views/login-mobile';

export function LoginPage() {
  const isDesktop = useIsDesktop();
  const { login, loading, backendError, setBackendError } = useAuth();

  const [bgDesktop] = useState(() => `/loginEscritorio/${Math.floor(Math.random() * 3) + 1}.webp`);
  const [bgMobile] = useState(() => `/loginMovil/${Math.floor(Math.random() * 4) + 1}.webp`);

  const handleSubmit = async (usuario: string, password: string) => {
    await login({ usuario, password });
  };

  const handleClearError = () => {
    setBackendError(null);
  };

  if (isDesktop) {
    return (
      <LoginDesktop
        bgImage={bgDesktop}
        loading={loading}
        backendError={backendError}
        onSubmit={handleSubmit}
        onClearError={handleClearError}
      />
    );
  }

  return (
    <LoginMobile
      bgImage={bgMobile}
      loading={loading}
      backendError={backendError}
      onSubmit={handleSubmit}
      onClearError={handleClearError}
    />
  );
}

export default LoginPage;
