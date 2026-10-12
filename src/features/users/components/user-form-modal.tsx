import { useState, useEffect, type ReactNode, type FormEvent } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { usersApi } from '../api/users-api';
import type {
  UsuarioItem,
  CreateUserInput,
  UpdateUserInput,
  RolSimple,
  DepartamentoSimple,
  LineaProduccionSimple,
} from '../types/users.types';

export interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UsuarioItem | null; // If null => create mode, else edit mode
  roles: RolSimple[];
  departamentos: DepartamentoSimple[];
  onSuccess: () => void;
}

export function UserFormModal({
  isOpen,
  onClose,
  user,
  roles,
  departamentos,
  onSuccess,
}: UserFormModalProps): ReactNode {
  const isEditing = Boolean(user);

  const [nombre, setNombre] = useState<string>('');
  const [usuario, setUsuario] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rolId, setRolId] = useState<number>(0);
  const [departamentoId, setDepartamentoId] = useState<number | undefined>(undefined);
  const [frentesSurtido, setFrentesSurtido] = useState<string[]>([]);
  const [frentesAuditor, setFrentesAuditor] = useState<string[]>([]);
  const [lineasAsignadas, setLineasAsignadas] = useState<number[]>([]);

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Available lines based on selected department
  const availableLines: (LineaProduccionSimple & { area?: string })[] = departamentoId
    ? (departamentos.find((d) => d.id === departamentoId)?.lineasProduccion as any) || []
    : (departamentos.flatMap((d) => d.lineasProduccion || []) as any);

  const selectedRole = roles.find((r) => r.id === rolId);
  const isAlmacenista = selectedRole?.codigo === 'ALMACENISTA';
  const isAuditor = selectedRole?.codigo === 'AUDITOR';

  // Sync form values on open / change user
  useEffect(() => {
    if (isOpen) {
      if (user) {
        setNombre(user.nombre);
        setUsuario(user.usuario);
        setPassword('');
        setRolId(user.rol.id);
        setDepartamentoId(user.departamento?.id);
        if (user.tipoSurtidoAlmacen) {
          const list = user.tipoSurtidoAlmacen.split(',').map((s) => s.trim().toUpperCase());
          if (list.includes('TODOS')) {
            setFrentesSurtido(['DIRECTOS', 'INDIRECTOS', 'BOLSAS']);
          } else {
            setFrentesSurtido(list.filter((s) => ['DIRECTOS', 'INDIRECTOS', 'BOLSAS'].includes(s)));
          }
        } else {
          setFrentesSurtido([]);
        }
        if (user.tipoMaterialAuditor) {
          const listAud = user.tipoMaterialAuditor.split(',').map((s) => s.trim().toUpperCase());
          if (listAud.includes('TODOS')) {
            setFrentesAuditor(['DIRECTOS', 'INDIRECTOS', 'BOLSAS']);
          } else {
            setFrentesAuditor(listAud.filter((s) => ['DIRECTOS', 'INDIRECTOS', 'BOLSAS'].includes(s)));
          }
        } else {
          setFrentesAuditor([]);
        }
        const activeLinesIds = new Set(availableLines.map((l) => l.id));
        setLineasAsignadas(
          user.lineasAsignadas
            ? user.lineasAsignadas.filter((l) => activeLinesIds.has(l.id)).map((l) => l.id)
            : [],
        );
      } else {
        setNombre('');
        setUsuario('');
        setPassword('');
        const defaultRol = roles[0];
        setRolId(defaultRol?.id || 0);
        setDepartamentoId(departamentos[0]?.id);
        if (defaultRol?.codigo === 'ALMACENISTA') {
          setFrentesSurtido(['DIRECTOS']);
          setFrentesAuditor([]);
        } else if (defaultRol?.codigo === 'AUDITOR') {
          setFrentesAuditor(['DIRECTOS', 'INDIRECTOS', 'BOLSAS']);
          setFrentesSurtido([]);
        } else {
          setFrentesSurtido([]);
          setFrentesAuditor([]);
        }
        setLineasAsignadas([]);
      }
      setShowPassword(false);
      setIsSubmitting(false);
      setError(null);
    }
  }, [isOpen, user, roles, departamentos]);

  const handleRoleChange = (newRolId: number) => {
    setRolId(newRolId);
    const newRole = roles.find((r) => r.id === newRolId);
    if (newRole?.codigo === 'ALMACENISTA') {
      if (frentesSurtido.length === 0) setFrentesSurtido(['DIRECTOS']);
      setFrentesAuditor([]);
    } else if (newRole?.codigo === 'AUDITOR') {
      if (frentesAuditor.length === 0) setFrentesAuditor(['DIRECTOS', 'INDIRECTOS', 'BOLSAS']);
      setFrentesSurtido([]);
    } else {
      setFrentesSurtido([]);
      setFrentesAuditor([]);
      setLineasAsignadas([]);
    }
  };

  const handleToggleFrente = (frente: string) => {
    setFrentesSurtido((prev) => {
      const next = prev.includes(frente) ? prev.filter((f) => f !== frente) : [...prev, frente];
      // Si el nuevo estado es exclusivamente BOLSAS, remover automáticamente cualquier línea de área BOTA seleccionada
      if (next.length === 1 && next[0] === 'BOLSAS') {
        const lineasBotaIds = new Set(
          availableLines.filter((l) => l.area === 'BOTA').map((l) => l.id),
        );
        setLineasAsignadas((prevLineas) => prevLineas.filter((id) => !lineasBotaIds.has(id)));
      }
      return next;
    });
  };

  const handleToggleFrenteAuditor = (frente: string) => {
    setFrentesAuditor((prev) =>
      prev.includes(frente) ? prev.filter((f) => f !== frente) : [...prev, frente],
    );
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let generated = '';
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    setShowPassword(true);
  };

  const handleToggleLinea = (id: number) => {
    setLineasAsignadas((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validaciones de negocio
    if (isAlmacenista && frentesSurtido.length === 0) {
      setError('Seleccione al menos un tipo de surtido.');
      setIsSubmitting(false);
      return;
    }

    if (isAuditor && frentesAuditor.length === 0) {
      setError('Seleccione al menos un tipo de material.');
      setIsSubmitting(false);
      return;
    }

    // Regla de incompatibilidad BOLSAS + BOTA: Solo si es exclusivamente BOLSAS
    const soloBolsas = frentesSurtido.length === 1 && frentesSurtido[0] === 'BOLSAS';
    let lineasValidas = lineasAsignadas;
    if (isAlmacenista && soloBolsas) {
      // Excluir automáticamente cualquier línea residual de área BOTA
      const lineasBotaIds = new Set(
        availableLines.filter((l) => l.area === 'BOTA').map((l) => l.id),
      );
      lineasValidas = lineasAsignadas.filter((id) => !lineasBotaIds.has(id));
      if (lineasValidas.length !== lineasAsignadas.length) {
        setLineasAsignadas(lineasValidas);
      }
    }

    try {
      const lineas = isAlmacenista ? lineasValidas : [];
      const tipoSurtidoCalculado = isAlmacenista
        ? frentesSurtido.length === 3
          ? 'TODOS'
          : frentesSurtido.join(',')
        : null;

      const tipoMaterialAuditorCalculado = isAuditor
        ? frentesAuditor.length === 3
          ? 'TODOS'
          : frentesAuditor.join(',')
        : null;

      if (isEditing && user) {
        const payload: UpdateUserInput = {
          nombre: nombre.trim(),
          usuario: usuario.trim(),
          rolId,
          departamentoId: departamentoId || undefined,
          tipoSurtidoAlmacen: tipoSurtidoCalculado,
          tipoMaterialAuditor: tipoMaterialAuditorCalculado,
          lineaProduccionIds: lineas,
          lineasAsignadas: lineas,
        };
        if (password) {
          payload.password = password;
        }

        const res = await usersApi.updateUser(user.id, payload);
        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setError(res.message || 'Error al actualizar el usuario.');
        }
      } else {
        const payload: CreateUserInput = {
          nombre: nombre.trim(),
          usuario: usuario.trim(),
          password: password || undefined,
          rolId,
          departamentoId: departamentoId || undefined,
          tipoSurtidoAlmacen: tipoSurtidoCalculado,
          tipoMaterialAuditor: tipoMaterialAuditorCalculado,
          lineaProduccionIds: lineas,
          lineasAsignadas: lineas,
        };

        const res = await usersApi.createUser(payload);
        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setError(res.message || 'Error al crear el usuario.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al guardar usuario.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-xl">
      <ModalHeader
        title={isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col flex-1 overflow-hidden">
        {/* Fake inputs to prevent browser autofill heuristics */}
        <input type="text" style={{ display: 'none' }} aria-hidden="true" />
        <input type="password" style={{ display: 'none' }} aria-hidden="true" />
        <ModalBody className="space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <p className="text-xs text-text-secondary -mt-2">
            {isEditing
              ? 'Modifica los datos del usuario, rol de permisos, departamento y segmentación operativa.'
              : 'Completa la información para dar de alta a un nuevo integrante del sistema.'}
          </p>

          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre Completo</Label>
            <Input
              id="nombre"
              name="user_fullname_field"
              type="text"
              required
              autoComplete="off"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Juan Pérez González"
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="usuario">Usuario</Label>
            <Input
              id="usuario"
              name="user_login_field"
              type="text"
              required
              autoComplete="off"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value.toLowerCase().trim())}
              placeholder="ej. jperez"
              className="font-mono"
            />
            <p className="text-2xs text-text-muted">
              Identificador único para iniciar sesión. Solo letras minúsculas, números o guiones.
            </p>
          </div>

          {/* Password (Optional on edit, mandatory or auto on create) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">
                {isEditing ? 'Contraseña (dejar en blanco para conservar)' : 'Contraseña'}
              </Label>
              <button
                type="button"
                onClick={generatePassword}
                className="text-xs text-marca-primario hover:underline font-medium flex items-center gap-1 transition-colors"
              >
                <Icon name="casino" size="xs" />
                Generar segura
              </button>
            </div>

            <div className="relative">
              <Input
                id="password"
                name="user_password_field"
                autoComplete="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEditing ? '••••••••' : 'Mínimo 6 caracteres'}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text-primary transition-colors"
                title={showPassword ? 'Ocultar' : 'Mostrar'}
              >
                <Icon name={showPassword ? 'visibility_off' : 'visibility'} size="xs" />
              </button>
            </div>
          </div>

          {/* Role & Department Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rol">Rol del Sistema</Label>
              <Select
                id="rol"
                value={rolId}
                onChange={(e) => handleRoleChange(Number(e.target.value))}
                required
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="departamento">Departamento</Label>
              <Select
                id="departamento"
                value={departamentoId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setDepartamentoId(val ? Number(val) : undefined);
                }}
                required
              >
                <option value="">Seleccionar departamento...</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Segmentación para ALMACENISTA */}
          {isAlmacenista && (
            <div className="space-y-2 p-3.5 bg-cuadra-arena/30 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Tipo de Surtido Autorizado *
                </Label>
                <span className="text-2xs text-text-muted">
                  {frentesSurtido.length} seleccionado(s)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'DIRECTOS', label: 'Directos' },
                  { id: 'INDIRECTOS', label: 'Indirectos' },
                  { id: 'BOLSAS', label: 'Bolsas' },
                ].map((frente) => {
                  const isChecked = frentesSurtido.includes(frente.id);
                  return (
                    <label
                      key={frente.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-marca-primario/10 border-marca-primario/30 text-marca-primario font-medium'
                          : 'bg-app-surface border-border text-text-secondary hover:bg-app-surface-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleFrente(frente.id)}
                        className="rounded border-border text-marca-primario focus:ring-marca-primario/25 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span>{frente.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Segmentación para AUDITOR */}
          {isAuditor && (
            <div className="space-y-2 p-3.5 bg-cuadra-arena/30 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Tipo de Material Autorizado *
                </Label>
                <span className="text-2xs text-text-muted">
                  {frentesAuditor.length} seleccionado(s)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'DIRECTOS', label: 'Directos' },
                  { id: 'INDIRECTOS', label: 'Indirectos' },
                  { id: 'BOLSAS', label: 'Bolsas' },
                ].map((frente) => {
                  const isChecked = frentesAuditor.includes(frente.id);
                  return (
                    <label
                      key={frente.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-marca-primario/10 border-marca-primario/30 text-marca-primario font-medium'
                          : 'bg-app-surface border-border text-text-secondary hover:bg-app-surface-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleFrenteAuditor(frente.id)}
                        className="rounded border-border text-marca-primario focus:ring-marca-primario/25 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span>{frente.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Líneas Asignadas solo para ALMACENISTA */}
          {isAlmacenista && (
            <div className="space-y-3 p-3.5 bg-cuadra-arena/30 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                  Líneas de Producción Autorizadas *
                </Label>
                <span className="text-2xs text-text-muted">
                  {lineasAsignadas.length} seleccionada(s)
                </span>
              </div>

              {availableLines.length > 0 ? (
                (() => {
                  const lineasBota = availableLines.filter((l) => l.area === 'BOTA');
                  const lineasAccesorios = availableLines.filter((l) => l.area !== 'BOTA');
                  const soloBolsas = frentesSurtido.length === 1 && frentesSurtido[0] === 'BOLSAS';

                  const renderLineItem = (linea: LineaProduccionSimple & { area?: string }) => {
                    const isChecked = lineasAsignadas.includes(linea.id);
                    const isBota = linea.area === 'BOTA';
                    const isBlockedForBolsas = soloBolsas && isBota;

                    return (
                      <label
                        key={linea.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs transition-colors ${
                          isBlockedForBolsas
                            ? 'opacity-40 cursor-not-allowed bg-app-surface border-border text-text-muted'
                            : isChecked
                              ? 'bg-marca-primario/10 border-marca-primario/30 text-marca-primario font-medium cursor-pointer'
                              : 'bg-app-surface border-border text-text-secondary hover:bg-app-surface-muted cursor-pointer'
                        }`}
                        title={
                          isBlockedForBolsas
                            ? 'Incompatible: Surtido exclusivo de BOLSAS no permite líneas de área BOTA'
                            : undefined
                        }
                      >
                        <input
                          type="checkbox"
                          checked={isChecked && !isBlockedForBolsas}
                          disabled={isBlockedForBolsas}
                          onChange={() => handleToggleLinea(linea.id)}
                          className="rounded border-border text-marca-primario focus:ring-marca-primario/25 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span className="truncate">{linea.nombre}</span>
                        {isBlockedForBolsas && (
                          <span className="ml-auto text-3xs font-mono text-danger">(BOTA)</span>
                        )}
                      </label>
                    );
                  };

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Columna 1: Área BOTA */}
                      <div className="p-2.5 rounded-lg border border-border/80 bg-app-surface/60 space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-border/60">
                          <span className="text-2xs font-semibold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-marca-primario inline-block"></span>
                            Área Bota
                          </span>
                          <span className="text-3xs text-text-muted">
                            {lineasBota.filter((l) => lineasAsignadas.includes(l.id)).length} / {lineasBota.length}
                          </span>
                        </div>
                        {lineasBota.length > 0 ? (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {lineasBota.map(renderLineItem)}
                          </div>
                        ) : (
                          <p className="text-2xs text-text-muted italic py-1">Sin líneas de Bota</p>
                        )}
                      </div>

                      {/* Columna 2: Área ACCESORIOS */}
                      <div className="p-2.5 rounded-lg border border-border/80 bg-app-surface/60 space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-border/60">
                          <span className="text-2xs font-semibold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cuadra-oro inline-block"></span>
                            Área Accesorios
                          </span>
                          <span className="text-3xs text-text-muted">
                            {lineasAccesorios.filter((l) => lineasAsignadas.includes(l.id)).length} / {lineasAccesorios.length}
                          </span>
                        </div>
                        {lineasAccesorios.length > 0 ? (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {lineasAccesorios.map(renderLineItem)}
                          </div>
                        ) : (
                          <p className="text-2xs text-text-muted italic py-1">Sin líneas de Accesorios</p>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <p className="text-xs text-text-muted italic">
                  {departamentoId
                    ? 'No hay líneas de producción configuradas en este departamento.'
                    : 'Selecciona un departamento para ver sus líneas de producción.'}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-xs text-danger font-medium">{error}</p>}
        </ModalBody>

        {/* Form Actions */}
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
              'Actualizar Usuario'
            ) : (
              'Crear Usuario'
            )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
