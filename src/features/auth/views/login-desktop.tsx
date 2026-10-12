import { LoginForm, type LoginFormProps } from '../components/login-form';

export interface LoginDesktopProps extends LoginFormProps {
  bgImage: string;
}

export function LoginDesktop({ bgImage, ...formProps }: LoginDesktopProps) {
  return (
    <div
      className="flex items-center justify-center min-h-screen relative bg-cover bg-center bg-no-repeat transition-all duration-100"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Overlay oscuro */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" aria-hidden="true" />

      {/* Tarjeta de Login — estilo Cuadra exacto w-112.5 (~450px) */}
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md p-8 text-slate-800 z-10 mx-4 border border-white/20">
        <div className="flex justify-center mb-8">
          <img
            src="/img/01_Cuadra.webp"
            alt="Logo Cuadra"
            className="w-72 h-auto object-contain"
          />
        </div>

        <LoginForm {...formProps} />
      </div>
    </div>
  );
}
