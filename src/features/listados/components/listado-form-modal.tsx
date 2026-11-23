import { useState, useEffect, useMemo, useRef, type ReactNode, type FormEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/components/ui/icon';
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
  onSuccess: (item?: ListadoItem | ListadoItem[]) => void;
}

type ModoRegistro = 'INDIVIDUAL' | 'MULTIPLE';

interface ListadoCarritoItem {
  id: string;
  payload: CreateListadoInput;
  lineaLabel: string;
}

/**
 * Fecha local actual en formato YYYY-MM-DD (sin desfase UTC).
 */
function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Modal unificado para Crear y Editar listados.
 * Soporta modo Individual y modo "Varios a la vez" (Carrito de captura rápida).
 */
export function ListadoFormModal({
  isOpen,
  onClose,
  listado,
  departamentos,
  onSuccess,
}: ListadoFormModalProps): ReactNode {
  const isEditing = Boolean(listado);
  const isListadoDescontado = Boolean(
    isEditing &&
      listado &&
      (listado.estado === 'DESCONTADO' ||
        (listado.frentes &&
          listado.frentes.length > 0 &&
          listado.frentes.every((f) => f.estado === 'DESCONTADO'))),
  );
  const isListadoCancelado = Boolean(isEditing && listado && listado.estado === 'CANCELADO');
  const isBloqueadoParaEdicion = isListadoDescontado || isListadoCancelado;
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modo de registro: Individual vs Varios a la vez
  const [modoRegistro, setModoRegistro] = useState<ModoRegistro>('INDIVIDUAL');

  // Carrito de listados en modo múltiple
  const [carrito, setCarrito] = useState<ListadoCarritoItem[]>([]);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);

  // Protección contra descarte accidental
  const [showConfirmDescartar, setShowConfirmDescartar] = useState(false);
  const [guardandoProgreso, setGuardandoProgreso] = useState<{ actual: number; total: number } | null>(null);

  // ─── Estado del formulario ────────────────────────────────────────────────
  const [numeroListado, setNumeroListado] = useState<string>('');
  const [fechaRequerida, setFechaRequerida] = useState<string>('');
  const [lineaProduccionId, setLineaProduccionId] = useState<number>(0);
  const numeroListadoInputRef = useRef<HTMLInputElement>(null);

  const isFormDisabled = isSubmitting || isBloqueadoParaEdicion;

  // ─── Líneas de producción disponibles ─────────────────────────────────────
  const lineasDisponibles = useMemo(() => {
    const all = departamentos.flatMap((d) => d.lineasProduccion);
    return all
      .filter((l) => l.estado === 'ACTIVO' || l.id === listado?.lineaProduccion.id)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [departamentos, listado]);

  // ─── Sincronizar formulario al abrir / cambiar listado ────────────────────
  useEffect(() => {
    if (!isOpen) {
      setCarrito([]);
      setEditingCartItemId(null);
      setModoRegistro('INDIVIDUAL');
      setShowConfirmDescartar(false);
      setGuardandoProgreso(null);
      return;
    }

    if (listado) {
      // Modo edición: cargar valores actuales
      setModoRegistro('INDIVIDUAL');
      setNumeroListado(listado.numeroListado);

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

  // Manejo de cierre seguro con interceptor si hay elementos en el carrito
  const handleRequestClose = () => {
    if (modoRegistro === 'MULTIPLE' && carrito.length > 0) {
      setShowConfirmDescartar(true);
      return;
    }
    onClose();
  };

  // Cambio de modo con confirmación si se perderían datos
  const handleCambiarModo = (nuevoModo: ModoRegistro) => {
    if (nuevoModo === modoRegistro) return;
    if (nuevoModo === 'INDIVIDUAL' && carrito.length > 0) {
      setShowConfirmDescartar(true);
      return;
    }
    setModoRegistro(nuevoModo);
    setError(null);
  };

  // Validador común de campos actuales
  const validarCamposActuales = ():
    | {
        valid: true;
        payload: CreateListadoInput;
        lineaLabel: string;
      }
    | { valid: false; error: string } => {
    const numeroClean = numeroListado.trim();
    if (!numeroClean) {
      return { valid: false, error: 'Debes ingresar el número de listado.' };
    }
    if (numeroClean.length > 50) {
      return { valid: false, error: 'El número de listado no debe exceder 50 caracteres.' };
    }

    if (!fechaRequerida) {
      return { valid: false, error: 'Debes ingresar la fecha requerida.' };
    }

    if (!lineaProduccionId || lineaProduccionId === 0) {
      return { valid: false, error: 'Debes seleccionar una línea de producción.' };
    }

    const linea = lineasDisponibles.find((l) => l.id === lineaProduccionId);
    const lineaLabel = linea?.nombre || 'LÍNEA';

    return {
      valid: true,
      payload: {
        numeroListado: numeroClean,
        fechaRequerida,
        lineaProduccionId,
      },
      lineaLabel,
    };
  };

  // Agregar al Carrito (Modo Múltiple)
  const handleAgregarAlCarrito = () => {
    setError(null);
    const validacion = validarCamposActuales();
    if (!validacion.valid) {
      setError(validacion.error);
      return;
    }

    // Verificar si ya existe en el carrito
    const existeEnCarrito = carrito.some(
      (item) => item.payload.numeroListado.toUpperCase() === validacion.payload.numeroListado.toUpperCase(),
    );

    if (existeEnCarrito) {
      setError(`Ya existe un listado con el número "${validacion.payload.numeroListado}" en la lista.`);
      return;
    }

    const nuevoItem: ListadoCarritoItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      payload: validacion.payload,
      lineaLabel: validacion.lineaLabel,
    };

    setCarrito((prev) => [...prev, nuevoItem]);

    // Re-iniciar datos del listado para el siguiente registro (conservando fechaRequerida)
    resetFormularioPreservandoFecha();
    setTimeout(() => {
      numeroListadoInputRef.current?.focus();
    }, 50);
  };

  // Re-iniciar campos del formulario preservando la fecha requerida
  const resetFormularioPreservandoFecha = () => {
    setNumeroListado('');
    setLineaProduccionId(0);
  };

  // Cargar elemento del carrito para editarlo
  const handleEditarItem = (item: ListadoCarritoItem) => {
    setError(null);
    setEditingCartItemId(item.id);
    setNumeroListado(item.payload.numeroListado);
    setFechaRequerida(item.payload.fechaRequerida);
    setLineaProduccionId(item.payload.lineaProduccionId);
  };

  // Guardar cambios del elemento editado en el carrito
  const handleActualizarEnCarrito = () => {
    if (!editingCartItemId) return;
    setError(null);

    const validacion = validarCamposActuales();
    if (!validacion.valid) {
      setError(validacion.error);
      return;
    }

    // Verificar si colisiona con otro elemento del carrito distinto a sí mismo
    const colision = carrito.some(
      (item) =>
        item.id !== editingCartItemId &&
        item.payload.numeroListado.toUpperCase() === validacion.payload.numeroListado.toUpperCase(),
    );

    if (colision) {
      setError(`Ya existe otro listado con el número "${validacion.payload.numeroListado}" en la lista.`);
      return;
    }

    setCarrito((prev) =>
      prev.map((c) =>
        c.id === editingCartItemId
          ? {
              ...c,
              payload: validacion.payload,
              lineaLabel: validacion.lineaLabel,
            }
          : c,
      ),
    );

    setEditingCartItemId(null);
    resetFormularioPreservandoFecha();
  };

  // Cancelar edición de un elemento del carrito
  const handleCancelarEdicion = () => {
    setEditingCartItemId(null);
    resetFormularioPreservandoFecha();
    setError(null);
  };

  // Eliminar elemento del carrito
  const handleEliminarItem = (itemId: string) => {
    if (editingCartItemId === itemId) {
      setEditingCartItemId(null);
      resetFormularioPreservandoFecha();
    }
    setCarrito((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Vaciar lista completa
  const handleVaciarCarrito = () => {
    setCarrito([]);
    setEditingCartItemId(null);
    resetFormularioPreservandoFecha();
    setError(null);
  };

  // Guardar todos los listados del carrito (Submit múltiple)
  const handleGuardarCarrito = async () => {
    if (carrito.length === 0) return;
    setIsSubmitting(true);
    setError(null);

    const itemsGuardados: ListadoItem[] = [];
    const itemsPendientes = [...carrito];
    const itemsGuardadosIds: string[] = [];

    for (let i = 0; i < itemsPendientes.length; i++) {
      const item = itemsPendientes[i];
      setGuardandoProgreso({ actual: i + 1, total: itemsPendientes.length });

      try {
        const res = await listadosApi.createListado(item.payload);
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Error al registrar el listado');
        }
        itemsGuardados.push(res.data);
        itemsGuardadosIds.push(item.id);
      } catch (err) {
        // Remover del carrito los que ya se guardaron con éxito
        const restantes = itemsPendientes.filter((c) => !itemsGuardadosIds.includes(c.id));
        setCarrito(restantes);

        const msg = err instanceof Error ? err.message : 'Error inesperado';
        setError(
          `Error al guardar listado "${item.payload.numeroListado}": ${msg}. Los ${itemsGuardadosIds.length} listados anteriores ya se guardaron con éxito. Corrige este elemento para continuar.`,
        );
        setIsSubmitting(false);
        setGuardandoProgreso(null);
        return;
      }
    }

    // Todos se guardaron con éxito
    setIsSubmitting(false);
    setGuardandoProgreso(null);
    setCarrito([]);
    if (itemsGuardados.length > 0) {
      onSuccess(itemsGuardados.length === 1 ? itemsGuardados[0] : itemsGuardados);
    }
    onClose();
  };

  // Submit modo individual
  const handleSubmitIndividual = async (e: FormEvent) => {
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

  // Renderizador de campos del formulario
  const renderCamposFormulario = () => (
    <div className="space-y-4">
      {/* Número de Listado */}
      <div className="space-y-1.5">
        <Label htmlFor="numeroListado">Número de Listado</Label>
        <Input
          ref={numeroListadoInputRef}
          id="numeroListado"
          type="text"
          required
          autoComplete="off"
          value={numeroListado}
          onChange={(e) => setNumeroListado(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && modoRegistro === 'MULTIPLE') {
              e.preventDefault();
              if (editingCartItemId) {
                handleActualizarEnCarrito();
              } else {
                handleAgregarAlCarrito();
              }
            }
          }}
          placeholder="Ej. LST-2026-001"
          className="font-mono uppercase"
          disabled={isFormDisabled}
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
          disabled={isFormDisabled}
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
          disabled={isFormDisabled}
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
    </div>
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleRequestClose}
        className={modoRegistro === 'MULTIPLE' ? 'max-w-4xl' : 'max-w-lg'}
      >
        <ModalHeader
          title={
            isEditing
              ? 'Editar Listado'
              : modoRegistro === 'MULTIPLE'
                ? 'Registro de Listados'
                : 'Nuevo Listado'
          }
          onClose={handleRequestClose}
        />

        {/* Selector de Modo en la parte superior del modal */}
        {!isEditing && (
          <div className="flex items-center justify-between px-6 py-2.5 bg-cuadra-arena/30 border-b border-border/60">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Modo de captura
            </span>
            <div className="inline-flex rounded-lg p-0.5 bg-app-surface border border-border shadow-2xs">
              <button
                type="button"
                onClick={() => handleCambiarModo('INDIVIDUAL')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modoRegistro === 'INDIVIDUAL'
                    ? 'bg-marca-primario text-white shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon name="description" size="14px" />
                Individual
              </button>
              <button
                type="button"
                onClick={() => handleCambiarModo('MULTIPLE')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modoRegistro === 'MULTIPLE'
                    ? 'bg-marca-primario text-white shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon name="playlist_add" size="14px" />
                Varios a la vez
                {carrito.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-3xs font-mono bg-white text-marca-primario font-bold">
                    {carrito.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── MODO INDIVIDUAL ── */}
        {modoRegistro === 'INDIVIDUAL' && (
          <form
            onSubmit={handleSubmitIndividual}
            autoComplete="off"
            className="flex flex-col flex-1 overflow-hidden"
          >
            <ModalBody className="space-y-4">
              {isBloqueadoParaEdicion && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-warning/30 bg-warning/10 text-warning-text text-xs">
                  <Icon name="lock" size="18px" className="mt-0.5 shrink-0 text-warning" />
                  <div className="space-y-1">
                    <p className="font-semibold text-warning-text">
                      {isListadoCancelado
                        ? 'Listado Cancelado'
                        : 'Listado Finalizado (Materiales Descontados)'}
                    </p>
                    <p className="text-2xs text-text-secondary leading-relaxed">
                      {isListadoCancelado
                        ? 'No se pueden modificar los datos de un listado que ha sido cancelado.'
                        : 'Los materiales de este listado ya fueron descontados en el sistema. Para modificar sus datos, debe retroceder primero el descuento a PENDIENTE desde el módulo correspondiente.'}
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-text-secondary -mt-2">
                {isEditing
                  ? 'Modifica los datos del listado de material.'
                  : 'Registra un nuevo listado de material para la línea de producción indicada.'}
              </p>

              {renderCamposFormulario()}

              {error && (
                <p className="text-xs text-danger font-medium bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </ModalBody>

            <ModalFooter className="flex items-center justify-end gap-3">
              <Button type="button" variant="cancelar" onClick={handleRequestClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" variant="guardar" disabled={isSubmitting || isBloqueadoParaEdicion}>
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
        )}

        {/* ── MODO MÚLTIPLE (CARRITO) ── */}
        {modoRegistro === 'MULTIPLE' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <ModalBody className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 min-h-[380px]">
                {/* Columna Izquierda: Formulario de captura */}
                <div className="md:col-span-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border/60 pb-5 md:pb-0 md:pr-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-border/40">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                        <Icon name="edit_note" size="16px" className="text-brand-primary" />
                        {editingCartItemId ? 'Modificar listado' : 'Datos del listado'}
                      </span>

                      {editingCartItemId && (
                        <button
                          type="button"
                          onClick={handleCancelarEdicion}
                          className="text-2xs text-text-muted hover:text-danger cursor-pointer underline"
                        >
                          Cancelar edición
                        </button>
                      )}
                    </div>

                    {renderCamposFormulario()}

                    {error && (
                      <p className="text-xs text-danger font-medium bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
                        {error}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 mt-2">
                    <Button
                      type="button"
                      variant={editingCartItemId ? 'primary' : 'outline'}
                      onClick={editingCartItemId ? handleActualizarEnCarrito : handleAgregarAlCarrito}
                      className="w-full h-10 font-semibold"
                    >
                      <Icon
                        name={editingCartItemId ? 'check_circle' : 'add_circle'}
                        size="sm"
                        className="mr-1.5"
                      />
                      {editingCartItemId ? 'Actualizar en la lista' : 'Agregar a la lista'}
                    </Button>
                  </div>
                </div>

                {/* Columna Derecha: Lista acumulativa (Carrito) */}
                <div className="md:col-span-6 flex flex-col justify-between pl-0 md:pl-2">
                  <div className="space-y-2 flex flex-col flex-1">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                          <Icon name="shopping_cart" size="14px" className="text-brand-primary" />
                          Listados por registrar
                        </span>
                        <span className="text-3xs font-bold px-1.5 py-0.2 rounded-full bg-brand-primary/15 text-brand-primary font-mono">
                          {carrito.length}
                        </span>
                      </div>

                      {carrito.length > 0 && (
                        <button
                          type="button"
                          onClick={handleVaciarCarrito}
                          className="text-3xs text-text-muted/70 hover:text-danger cursor-pointer transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-danger/5"
                          title="Vaciar toda la lista"
                        >
                          <Icon name="delete_sweep" size="12px" />
                          Vaciar
                        </button>
                      )}
                    </div>

                    {/* Contenedor scrolleable de listados */}
                    <div className="flex-1 max-h-[350px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                      {carrito.length === 0 ? (
                        <div className="h-full min-h-[240px] flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-border/80 bg-cuadra-arena/10">
                          <div className="w-12 h-12 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center mb-3">
                            <Icon name="post_add" size="md" />
                          </div>
                          <p className="text-xs font-semibold text-text-primary">
                            La lista está vacía
                          </p>
                          <p className="text-2xs text-text-muted max-w-[240px] mt-1">
                            Captura los datos a la izquierda y presiona &quot;Agregar a la lista&quot; para acumular los listados.
                          </p>
                        </div>
                      ) : (
                        carrito.map((item, idx) => {
                          const isBeingEdited = editingCartItemId === item.id;
                          return (
                            <div
                              key={item.id}
                              className={`px-2.5 py-1.5 rounded-lg border transition-all text-xs ${
                                isBeingEdited
                                  ? 'bg-brand-primary/10 border-brand-primary ring-1 ring-brand-primary shadow-2xs'
                                  : 'bg-app-surface border-border hover:border-border-strong'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  {/* Fila 1: #, Número de listado y Fecha */}
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-3xs font-mono font-bold px-1 py-0.2 rounded bg-cuadra-arena text-text-secondary shrink-0">
                                      #{idx + 1}
                                    </span>
                                    <span className="font-mono font-bold text-text-primary text-xs truncate">
                                      {item.payload.numeroListado}
                                    </span>
                                    <span className="text-3xs text-text-muted font-mono ml-auto shrink-0 truncate">
                                      Requerido: {item.payload.fechaRequerida}
                                    </span>
                                  </div>

                                  {/* Fila 2: Línea de producción */}
                                  <p className="text-text-secondary truncate text-2xs leading-tight">
                                    {item.lineaLabel}
                                  </p>
                                </div>

                                {/* Acciones */}
                                <div className="flex items-center gap-0.5 shrink-0 pl-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditarItem(item)}
                                    title="Editar este listado"
                                    className="p-1 rounded text-text-muted hover:text-brand-primary hover:bg-brand-primary/10 transition-colors cursor-pointer"
                                  >
                                    <Icon name="edit" size="13px" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleEliminarItem(item.id)}
                                    title="Eliminar de la lista"
                                    className="p-1 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                                  >
                                    <Icon name="delete" size="13px" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between border-t border-border/70 p-4">
              <div className="text-xs text-text-muted">
                {carrito.length > 0 ? (
                  <span>
                    Total acumulado:{' '}
                    <strong className="text-text-primary">
                      {carrito.length} listado{carrito.length === 1 ? '' : 's'}
                    </strong>
                  </span>
                ) : (
                  <span>Agrega listados a la lista para guardarlos en lote.</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button type="button" variant="cancelar" onClick={handleRequestClose} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="guardar"
                  onClick={handleGuardarCarrito}
                  disabled={carrito.length === 0 || isSubmitting}
                  className="min-w-36"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner size="18px" className="mr-2" />
                      {guardandoProgreso
                        ? `Guardando ${guardandoProgreso.actual}/${guardandoProgreso.total}...`
                        : 'Guardando...'}
                    </>
                  ) : (
                    <>
                      <Icon name="cloud_upload" size="sm" className="mr-1.5" />
                      Guardar todos ({carrito.length})
                    </>
                  )}
                </Button>
              </div>
            </ModalFooter>
          </div>
        )}
      </Modal>

      {/* Modal de confirmación para evitar pérdida accidental de datos */}
      {showConfirmDescartar && (
        <Modal
          isOpen={showConfirmDescartar}
          onClose={() => setShowConfirmDescartar(false)}
          className="max-w-md z-[110]"
        >
          <ModalHeader title="¿Descartar elementos?" onClose={() => setShowConfirmDescartar(false)} />
          <ModalBody className="py-4 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-2">
              <Icon name="warning" size="md" />
            </div>
            <p className="text-sm font-semibold text-text-primary">
              Tienes {carrito.length} listado{carrito.length === 1 ? '' : 's'} en la lista sin guardar.
            </p>
            <p className="text-xs text-text-muted">
              Si cierras la ventana ahora, se descartarán todos los listados que agregaste a la lista.
            </p>
          </ModalBody>
          <ModalFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDescartar(false)}>
              Continuar editando
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowConfirmDescartar(false);
                setCarrito([]);
                onClose();
              }}
            >
              Sí, descartar
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
