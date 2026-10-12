import { LoginForm, type LoginFormProps } from '../components/login-form';

export interface LoginMobileProps extends LoginFormProps {
  bgImage: string;
}

export function LoginMobile({ bgImage, ...formProps }: LoginMobileProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen relative bg-cover bg-center bg-no-repeat p-4 transition-all duration-300"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Overlay oscuro */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" aria-hidden="true" />

      {/* Tarjeta de Login móvil */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-slate-800 z-10 border border-white/20">
        <div className="flex justify-center mb-6">
          <img
            src="/img/01_Cuadra.webp"
            alt="Logo Cuadra"
            className="w-60 h-auto object-contain"
          />
        </div>

        <LoginForm {...formProps} />
      </div>
    </div>
  );
}
