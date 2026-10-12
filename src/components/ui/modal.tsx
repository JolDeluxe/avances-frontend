import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';
import { Button } from './button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export interface ModalHeaderProps {
  title?: string;
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Modal portal con Escape listener y bloqueo de scroll.
 * Renderiza en document.body para evitar problemas de z-index.
 */
export function Modal({ isOpen, onClose, children, className = '' }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'bg-app-surface rounded-lg shadow-2xl relative flex flex-col max-h-[90vh] w-full max-w-2xl border border-border/80 animate-in zoom-in-95 duration-200',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ModalHeader({ title, onClose, className = '', children }: ModalHeaderProps) {
  return (
    <div className={cn('shrink-0 p-6 pb-4 border-b border-border-subtle relative', className)}>
      {children ?? (
        <h2 className="text-xl font-bold text-brand-primary text-center uppercase tracking-wider fuente-titulos">
          {title}
        </h2>
      )}
      {onClose && (
        <div className="absolute top-4 right-4">
          <Button
            variant="ghost"
            size="sm"
            icon="close"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="w-8 h-8 p-0 rounded-full text-text-muted hover:text-text-primary"
          />
        </div>
      )}
    </div>
  );
}

export function ModalBody({ children, className = '' }: ModalBodyProps) {
  return (
    <div className={cn('grow overflow-y-auto overflow-x-hidden p-6 font-lectura text-text-primary', className)}>
      {children}
    </div>
  );
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={cn('shrink-0 flex justify-end gap-3 p-4 px-6 border-t border-border-subtle bg-app-surface-muted/60 rounded-b-lg', className)}>
      {children}
    </div>
  );
}
