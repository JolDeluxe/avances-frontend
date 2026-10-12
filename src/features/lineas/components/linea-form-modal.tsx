import { useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import type {
  LineaProduccionItem,
  DepartamentoWithLineas,
  CreateLineaInput,
  UpdateLineaInput,
  AreaProduccion,
} from '../types/lineas.types';

export interface LineaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  linea?: LineaProduccionItem | null;
  departamentos: DepartamentoWithLineas[];
  onCreate: (input: CreateLineaInput) => Promise<{ success: boolean; message?: string }>;
  onUpdate: (lineId: number, input: UpdateLineaInput) => Promise<{ success: boolean; message?: string }>;
}

export function LineaFormModal({
  isOpen,
  onClose,
  linea,
  departamentos,
  onCreate,
  onUpdate,
}: LineaFormModalProps): ReactNode {
  const isEditing = Boolean(linea);

  const [nombre, setNombre] = useState<string>('');
  const [departamentoId, setDepartamentoId] = useState<number>(0);
  const [area, setArea] = useState<AreaProduccion>('BOTA');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (linea) {
        setNombre(linea.nombre.toUpperCase());
        setDepartamentoId(linea.departamentoId);
        setArea(linea.area);
      } else {
        setNombre('');
        const defaultDepto = departamentos.find((d) => d.estado === 'ACTIVO') || departamentos[0];
        setDepartamentoId(defaultDepto?.id || 0);
        setArea('BOTA');
      }
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, linea, departamentos]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanNombre = nombre.trim().toUpperCase();

    if (!cleanNombre || cleanNombre.length < 2) {
      setError('El nombre de la línea debe tener al menos 2 caracteres.');
      return;
    }

    if (!isEditing && (!departamentoId || departamentoId <= 0)) {
      setError('Debe seleccionar un departamento válido.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && linea) {
        const updatePayload: UpdateLineaInput = {
          nombre: cleanNombre,
          area,
        };
        const res = await onUpdate(linea.id, updatePayload);
        if (res.success) {
          onClose();
        } else {
          setError(res.message || 'Error al actualizar la línea de producción.');
        }
      } else {
        // Auto-generación limpia y silenciosa del identificador único
        const autoCodigo = cleanNombre
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 30);

        const createPayload: CreateLineaInput = {
          codigo: autoCodigo,
          nombre: cleanNombre,
          departamentoId,
          area,
        };
        const res = await onCreate(createPayload);
        if (res.success) {
          onClose();
        } else {
          setError(res.message || 'Error al crear la línea de producción.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al guardar la línea.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <ModalHeader
        title={isEditing ? 'Editar Línea / Maquila' : 'Nueva Línea / Maquila'}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <ModalBody className="space-y-4">
          <p className="text-xs text-text-secondary -mt-2">
            {isEditing
              ? 'Actualiza el nombre o área de la línea / maquila.'
              : 'Registra una nueva línea / maquila asignada a su departamento.'}
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2">
              <Icon name="error" size="xs" />
              <span>{error}</span>
            </div>
          )}

          {/* Departamento */}
          <div className="space-y-1.5">
            <Label htmlFor="departamento">
              Departamento {isEditing ? '(Asignado)' : '*'}
            </Label>
            <Select
              id="departamento"
              value={departamentoId || ''}
              onChange={(e) => setDepartamentoId(Number(e.target.value))}
              disabled={isEditing || isSubmitting}
              required
            >
              <option value="">Selecciona un departamento...</option>
              {departamentos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre.toUpperCase()}
                </option>
              ))}
            </Select>
          </div>

          {/* Área */}
          <div className="space-y-1.5">
            <Label htmlFor="area">Área *</Label>
            <Select
              id="area"
              value={area}
              onChange={(e) => setArea(e.target.value as AreaProduccion)}
              disabled={isSubmitting}
              required
            >
              <option value="BOTA">BOTA</option>
              <option value="ACCESORIOS">ACCESORIOS</option>
            </Select>
          </div>

          {/* Nombre descriptivo (siempre en mayúsculas) */}
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Línea / Maquila *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value.toUpperCase())}
              placeholder="Ej. BOTA FAC o CINTOS"
              disabled={isSubmitting}
              required
              className="uppercase tracking-wide"
            />
          </div>
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="cancelar" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="guardar" disabled={isSubmitting} icon={isSubmitting ? undefined : 'check_circle'}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Spinner size="xs" />
                Guardando...
              </span>
            ) : isEditing ? (
              'Guardar Cambios'
            ) : (
              'Crear Línea'
            )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
