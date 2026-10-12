import { useState, useEffect, useMemo, type ReactNode, type FormEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { listadosApi } from '../api/listados-api';
import type {
  ListadoItem,
  CreateListadoInput,
  UpdateListadoInput,
  DepartamentoConLineas,
} from '../types/listados.types';

export interface ListadoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** null = crear, ListadoItem = editar */
  listado: ListadoItem | null;
  departamentos: DepartamentoConLineas[];
  onSuccess: (item?: ListadoItem) => void;
}

/**
 * Modal unificado para Crear y Editar listados.
 *
 * Crear: todos los campos habilitados.
 * Editar: solo si el listado está en PENDIENTE (el backend lo verifica también).
 *
 * Fecha: el valor inicial usa la fecha local del navegador (sin UTC shift).
 * El input type="date" trabaja en YYYY-MM-DD y el backend lo valida con ese mismo formato.
 */
export function ListadoFormModal({
  isOpen,
  onClose,
  listado,
  departamentos,
  onSuccess,
}: ListadoFormModalProps): ReactNode {
  const isEditing = Boolean(listado);

  // ─── Estado del formulario ────────────────────────────────────────────────

  const [numeroListado, setNumeroListado] = useState<string>('');
  const [fechaRequerida, setFechaRequerida] = useState<string>('');
  const [lineaProduccionId, setLineaProduccionId] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Líneas de producción disponibles ─────────────────────────────────────

  const lineasDisponibles = useMemo(() => {
    const all = departamentos.flatMap((d) => d.lineasProduccion);
    return all
      .filter((l) => l.estado === 'ACTIVO' || l.id === listado?.lineaProduccion.id)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [departamentos, listado]);

  // ─── Fecha local inicial (sin UTC shift) ─────────────────────────────────

  function getLocalDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ─── Sincronizar formulario al abrir / cambiar listado ────────────────────

  useEffect(() => {
    if (!isOpen) return;

    if (listado) {
      // Modo edición: cargar valores actuales
      setNumeroListado(listado.numeroListado);

      // Extraer fecha local desde el valor ISO del backend
      // Si el backend envía "2026-10-05T00:00:00.000Z", tomamos solo la parte de fecha
      // para evitar conversiones de timezone que podrían cambiar el día.
      const fechaRaw = listado.fechaRequerida;
      const fechaSolo = fechaRaw.includes('T') ? fechaRaw.slice(0, 10) : fechaRaw;
      setFechaRequerida(fechaSolo);

      setLineaProduccionId(listado.lineaProduccion.id);
    } else {
      // Modo creación: valores por defecto
      setNumeroListado('');
      setFechaRequerida(getLocalDateString());
      setLineaProduccionId(0);
    }

    setIsSubmitting(false);
    setError(null);
  }, [isOpen, listado]);

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lineaProduccionId === 0) {
      setError('Debes seleccionar una línea de producción.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && listado) {
        const payload: UpdateListadoInput = {};
        if (numeroListado.trim() !== listado.numeroListado) {
          payload.numeroListado = numeroListado.trim();
        }
        const fechaSoloActual = listado.fechaRequerida.includes('T')
          ? listado.fechaRequerida.slice(0, 10)
          : listado.fechaRequerida;
        if (fechaRequerida !== fechaSoloActual) {
          payload.fechaRequerida = fechaRequerida;
        }
        if (lineaProduccionId !== listado.lineaProduccion.id) {
          payload.lineaProduccionId = lineaProduccionId;
        }

        if (Object.keys(payload).length === 0) {
          // Sin cambios
          onClose();
          return;
        }

        const res = await listadosApi.updateListado(listado.id, payload);
        if (res.success) {
          onSuccess(res.data);
          onClose();
        } else {
          setError(res.message || 'Error al actualizar el listado.');
        }
      } else {
        const payload: CreateListadoInput = {
          numeroListado: numeroListado.trim(),
          fechaRequerida,
          lineaProduccionId,
        };

        const res = await listadosApi.createListado(payload);
        if (res.success) {
          onSuccess(res.data);
          onClose();
        } else {
          setError(res.message || 'Error al crear el listado.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al guardar listado.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <ModalHeader
        title={isEditing ? 'Editar Listado' : 'Nuevo Listado'}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 overflow-hidden">
        <ModalBody className="space-y-4">
          <p className="text-xs text-text-secondary -mt-2">
            {isEditing
              ? 'Modifica los datos del listado. Solo es posible editar listados en estado PENDIENTE.'
              : 'Registra un nuevo listado de material para la línea de producción indicada.'}
          </p>

          {/* Número de Listado */}
          <div className="space-y-1.5">
            <Label htmlFor="numeroListado">Número de Listado</Label>
            <Input
              id="numeroListado"
              type="text"
              required
              autoComplete="off"
              value={numeroListado}
              onChange={(e) => setNumeroListado(e.target.value)}
              placeholder="Ej. LST-2026-001"
              className="font-mono"
            />
            <p className="text-2xs text-text-muted">
              Identificador único del listado. No puede repetirse en el sistema.
            </p>
          </div>

          {/* Fecha Requerida */}
          <div className="space-y-1.5">
            <Label htmlFor="fechaRequerida">Fecha Requerida</Label>
            <Input
              id="fechaRequerida"
              type="date"
              required
              value={fechaRequerida}
              onChange={(e) => setFechaRequerida(e.target.value)}
            />
            <p className="text-2xs text-text-muted">
              Fecha en que se requiere el material para producción.
            </p>
          </div>

          {/* Línea de Producción */}
          <div className="space-y-1.5">
            <Label htmlFor="lineaProduccion">Línea de Producción</Label>
            <Select
              id="lineaProduccion"
              required
              value={lineaProduccionId || ''}
              onChange={(e) => {
                const val = e.target.value;
                setLineaProduccionId(val ? Number(val) : 0);
              }}
              error={!lineaProduccionId && isSubmitting}
            >
              <option value="">Selecciona una línea...</option>
              {lineasDisponibles.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </Select>
            {lineasDisponibles.length === 0 && (
              <p className="text-2xs text-warning font-medium">
                No hay líneas de producción disponibles.
              </p>
            )}
          </div>

          {/* Error de mutación */}
          {error && (
            <p className="text-xs text-danger font-medium bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </ModalBody>

        <ModalFooter className="flex items-center justify-end gap-3">
          <Button type="button" variant="cancelar" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="guardar" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner size="18px" className="mr-2" />
                Guardando...
              </>
            ) : isEditing ? (
              'Actualizar Listado'
            ) : (
              'Crear Listado'
            )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
