import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Search, Filter, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Edit, Trash2, Shield, UserCircle2, Check, X, ClipboardList,
  Lock, Unlock, AlertTriangle, Info, History, Settings, Clock, ShieldPlus, ShieldMinus,
  MinusCircle, RotateCcw
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { toast } from 'sonner';

// ── Supabase + Auth ───────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../contexts/AuthContext';

// PermisoKey ya no es un tipo fijo — los permisos vienen de la tabla `permisos` en la BD.
// Se usa string genérico para compatibilidad con datos dinámicos.
type PermisoKey = string;

// Estructura que devuelve la tabla `permisos`
interface DBPermiso {
  clave:       string;
  label:       string;
  descripcion: string | null;
  grupo:       'admin' | 'asociado' | 'usuario';
}

interface AuditEntry { id: string; accion: string; detalle: string; fecha: string; usuario: string; }

// Permiso mínimo que todo rol debe conservar
const PERMISOS_MINIMOS: PermisoKey[] = ['dashboard'];

// Los permisos de cada rol se leen siempre desde la base de datos (roles.permisos)
// No existen objetos hardcoded — la BD es la única fuente de verdad

interface RolesProps {
  userRole?: UserRole;
}

export default function Roles({ userRole }: RolesProps) {
  // Filtro de permisos para roles (implementado en UI de filtros)
  const [filterPermiso, setFilterPermiso] = useState<'todos' | PermisoKey>('todos');
  // Ordenación de la tabla de roles
  const [rolesSortBy, setRolesSortBy] = useState<'nombre_az'|'nombre_za'|'usuarios_desc'|'usuarios_asc'|'activo'>('nombre_az');
  // ── Usuario actual desde el contexto (no llamar getUser() aquí) ───────────
  const { user: authUser } = useAuth();
  const usuarioActualId     = authUser?.id    ?? null;
  const usuarioActualNombre = authUser?.nombre ?? 'Administrador';
  const [searchTerm, setSearchTerm]                   = useState('');
  const [currentPage, setCurrentPage]                 = useState(1);
  const [isDetailDialogOpen, setIsDetailDialogOpen]   = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen]   = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen]       = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]   = useState(false);
  const [isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen] = useState(false);
  const [isAddPermisosDialogOpen, setIsAddPermisosDialogOpen]         = useState(false);
  const [isConfirmAddDialogOpen, setIsConfirmAddDialogOpen]           = useState(false);
  const [isRemoveSelectDialogOpen, setIsRemoveSelectDialogOpen]       = useState(false);
  const [isRemovePermisoDialogOpen, setIsRemovePermisoDialogOpen]     = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [isErrorDialogOpen, setIsErrorDialogOpen]     = useState(false);
  const [resultMessage, setResultMessage]             = useState('');
  const [selectedItem, setSelectedItem]               = useState<any>(null);
  const [permisosToRemove, setPermisosToRemove]       = useState<PermisoKey[]>([]);
  const [permisosToAdd, setPermisosToAdd]             = useState<PermisoKey[]>([]);
  const [detailTab, setDetailTab]                     = useState('info');
  const [isPermisosExpanded, setIsPermisosExpanded]   = useState(true);
  const itemsPerPage = 5;

  const [auditLog, setAuditLog]           = useState<AuditEntry[]>([]);
  const [auditPage, setAuditPage]         = useState(1);
  const [auditFiltro, setAuditFiltro]     = useState('todos');
  const AUDIT_PER_PAGE = 5;

  const addAuditEntry = async (accion: string, detalle: string, registroId?: string) => {
    // Persistir en BD primero, luego actualizar estado local con el ID real
    const { data, error } = await supabase.from('auditoria').insert({
      usuario_id:  usuarioActualId,
      accion,
      tabla:       'roles',
      registro_id: registroId ?? null,
      datos_despues: { descripcion: detalle, usuario: usuarioActualNombre },
    }).select('id').single();

    if (error) console.warn('Error al guardar auditoría:', error.message);

    const entrada: AuditEntry = {
      id: data?.id ?? String(Date.now()), accion, detalle,
      fecha: new Date().toLocaleString('es-CO'), usuario: usuarioActualNombre,
    };
    setAuditLog(prev => [entrada, ...prev]);
  };

  // ── Catálogo de permisos cargado desde la BD ─────────────────────────────
  const [permisosDisponibles, setPermisosDisponibles] = useState<DBPermiso[]>([]);

  // formData — permisos es Record<clave, boolean>, construido dinámicamente desde la BD
  const [formData, setFormData] = useState({
    nombre: '', descripcion: '',
    permisos: {} as Record<string, boolean>,
  });

  // Validación en tiempo real del formulario crear/editar
  const [formErrors, setFormErrors]   = useState({ nombre: '', descripcion: '' });
  const [formTouched, setFormTouched] = useState({ nombre: false, descripcion: false });

  const validateField = (campo: 'nombre' | 'descripcion', valor: string, isEdit = false) => {
    if (campo === 'nombre') {
      if (!valor.trim()) return 'El nombre del rol es obligatorio';
      const duplicado = roles.some(r =>
        r.nombre.toLowerCase() === valor.trim().toLowerCase() &&
        (!isEdit || r.id !== selectedItem?.id)
      );
      if (duplicado) return `Ya existe un rol con el nombre "${valor.trim()}"`;
    }
    if (campo === 'descripcion') {
      if (!valor.trim()) return 'La descripción es obligatoria';
      if (valor.trim().length < 10) return 'La descripción debe tener al menos 10 caracteres';
    }
    return '';
  };

  const resetFormValidation = () => {
    setFormErrors({ nombre: '', descripcion: '' });
    setFormTouched({ nombre: false, descripcion: false });
  };

  // ── Estado Supabase ───────────────────────────────────────────────────────
  const [roles, setRoles]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { cargarRoles(); }, []);

  async function cargarRoles() {
    try {
      setLoading(true);

      const [
        { data, error },
        { data: conteos },
        { data: auditoriaData },
        { data: permisosData },
      ] = await Promise.all([
        supabase.from('roles')
          .select('id, nombre, label, descripcion, activo, es_sistema, created_at, updated_at, rol_permisos(permiso_clave, activo)')
          .order('label, nombre'),
        supabase.from('usuarios').select('rol_id').eq('activo', true),
        supabase.from('auditoria').select('*')
          .eq('tabla', 'roles')
          .not('accion', 'is', null)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(500),
        // ── Catálogo de permisos desde la tabla permisos ──────────────────────
        supabase.from('permisos')
          .select('clave, label, descripcion, grupo')
          .eq('activo', true)
          .order('grupo'),
      ]);

      if (error) throw error;

      // Guardar catálogo de permisos en estado
      const catalogoPermisos: DBPermiso[] = (permisosData ?? []) as DBPermiso[];
      setPermisosDisponibles(catalogoPermisos);

      // Mapa de conteos por rol_id
      const conteoMap: Record<string, number> = {};
      (conteos || []).forEach((u: any) => {
        if (u.rol_id) conteoMap[u.rol_id] = (conteoMap[u.rol_id] || 0) + 1;
      });

      // Mapear roles — distinguir tres estados por permiso
      const mapeados = (data || []).map((r: any) => {
        const todasLasFilas: { clave: string; activo: boolean }[] = Array.isArray(r.rol_permisos)
          ? r.rol_permisos
              .filter((rp: any) => rp.permiso_clave)
              .map((rp: any) => ({ clave: rp.permiso_clave as string, activo: rp.activo !== false }))
          : [];

        // Activos: activo = true en rol_permisos
        const permisosRaw: string[] = todasLasFilas.filter(f => f.activo).map(f => f.clave);

        // Quitados: activo = false en rol_permisos (fueron asignados y se quitaron)
        const permisosQuitados: string[] = todasLasFilas.filter(f => !f.activo).map(f => f.clave);

        // Mapa clave → boolean para compatibilidad (true = activo, false = quitado o nunca asignado)
        const permisos = Object.fromEntries(
          catalogoPermisos.map(p => [p.clave, permisosRaw.includes(p.clave)])
        ) as Record<string, boolean>;

        return {
          id:               r.id,
          nombre:           r.label ?? (r.nombre === 'admin' ? 'Administrador' : r.nombre === 'asociado' ? 'Asociado' : r.nombre),
          nombre_db:        r.nombre,
          descripcion:      r.descripcion ?? '',
          permisos,
          permisosClaves:   permisosRaw,    // solo activos
          permisosQuitados,                 // quitados (activo=false en BD)
          cantidadUsuarios: conteoMap[r.id] ?? 0,
          estado:           r.activo ?? true,
          esSistema:        r.es_sistema === true || ['admin', 'administrador', 'asociado', 'usuario'].includes(r.nombre),
          fechaCreacion:    r.created_at ? new Date(r.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : '—',
          fechaModificacion: r.updated_at ? new Date(r.updated_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : '—',
        };
      });
      setRoles(mapeados.filter(r => r.nombre_db !== 'usuario'));

      // Cargar auditoría persistida
      const auditMapeada: AuditEntry[] = (auditoriaData || []).map((a: any) => ({
        id:      a.id,
        accion:  a.accion,
        detalle: a.datos_despues?.descripcion ?? '—',
        fecha:   new Date(a.created_at).toLocaleString('es-CO'),
        usuario: a.datos_despues?.usuario ?? 'Sistema',
      }));
      setAuditLog(auditMapeada);

      return mapeados;

    } catch (err: any) {
      toast.error('Error al cargar roles: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredRoles  = roles
    .filter(r => {
      const permisos = r.permisos as any;
      const matchesPermiso = filterPermiso === 'todos' || !!permisos[filterPermiso];
      const matchesSearch = !searchTerm.trim() ||
        r.nombre.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
        r.descripcion.toLowerCase().includes(searchTerm.trim().toLowerCase());
      return matchesPermiso && matchesSearch;
    })
    .sort((a, b) => {
      if (rolesSortBy === 'nombre_az')      return a.nombre.localeCompare(b.nombre, 'es');
      if (rolesSortBy === 'nombre_za')      return b.nombre.localeCompare(a.nombre, 'es');
      if (rolesSortBy === 'usuarios_desc')  return (b.cantidadUsuarios ?? 0) - (a.cantidadUsuarios ?? 0);
      if (rolesSortBy === 'usuarios_asc')   return (a.cantidadUsuarios ?? 0) - (b.cantidadUsuarios ?? 0);
      if (rolesSortBy === 'activo')         return (b.estado ? 1 : 0) - (a.estado ? 1 : 0);
      return 0;
    });
  const totalPages     = Math.ceil(filteredRoles.length / itemsPerPage);
  const startIndex     = (currentPage - 1) * itemsPerPage;
  const endIndex       = startIndex + itemsPerPage;
  const currentRoles   = filteredRoles.slice(startIndex, endIndex);

  // ── Helpers de permisos ───────────────────────────────────────────────────
  const permisosToArray = (permisos: Record<PermisoKey, boolean>): string[] =>
    Object.entries(permisos).filter(([, v]) => v).map(([k]) => k);

  const handleViewDetails = (rol: any) => {
    if (userRole !== 'admin') {
      toast.error('Acceso denegado', { description: 'Solo los administradores pueden ver detalles de roles.' });
      return;
    }
    const rolActual = roles.find(r => r.id === rol.id);
    if (!rolActual) { toast.error('El rol seleccionado ya no está disponible.'); return; }
    setSelectedItem(rolActual);
    setDetailTab('info');
    setIsDetailDialogOpen(true);
  };

  // ── Toggle estado ─────────────────────────────────────────────────────────
  const handleToggleEstado = async (id: string) => {
    const rol = roles.find(r => r.id === id);
    if (!rol) { setResultMessage('Error: No se pudo encontrar el rol.'); setIsErrorDialogOpen(true); return; }

    if (rol.esSistema) {
      setResultMessage(`El rol "${rol.nombre}" es un rol del sistema. Su estado no puede modificarse para garantizar el funcionamiento del sistema.`);
      setIsErrorDialogOpen(true); setIsToggleEstadoDialogOpen(false); setSelectedItem(null); return;
    }

    try {
      const { error } = await supabase.from('roles').update({ activo: !rol.estado }).eq('id', id);
      if (error) throw error;
      setRoles(prev => prev.map(r => r.id === id ? { ...r, estado: !r.estado } : r));
      await addAuditEntry(!rol.estado ? 'ROL ACTIVADO' : 'ROL DESACTIVADO',
        `El rol "${rol.nombre}" fue ${!rol.estado ? 'activado' : 'desactivado'} por ${usuarioActualNombre} el ${new Date().toLocaleString('es-CO')}`,
        id);
      await cargarRoles();
      toast.success(`${!rol.estado ? '✅ Rol activado' : '⏸️ Rol desactivado'}`, {
        description: `"${rol.nombre}" ha sido ${!rol.estado ? 'activado' : 'desactivado'} exitosamente`, duration: 4000,
      });
    } catch (err: any) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
    setIsToggleEstadoDialogOpen(false); setSelectedItem(null);
  };

  const handleOpenCreate = () => {
    setFormData({
      nombre: '', descripcion: '',
      permisos: Object.fromEntries(permisosDisponibles.map(p => [p.clave, false])),
    });
    resetFormValidation();
    setIsCreateDialogOpen(true);
  };

  const handleOpenEdit = (rol: any) => {
    const rolActual = roles.find(r => r.id === rol.id);
    if (!rolActual) { toast.error('El rol ya no está disponible.'); return; }
    setSelectedItem(rolActual);
    setFormData({
      nombre: rolActual.nombre,
      descripcion: rolActual.descripcion,
      permisos: Object.fromEntries(
        permisosDisponibles.map(p => [p.clave, !!rolActual.permisos[p.clave]])
      ),
    });
    resetFormValidation();
    setIsEditDialogOpen(true);
  };

  // ── Crear rol ─────────────────────────────────────────────────────────────
  const handleCreateRol = async () => {
    const nombreTrim = formData.nombre.trim();
    const descTrim   = formData.descripcion.trim();
    if (!nombreTrim) { toast.error('Error: El nombre del rol es obligatorio.'); return; }
    if (!descTrim)   { toast.error('Error: La descripción del rol es obligatoria.'); return; }

    const duplicado = roles.some(r => r.nombre.toLowerCase() === nombreTrim.toLowerCase());
    if (duplicado) { toast.error(`Error: Ya existe un rol con el nombre "${nombreTrim}".`); return; }

    const permisosActivos = Object.values(formData.permisos).filter(v => v).length;
    if (permisosActivos === 0) { toast.error('Error: Debe seleccionar al menos un permiso.'); return; }

    try {
      const clavesSeleccionadas = permisosToArray(formData.permisos);
      // Crear el rol (sin la columna permisos jsonb — se usa rol_permisos)
      const { data, error } = await supabase.from('roles')
        .insert({ nombre: nombreTrim.toLowerCase(), label: nombreTrim, descripcion: descTrim, activo: true })
        .select().single();
      if (error) throw error;

      // Insertar permisos en la tabla relacional
      if (clavesSeleccionadas.length > 0) {
        const inserts = clavesSeleccionadas.map(clave => ({ rol_id: data.id, permiso_clave: clave }));
        const { error: permError } = await supabase.from('rol_permisos').insert(inserts);
        if (permError) throw permError;
      }

      const rolesActualizados = await cargarRoles();
      const rolNuevo = rolesActualizados?.find((r: any) => r.id === data.id);
      if (rolNuevo) setSelectedItem(rolNuevo);

      addAuditEntry('ROL CREADO', `Se creó el rol "${nombreTrim}" con ${permisosActivos} permisos por ${usuarioActualNombre}`, data.id);
      toast.success('✅ Rol creado exitosamente', {
        description: `"${nombreTrim}" con ${permisosActivos} de ${permisosDisponibles.length} permisos`, duration: 4000,
      });
      setIsCreateDialogOpen(false);
    } catch (err: any) {
      toast.error('Error al crear rol: ' + err.message);
    }
  };

  // ── Editar rol ────────────────────────────────────────────────────────────
  const handleEditRol = async () => {
    if (!selectedItem) { setResultMessage('No se ha seleccionado ningún rol.'); setIsErrorDialogOpen(true); return; }
    const rolActual = roles.find(r => r.id === selectedItem.id);
    if (!rolActual) { setResultMessage('El rol ya no existe.'); setIsErrorDialogOpen(true); setIsEditDialogOpen(false); setSelectedItem(null); return; }

    const nombreTrim = formData.nombre.trim();
    const descTrim   = formData.descripcion.trim();
    if (!nombreTrim) { setResultMessage('El nombre es obligatorio.'); setIsErrorDialogOpen(true); return; }
    if (!descTrim)   { setResultMessage('La descripción es obligatoria.'); setIsErrorDialogOpen(true); return; }

    const duplicado = roles.some(r => r.nombre.toLowerCase() === nombreTrim.toLowerCase() && r.id !== selectedItem.id);
    if (duplicado) { setResultMessage(`Ya existe otro rol con el nombre "${nombreTrim}".`); setIsErrorDialogOpen(true); return; }

    const permisosActivos = Object.values(formData.permisos).filter(v => v).length;
    if (permisosActivos === 0) { setResultMessage('El rol debe tener al menos un permiso.'); setIsErrorDialogOpen(true); return; }

    // B4: verificar permisos mínimos obligatorios
    const faltanMinimos = PERMISOS_MINIMOS.filter(m => !formData.permisos[m]);
    if (faltanMinimos.length > 0) {
      const labels = faltanMinimos.map(m => permisosDisponibles.find(p => p.clave === m)?.label ?? m).join(', ');
      setResultMessage(`El rol debe incluir los permisos mínimos obligatorios: ${labels}`);
      setIsErrorDialogOpen(true); return;
    }

    const snapId = selectedItem.id;
    const clavesSeleccionadas = permisosToArray(formData.permisos);
    try {
      // 1. Actualizar metadatos del rol
      const updatePayload: any = { descripcion: descTrim, label: nombreTrim };
      if (!selectedItem.esSistema) updatePayload.nombre = nombreTrim.toLowerCase();

      const { error } = await supabase.from('roles').update(updatePayload).eq('id', snapId);
      if (error) throw error;

      // 2. Reemplazar permisos en rol_permisos (B3: solo si no es rol de sistema)
      if (!selectedItem.esSistema) {
        const { error: delError } = await supabase.from('rol_permisos').delete().eq('rol_id', snapId);
        if (delError) throw delError;
        if (clavesSeleccionadas.length > 0) {
          const inserts = clavesSeleccionadas.map(clave => ({ rol_id: snapId, permiso_clave: clave }));
          const { error: permError } = await supabase.from('rol_permisos').insert(inserts);
          if (permError) throw permError;
        }
      }

      // 3. Recargar desde BD y reflejar en selectedItem
      const rolesActualizados = await cargarRoles();
      const rolActualizado = rolesActualizados?.find((r: any) => r.id === snapId);
      if (rolActualizado) setSelectedItem(rolActualizado);

      addAuditEntry('ROL EDITADO', `Se actualizó "${nombreTrim}" por ${usuarioActualNombre}`, snapId);
      toast.success('✏️ Rol actualizado exitosamente', {
        description: `"${nombreTrim}" con ${clavesSeleccionadas.length} permisos`, duration: 4000,
      });
      setIsEditDialogOpen(false);
    } catch (err: any) {
      toast.error('Error al actualizar rol: ' + err.message);
    }
  };

  // ── Eliminar rol ──────────────────────────────────────────────────────────
  const handleDeleteRol = async () => {
    if (!selectedItem) { toast.error('No se ha seleccionado ningún rol.'); setIsDeleteDialogOpen(false); return; }

    const rolActual = roles.find(r => r.id === selectedItem.id);
    if (!rolActual) { toast.error('El rol ya no existe.'); setIsDeleteDialogOpen(false); setSelectedItem(null); return; }

    // Bloqueo 1: roles del sistema (admin, asociado, usuario)
    if (rolActual.esSistema) {
      toast.error('Rol del sistema protegido', {
        description: `El rol "${rolActual.nombre}" es esencial para el funcionamiento del sistema y no puede eliminarse.`,
      });
      setIsDeleteDialogOpen(false); setSelectedItem(null); return;
    }

    // Bloqueo 2: verificar usuarios activos en BD (doble verificación)
    const { data: usuariosConRol, error: checkErr } = await supabase
      .from('usuarios')
      .select('id')
      .eq('rol_id', selectedItem.id)
      .eq('activo', true)
      .limit(1);

    if (checkErr) {
      console.warn('No se pudo verificar usuarios del rol:', checkErr.message);
    }

    const tieneUsuarios = (usuariosConRol?.length ?? 0) > 0 || rolActual.cantidadUsuarios > 0;

    if (tieneUsuarios) {
      const total = usuariosConRol?.length ?? rolActual.cantidadUsuarios;
      toast.error(`No se puede eliminar el rol "${rolActual.nombre}"`, {
        description: `Tiene ${total} usuario(s) activo(s). Reasígnalos primero.`,
        duration: 6000,
      });
      setIsDeleteDialogOpen(false); setSelectedItem(null); return;
    }

    // Proceder con la eliminación — primero borrar permisos relacionados (B2: capturar error)
    const { error: permDelError } = await supabase.from('rol_permisos').delete().eq('rol_id', selectedItem.id);
    if (permDelError) {
      toast.error('Error al eliminar permisos del rol: ' + permDelError.message);
      setIsDeleteDialogOpen(false); setSelectedItem(null); return;
    }

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', selectedItem.id);

    if (error) {
      toast.error('Error al eliminar rol: ' + error.message);
      setIsDeleteDialogOpen(false); setSelectedItem(null); return;
    }

    // Verificar que realmente se eliminó (RLS puede bloquear silenciosamente)
    const { data: verificacion } = await supabase
      .from('roles')
      .select('id')
      .eq('id', selectedItem.id)
      .maybeSingle();

    if (verificacion) {
      toast.error('No se pudo eliminar el rol', {
        description: 'La base de datos rechazó la operación. Ejecuta en Supabase SQL Editor: ALTER TABLE roles DISABLE ROW LEVEL SECURITY;',
        duration: 8000,
      });
      setIsDeleteDialogOpen(false); setSelectedItem(null); return;
    }

    setRoles(prev => prev.filter(r => r.id !== selectedItem.id));
    await addAuditEntry(
      'ROL ELIMINADO',
      `El rol "${rolActual.nombre}" fue eliminado permanentemente por ${usuarioActualNombre}`,
    );
    await cargarRoles();
    toast.success('Rol eliminado exitosamente', {
      description: `"${rolActual.nombre}" eliminado del sistema`, duration: 4000,
    });
    setIsDeleteDialogOpen(false); setSelectedItem(null);
  };

  const handlePermisoChange = (permiso: PermisoKey) => {
    setFormData(prev => ({ ...prev, permisos: { ...prev.permisos, [permiso]: !prev.permisos[permiso] } }));
  };

  // ── Agregar/quitar permisos desde vista detalle ───────────────────────────
  const handleOpenAddPermisos = () => {
    if (!selectedItem) return;
    setPermisosToAdd([]);
    setIsAddPermisosDialogOpen(true);
  };

  // Paso 1: validar selección y pedir confirmación
  const handleConfirmAddPermisos = () => {
    if (!selectedItem) return;
    if (permisosToAdd.length === 0) { toast.error('Debe seleccionar al menos un permiso.'); return; }
    const yaExisten = permisosToAdd.filter(p => selectedItem.permisos[p]);
    if (yaExisten.length > 0) { toast.error('Algunos permisos ya están asignados.'); return; }
    // Cerrar selección y abrir confirmación
    setIsAddPermisosDialogOpen(false);
    setIsConfirmAddDialogOpen(true);
  };

  // Paso 2: guardar después de confirmar
  const handleExecuteAddPermisos = async () => {
    if (!selectedItem || permisosToAdd.length === 0) return;
    const snapId       = selectedItem.id;
    const snapNombre   = selectedItem.nombre;
    const snapAdd      = [...permisosToAdd];
    const snapClaves   = [...(selectedItem.permisosClaves ?? [])];
    setIsConfirmAddDialogOpen(false);
    setPermisosToAdd([]);
    try {
      // Upsert en rol_permisos: si ya existe el registro (aunque esté inactivo), lo reactiva (activo=true)
      // Si no existe, lo inserta nuevo. Así se puede volver a agregar un permiso que fue quitado.
      const inserts = snapAdd.map(clave => ({ rol_id: snapId, permiso_clave: clave, activo: true }));
      const { error } = await supabase.from('rol_permisos')
        .upsert(inserts, { onConflict: 'rol_id,permiso_clave' });
      if (error) throw error;

      // Recargar desde BD y reflejar en selectedItem
      const rolesActualizados = await cargarRoles();
      const rolActualizado = rolesActualizados?.find((r: any) => r.id === snapId);
      if (rolActualizado) setSelectedItem(rolActualizado);

      const labels = snapAdd.map(p => permisosDisponibles.find(c => c.clave === p)?.label ?? p).join(', ');
      addAuditEntry('PERMISOS AGREGADOS', `Permisos agregados a "${snapNombre}": ${labels} por ${usuarioActualNombre}`, snapId);
      toast.success(`${snapAdd.length} permiso(s) agregado(s)`, { duration: 4000 });
    } catch (err: any) {
      toast.error('Error al agregar permisos: ' + err.message);
    }
  };

  const handleTogglePermisoToRemove = (permisoKey: PermisoKey) => {
    setPermisosToRemove(prev =>
      prev.includes(permisoKey)
        ? prev.filter(k => k !== permisoKey)
        : [...prev, permisoKey]
    );
  };

  const handleOpenRemovePermisos = () => {
    if (!selectedItem || permisosToRemove.length === 0) return;
    const activos = Object.entries(selectedItem.permisos).filter(([, v]) => v).map(([k]) => k as PermisoKey);
    const restantes = activos.filter(k => !permisosToRemove.includes(k));

    if (restantes.length === 0) {
      toast.error('No se pueden eliminar todos los permisos del rol.', {
        description: 'El rol debe conservar al menos un permiso activo.',
      });
      return;
    }
    const faltanMinimos = PERMISOS_MINIMOS.filter(m => !restantes.includes(m));
    if (faltanMinimos.length > 0) {
      const labels = faltanMinimos.map(m => permisosDisponibles.find(p => p.clave === m)?.label ?? m).join(', ');
      toast.error('Acción bloqueada: acceso mínimo requerido', {
        description: `No se puede eliminar porque el rol quedaría sin: ${labels}`,
        duration: 5000,
      });
      return;
    }
    setIsRemovePermisoDialogOpen(true);
  };

  const handleConfirmRemovePermiso = async () => {
    if (!selectedItem || permisosToRemove.length === 0) return;
    const snapId       = selectedItem.id;
    const snapNombre   = selectedItem.nombre;
    const snapRemove   = [...permisosToRemove];
    const snapClaves   = [...(selectedItem.permisosClaves ?? [])];
    setIsRemovePermisoDialogOpen(false);
    setPermisosToRemove([]);
    try {
      // Desactivar permisos (activo = false) — no se elimina de BD, solo se quita del rol
      const { error } = await supabase.from('rol_permisos')
        .update({ activo: false })
        .eq('rol_id', snapId)
        .in('permiso_clave', snapRemove);
      if (error) throw error;

      // Recargar desde BD y reflejar en selectedItem
      const rolesActualizados = await cargarRoles();
      const rolActualizado = rolesActualizados?.find((r: any) => r.id === snapId);
      if (rolActualizado) setSelectedItem(rolActualizado);

      const labels = snapRemove.map(k => permisosDisponibles.find(p => p.clave === k)?.label ?? k).join(', ');
      addAuditEntry(
        'PERMISO(S) QUITADO(S)',
        `Se quitaron ${snapRemove.length} permiso(s) de "${snapNombre}": ${labels} — por ${usuarioActualNombre}`,
        snapId,
      );
      toast.success(`${snapRemove.length} permiso(s) quitado(s) del rol`, { duration: 4000 });
    } catch (err: any) {
      toast.error('Error al eliminar permisos: ' + err.message);
    }
  };

  // Badges: muestra los permisos activos con labels desde el catálogo de la BD
  const getPermisosBadges = (permisos: Record<string, boolean>) =>
    Object.entries(permisos)
      .filter(([, v]) => v)
      .map(([clave]) => (
        <Badge key={clave} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          {permisosDisponibles.find(p => p.clave === clave)?.label ?? clave}
        </Badge>
      ));

  const getPermisosActivosCount = (permisos: Record<string, boolean>) =>
    Object.values(permisos).filter(Boolean).length;

  // Total de permisos disponibles según el catálogo de la BD
  const getTotalPermisosAplicables = () => permisosDisponibles.length;


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando roles...</p>
        </div>
      </div>
    );
  }

  // ── JSX original desde aquí (sin cambios) ────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2 flex items-center gap-3">
              <Shield className="size-8 text-emerald-600" />
              Gestión de Roles
            </h1>
            <p className="text-slate-600">Configura los roles y permisos del sistema UFCA</p>
          </div>
          <Button 
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleOpenCreate}
          >
            <Plus className="size-4" />
            Nuevo rol
          </Button>
        </div>

        <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <CardTitle>Lista de Roles</CardTitle>
                <p className="text-sm text-slate-500 mt-1">Haz clic en cualquier fila para ver los detalles completos</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                <div className="relative flex-1 sm:flex-none sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por nombre..."
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="pl-9"
                  />
                </div>
                <Select value={filterPermiso} onValueChange={v => { setFilterPermiso(v as PermisoKey | 'todos'); setCurrentPage(1); }}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Permisos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {permisosDisponibles.map(p => (
                      <SelectItem key={p.clave} value={p.clave}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={rolesSortBy} onValueChange={v => { setRolesSortBy(v as typeof rolesSortBy); setCurrentPage(1); }}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nombre_az">Nombre A→Z</SelectItem>
                    <SelectItem value="nombre_za">Nombre Z→A</SelectItem>
                    <SelectItem value="usuarios_desc">Más usuarios primero</SelectItem>
                    <SelectItem value="usuarios_asc">Menos usuarios primero</SelectItem>
                    <SelectItem value="activo">Activos primero</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-200 overflow-hidden max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rol</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Permisos</TableHead>
                    <TableHead>Usuarios</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right w-48">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentRoles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                          <Shield className="size-12 opacity-30" />
                          <div>
                            <p className="font-medium">No se encontraron roles</p>
                            <p className="text-sm">
                              {searchTerm
                                ? `No hay resultados para "${searchTerm}". Intenta con otros términos de búsqueda.`
                                : filterPermiso !== 'todos'
                                  ? 'No hay roles con el permiso seleccionado.'
                                  : 'Aún no hay roles registrados en el sistema.'}
                            </p>
                          </div>
                          {(searchTerm || filterPermiso !== 'todos') && (
                            <Button variant="outline" size="sm" onClick={() => { setSearchTerm(''); setFilterPermiso('todos'); setCurrentPage(1); }}>
                              Limpiar filtros
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentRoles.map((rol) => (
                      <TableRow 
                        key={rol.id}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => handleViewDetails(rol)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              rol.nombre === 'Administrador' ? 'bg-emerald-100' 
                              : rol.nombre === 'Asociado' ? 'bg-blue-100' 
                              : 'bg-purple-100'
                            }`}>
                              {rol.nombre === 'Administrador' ? (
                                <Shield className="size-4 text-emerald-600" />
                              ) : (
                                <UserCircle2 className={`size-4 ${
                                  rol.nombre === 'Asociado' ? 'text-blue-600' : 'text-purple-600'
                                }`} />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{rol.nombre}</p>
                              {rol.esSistema && (
                                <Badge variant="outline" className="mt-1 text-xs bg-slate-100 text-slate-600">
                                  Rol del sistema
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-slate-600 line-clamp-2 max-w-md">{rol.descripcion}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {getPermisosBadges(rol.permisos).slice(0, 2)}
                            {getPermisosActivosCount(rol.permisos) > 2 && (
                              <Badge variant="outline" className="bg-slate-50">
                                +{getPermisosActivosCount(rol.permisos) - 2} más
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            {rol.cantidadUsuarios}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {rol.nombre_db === 'admin' ? (
                              /* Administrador: rol protegido, siempre activo, sin opciones */
                              <div className="flex items-center gap-2" title="El rol Administrador no puede modificarse">
                                <Lock className="size-3.5 text-slate-400" />
                                <span className="text-sm text-slate-500">Siempre activo</span>
                              </div>
                            ) : rol.esSistema ? (
                              /* Otros roles del sistema: estado fijo, no se puede cambiar */
                              <div className="flex items-center gap-2" title="El estado de los roles del sistema no puede modificarse">
                                <Lock className="size-3.5 text-slate-400" />
                                <span className="text-sm text-slate-500">Siempre activo</span>
                              </div>
                            ) : (
                              <>
                                <Switch
                                  checked={rol.estado}
                                  onCheckedChange={() => {
                                    setSelectedItem(rol);
                                    setIsToggleEstadoDialogOpen(true);
                                  }}
                                />
                                <span className="text-sm text-slate-600">
                                  {rol.estado ? 'Activo' : 'Inactivo'}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1.5 justify-end">
                            {rol.nombre_db === 'admin' ? (
                              /* Administrador: rol protegido, no se muestran acciones */
                              <span className="text-xs text-slate-400 italic">Rol protegido</span>
                            ) : (
                              <>
                                {/* Agregar permiso */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedItem(rol);
                                    setPermisosToAdd([]);
                                    setIsAddPermisosDialogOpen(true);
                                  }}
                                  title={permisosDisponibles.every(p => rol.permisos[p.clave]) ? 'El rol ya tiene todos los permisos' : 'Agregar permiso'}
                                  disabled={permisosDisponibles.every(p => rol.permisos[p.clave])}
                                  className={permisosDisponibles.every(p => rol.permisos[p.clave]) ? 'opacity-40 cursor-not-allowed' : 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300'}
                                >
                                  <ShieldPlus className="size-4" />
                                </Button>
                                {/* Quitar permiso */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedItem(rol);
                                    setPermisosToRemove([]);
                                    setIsRemoveSelectDialogOpen(true);
                                  }}
                                  title={getPermisosActivosCount(rol.permisos) <= 1 ? 'Debe conservar al menos un permiso' : 'Quitar permiso del rol'}
                                  disabled={getPermisosActivosCount(rol.permisos) <= 1}
                                  className={getPermisosActivosCount(rol.permisos) <= 1 ? 'opacity-40 cursor-not-allowed' : 'text-orange-600 hover:bg-orange-50 hover:border-orange-300'}
                                >
                                  <ShieldMinus className="size-4" />
                                </Button>
                                {/* Editar — permitido, pero campos protegidos dentro del diálogo */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenEdit(rol)}
                                  title={rol.esSistema ? 'Solo se puede editar la descripción' : 'Editar rol'}
                                >
                                  <Edit className="size-4" />
                                </Button>
                                {/* Eliminar — solo roles personalizados sin usuarios activos */}
                                {!rol.esSistema && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => { setSelectedItem(rol); setIsDeleteDialogOpen(true); }}
                                    title={rol.cantidadUsuarios > 0 ? `No se puede eliminar: tiene ${rol.cantidadUsuarios} usuario(s) activo(s)` : 'Eliminar rol'}
                                    disabled={rol.cantidadUsuarios > 0}
                                    className={rol.cantidadUsuarios > 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-red-50 hover:border-red-300'}
                                  >
                                    <Trash2 className="size-4 text-red-500" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            {filteredRoles.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-slate-600">
                  Mostrando {startIndex + 1} a {Math.min(endIndex, filteredRoles.length)} de {filteredRoles.length} roles
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={currentPage === page ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== HISTORIAL DE CAMBIOS ===== */}
        {(() => {
          const auditFiltrado  = auditFiltro === 'todos' ? auditLog : auditLog.filter(e => e.accion === auditFiltro);
          const auditTotalPags = Math.ceil(auditFiltrado.length / AUDIT_PER_PAGE);
          const auditPagina    = auditFiltrado.slice((auditPage - 1) * AUDIT_PER_PAGE, auditPage * AUDIT_PER_PAGE);

          const ACTION_CFG: Record<string, { icon: JSX.Element; color: string; bg: string; border: string; dot: string }> = {
            'ROL CREADO':            { icon: <Plus className="size-3.5" />,       color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500' },
            'ROL EDITADO':           { icon: <Edit className="size-3.5" />,       color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',    dot: 'bg-blue-500'    },
            'ROL ELIMINADO':         { icon: <Trash2 className="size-3.5" />,     color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     dot: 'bg-red-500'     },
            'ROL ACTIVADO':          { icon: <Unlock className="size-3.5" />,     color: 'text-green-700',   bg: 'bg-green-50',    border: 'border-green-200',   dot: 'bg-green-500'   },
            'ROL DESACTIVADO':       { icon: <Lock className="size-3.5" />,       color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200',  dot: 'bg-orange-500'  },
            'PERMISOS AGREGADOS':    { icon: <ShieldPlus className="size-3.5" />, color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',    dot: 'bg-blue-400'    },
            'PERMISO(S) QUITADO(S)': { icon: <ShieldMinus className="size-3.5" />,color: 'text-amber-700',  bg: 'bg-amber-50',    border: 'border-amber-200',   dot: 'bg-amber-500'   },
            'HISTORIAL LIMPIADO':    { icon: <RotateCcw className="size-3.5" />,  color: 'text-slate-600',   bg: 'bg-slate-50',    border: 'border-slate-200',   dot: 'bg-slate-400'   },
          };
          const getCfg = (accion: string | null) =>
            ACTION_CFG[accion ?? ''] ?? { icon: <History className="size-3.5" />, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', dot: 'bg-slate-400' };

          const conteoPorAccion = auditLog.reduce((acc, e) => {
            const k = e.accion ?? 'SIN_ACCION';
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          return (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                      <History className="size-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle>Historial de Cambios</CardTitle>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Últimos 30 días · {auditLog.length} registro{auditLog.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chips de filtro por tipo de acción */}
                {auditLog.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => { setAuditFiltro('todos'); setAuditPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        auditFiltro === 'todos'
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      Todos
                      <span className={`font-bold ${auditFiltro === 'todos' ? 'text-slate-300' : 'text-slate-400'}`}>
                        {auditLog.length}
                      </span>
                    </button>
                    {Object.entries(conteoPorAccion).map(([accion, count]) => {
                      const cfg = getCfg(accion);
                      const activo = auditFiltro === accion;
                      return (
                        <button
                          key={accion}
                          onClick={() => { setAuditFiltro(activo ? 'todos' : accion); setAuditPage(1); }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                            activo
                              ? `${cfg.bg} ${cfg.border} ${cfg.color} ring-2 ring-offset-1 ring-current/40`
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className={`size-2 rounded-full shrink-0 ${cfg.dot}`} />
                          {accion}
                          <span className={`font-bold ${activo ? '' : 'text-slate-400'}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardHeader>

              <CardContent>
                {auditLog.length === 0 ? (
                  <div className="text-center py-14">
                    <div className="inline-flex items-center justify-center size-14 rounded-full bg-slate-100 mb-4">
                      <History className="size-7 text-slate-300" />
                    </div>
                    <p className="font-medium text-slate-500">Sin registros aún</p>
                    <p className="text-sm text-slate-400 mt-1">Los cambios en roles aparecerán aquí automáticamente</p>
                  </div>
                ) : auditFiltrado.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-slate-400">Sin registros para esta acción.</p>
                    <button
                      onClick={() => { setAuditFiltro('todos'); setAuditPage(1); }}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Ver todos los registros
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Timeline */}
                    <div className="relative pl-1">
                      {/* Línea vertical conectora */}
                      <div className="absolute left-[19px] top-5 bottom-5 w-px bg-slate-200 dark:bg-slate-700" />

                      <div className="space-y-3">
                        {auditPagina.map((entry) => {
                          const cfg = getCfg(entry.accion);
                          return (
                            <div key={entry.id} className="relative flex gap-3 items-start group">
                              {/* Ícono de acción */}
                              <div className={`relative z-10 flex items-center justify-center size-10 rounded-full border-2 border-white shadow-sm shrink-0 ${cfg.bg}`}>
                                <span className={cfg.color}>{cfg.icon}</span>
                              </div>

                              {/* Tarjeta de contenido */}
                              <div className={`flex-1 p-3.5 rounded-xl border transition-shadow group-hover:shadow-sm ${cfg.bg} ${cfg.border}`}>
                                <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                                  <span className={`text-[11px] font-bold uppercase tracking-wider ${cfg.color}`}>
                                    {entry.accion ?? '—'}
                                  </span>
                                  <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                                    <Clock className="size-3" />
                                    {entry.fecha}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">{entry.detalle}</p>
                                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-current/10">
                                  <UserCircle2 className={`size-3.5 ${cfg.color} opacity-70`} />
                                  <span className="text-xs text-slate-500">
                                    <span className="font-semibold text-slate-600">{entry.usuario}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Paginación */}
                    {auditTotalPags > 1 && (
                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-500">
                          {(auditPage - 1) * AUDIT_PER_PAGE + 1}–{Math.min(auditPage * AUDIT_PER_PAGE, auditFiltrado.length)} de {auditFiltrado.length} registro{auditFiltrado.length !== 1 ? 's' : ''}
                          {auditFiltro !== 'todos' && (
                            <button
                              onClick={() => { setAuditFiltro('todos'); setAuditPage(1); }}
                              className="ml-2 text-blue-600 hover:underline"
                            >
                              Ver todos
                            </button>
                          )}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setAuditPage(1)}
                            disabled={auditPage === 1}
                            className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >«</button>
                          <button
                            onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                            disabled={auditPage === 1}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >‹ Ant.</button>
                          <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">
                            {auditPage} / {auditTotalPags}
                          </span>
                          <button
                            onClick={() => setAuditPage(p => Math.min(auditTotalPags, p + 1))}
                            disabled={auditPage === auditTotalPags}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >Sig. ›</button>
                          <button
                            onClick={() => setAuditPage(auditTotalPags)}
                            disabled={auditPage === auditTotalPags}
                            className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >»</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* ===== MODAL CREAR ROL ===== */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5 text-emerald-600" />
              Crear Nuevo Rol
            </DialogTitle>
            <DialogDescription>
              Define el nombre, descripción y permisos. El nombre debe ser único. Selecciona al menos un permiso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre del rol *</Label>
                <Input
                  id="nombre"
                  placeholder="Ej: Contador, Vendedor, Supervisor..."
                  value={formData.nombre}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, nombre: val }));
                    if (formTouched.nombre) {
                      setFormErrors(prev => ({ ...prev, nombre: validateField('nombre', val) }));
                    }
                  }}
                  onBlur={() => {
                    setFormTouched(prev => ({ ...prev, nombre: true }));
                    setFormErrors(prev => ({ ...prev, nombre: validateField('nombre', formData.nombre) }));
                  }}
                  className={formTouched.nombre && formErrors.nombre ? 'border-red-400 focus-visible:ring-red-400' : ''}
                />
                {formTouched.nombre && formErrors.nombre && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertTriangle className="size-3 shrink-0" />
                    {formErrors.nombre}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción *</Label>
                <Textarea
                  id="descripcion"
                  placeholder="Describe las responsabilidades y alcance de este rol..."
                  rows={3}
                  value={formData.descripcion}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, descripcion: val }));
                    if (formTouched.descripcion) {
                      setFormErrors(prev => ({ ...prev, descripcion: validateField('descripcion', val) }));
                    }
                  }}
                  onBlur={() => {
                    setFormTouched(prev => ({ ...prev, descripcion: true }));
                    setFormErrors(prev => ({ ...prev, descripcion: validateField('descripcion', formData.descripcion) }));
                  }}
                  className={formTouched.descripcion && formErrors.descripcion ? 'border-red-400 focus-visible:ring-red-400' : ''}
                />
                {formTouched.descripcion && formErrors.descripcion && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertTriangle className="size-3 shrink-0" />
                    {formErrors.descripcion}
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-slate-900">Permisos del rol *</h4>
                <Badge variant="outline" className={
                  Object.values(formData.permisos).filter(v => v).length > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }>
                  {Object.values(formData.permisos).filter(v => v).length} seleccionado(s)
                </Badge>
              </div>
              {Object.values(formData.permisos).filter(v => v).length === 0 && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-sm">
                  <AlertTriangle className="size-4 shrink-0" />
                  Debe seleccionar al menos un permiso para el rol
                </div>
              )}
              {(['admin', 'asociado', 'usuario'] as const).map(grupo => {
                const grupoPermisos = permisosDisponibles.filter(p => p.grupo === grupo);
                const grupoLabel = grupo === 'admin' ? 'Administración del sistema' : grupo === 'asociado' ? 'Módulos del asociado' : 'Usuario en espera';
                const grupoColor = grupo === 'admin' ? 'text-blue-700 bg-blue-50 border-blue-200' : grupo === 'asociado' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-50 border-slate-200';
                return (
                  <div key={grupo} className="space-y-2">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-semibold uppercase tracking-wide ${grupoColor}`}>
                      <Shield className="size-3" />
                      {grupoLabel}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {grupoPermisos.map((permiso) => (
                        <div
                          key={permiso.clave}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            formData.permisos[permiso.clave]
                              ? 'bg-emerald-50 border-emerald-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                          onClick={() => handlePermisoChange(permiso.clave)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2">
                              <Checkbox
                                checked={!!formData.permisos[permiso.clave]}
                                onCheckedChange={() => handlePermisoChange(permiso.clave)}
                              />
                              <div>
                                <Label className="cursor-pointer text-sm">{permiso.label}</Label>
                                {permiso.descripcion && (
                                  <p className="text-xs text-slate-400 mt-0.5">{permiso.descripcion}</p>
                                )}
                              </div>
                            </div>
                            {formData.permisos[permiso.clave] && (
                              <Check className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateRol}>
              Crear rol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL EDITAR ROL ===== */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open: boolean) => {
        setIsEditDialogOpen(open);
        // No resetear selectedItem — el panel de detalles debe seguir abierto tras editar
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="size-5 text-emerald-600" />
              Editar Rol: {selectedItem?.nombre}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.esSistema
                ? 'Rol del sistema — solo se puede editar la descripción.'
                : 'Modifica el nombre, descripción y permisos. El nombre debe ser único en el sistema.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Aviso para roles del sistema */}
            {selectedItem?.esSistema && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <Lock className="size-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Rol protegido del sistema</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    El nombre y los permisos de este rol no pueden cambiarse porque el sistema depende de ellos para funcionar correctamente. Solo puedes editar la descripción.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nombre">
                  Nombre del rol *
                  {selectedItem?.esSistema && <span className="ml-2 text-xs text-slate-400">(protegido)</span>}
                </Label>
                <Input
                  id="edit-nombre"
                  value={formData.nombre}
                  onChange={(e) => {
                    if (selectedItem?.esSistema) return;
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, nombre: val }));
                    if (formTouched.nombre) {
                      setFormErrors(prev => ({ ...prev, nombre: validateField('nombre', val, true) }));
                    }
                  }}
                  onBlur={() => {
                    if (selectedItem?.esSistema) return;
                    setFormTouched(prev => ({ ...prev, nombre: true }));
                    setFormErrors(prev => ({ ...prev, nombre: validateField('nombre', formData.nombre, true) }));
                  }}
                  disabled={selectedItem?.esSistema}
                  className={
                    selectedItem?.esSistema
                      ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                      : formTouched.nombre && formErrors.nombre
                        ? 'border-red-400 focus-visible:ring-red-400'
                        : ''
                  }
                />
                {!selectedItem?.esSistema && formTouched.nombre && formErrors.nombre && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertTriangle className="size-3 shrink-0" />
                    {formErrors.nombre}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-descripcion">Descripción *</Label>
                <Textarea
                  id="edit-descripcion"
                  rows={3}
                  value={formData.descripcion}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, descripcion: val }));
                    if (formTouched.descripcion) {
                      setFormErrors(prev => ({ ...prev, descripcion: validateField('descripcion', val) }));
                    }
                  }}
                  onBlur={() => {
                    setFormTouched(prev => ({ ...prev, descripcion: true }));
                    setFormErrors(prev => ({ ...prev, descripcion: validateField('descripcion', formData.descripcion) }));
                  }}
                  className={formTouched.descripcion && formErrors.descripcion ? 'border-red-400 focus-visible:ring-red-400' : ''}
                />
                {formTouched.descripcion && formErrors.descripcion && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertTriangle className="size-3 shrink-0" />
                    {formErrors.descripcion}
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className={`font-semibold ${selectedItem?.esSistema ? 'text-slate-400' : 'text-slate-900'}`}>
                  Permisos del rol *
                  {selectedItem?.esSistema && <span className="ml-2 text-xs font-normal">(protegidos)</span>}
                </h4>
                <Badge variant="outline" className={
                  Object.values(formData.permisos).filter(v => v).length > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }>
                  {Object.values(formData.permisos).filter(v => v).length} seleccionado(s)
                </Badge>
              </div>
              {Object.values(formData.permisos).filter(v => v).length === 0 && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-sm">
                  <AlertTriangle className="size-4 shrink-0" />
                  Debe mantener al menos un permiso activo
                </div>
              )}
              {(['admin', 'asociado', 'usuario'] as const).map(grupo => {
                const grupoPermisos = permisosDisponibles.filter(p => p.grupo === grupo);
                const grupoLabel = grupo === 'admin' ? 'Administración del sistema' : grupo === 'asociado' ? 'Módulos del asociado' : 'Usuario en espera';
                const grupoColor = grupo === 'admin' ? 'text-blue-700 bg-blue-50 border-blue-200' : grupo === 'asociado' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-50 border-slate-200';
                return (
                  <div key={grupo} className="space-y-2">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-semibold uppercase tracking-wide ${grupoColor}`}>
                      <Shield className="size-3" />
                      {grupoLabel}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {grupoPermisos.map((permiso) => (
                        <div
                          key={permiso.clave}
                          className={`p-3 rounded-lg border-2 transition-all ${
                            selectedItem?.esSistema
                              ? 'cursor-not-allowed opacity-60'
                              : 'cursor-pointer'
                          } ${
                            formData.permisos[permiso.clave]
                              ? 'bg-emerald-50 border-emerald-300'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                          onClick={() => !selectedItem?.esSistema && handlePermisoChange(permiso.clave)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2">
                              <Checkbox
                                checked={!!formData.permisos[permiso.clave]}
                                disabled={selectedItem?.esSistema}
                                onCheckedChange={() => !selectedItem?.esSistema && handlePermisoChange(permiso.clave)}
                              />
                              <div>
                                <Label className={`text-sm ${selectedItem?.esSistema ? 'cursor-not-allowed' : 'cursor-pointer'}`}>{permiso.label}</Label>
                                {permiso.descripcion && (
                                  <p className="text-xs text-slate-400 mt-0.5">{permiso.descripcion}</p>
                                )}
                              </div>
                            </div>
                            {formData.permisos[permiso.clave] && (
                              <Check className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleEditRol}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL VER DETALLES ===== */}
      <Dialog open={isDetailDialogOpen} onOpenChange={(open: boolean) => {
        setIsDetailDialogOpen(open);
        if (!open) { setSelectedItem(null); setPermisosToRemove([]); }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5 text-emerald-600" />
              Detalles: {selectedItem?.nombre}
            </DialogTitle>
            <DialogDescription>
              Información completa, gestión de permisos y registro de auditoría del rol
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="info" className="gap-2">
                  <Info className="size-4" /> Información
                </TabsTrigger>
                <TabsTrigger value="permisos" className="gap-2">
                  <Settings className="size-4" /> Permisos
                </TabsTrigger>
                <TabsTrigger value="auditoria" className="gap-2">
                  <History className="size-4" /> Auditoría
                </TabsTrigger>
              </TabsList>

              {/* Tab: Información */}
              <TabsContent value="info" className="space-y-4 pt-4">
                <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500 text-xs">Nombre del rol</Label>
                      <p className="font-semibold mt-1">{selectedItem.nombre}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">Usuarios asignados</Label>
                      <p className="font-semibold mt-1">{selectedItem.cantidadUsuarios} usuarios</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Descripción</Label>
                    <p className="text-sm mt-1">{selectedItem.descripcion}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500 text-xs">Estado</Label>
                      <div className="mt-1">
                        <Badge className={selectedItem.estado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                          {selectedItem.estado ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">Tipo</Label>
                      <div className="mt-1">
                        <Badge variant="outline" className={selectedItem.esSistema ? 'bg-slate-100 text-slate-600' : 'bg-purple-100 text-purple-700'}>
                          {selectedItem.esSistema ? 'Rol del sistema' : 'Rol personalizado'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500 text-xs">Fecha de creación</Label>
                      <p className="text-sm font-medium mt-1 text-slate-700">{selectedItem.fechaCreacion}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">Última modificación</Label>
                      <p className="text-sm font-medium mt-1 text-slate-700">{selectedItem.fechaModificacion}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Permisos activos</Label>
                    <p className="font-semibold mt-1 text-emerald-700">
                      {getPermisosActivosCount(selectedItem.permisos)} de {getTotalPermisosAplicables()} permisos
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Permisos */}
              <TabsContent value="permisos" className="pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-slate-900">Permisos del rol</h4>
                    <p className="text-sm text-slate-500">
                      {getPermisosActivosCount(selectedItem.permisos)} de {getTotalPermisosAplicables()} permisos activos
                      {permisosToRemove.length > 0 && (
                        <span className="ml-2 text-amber-600 font-medium">· {permisosToRemove.length} seleccionado(s) para quitar</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {permisosToRemove.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 gap-2"
                        onClick={handleOpenRemovePermisos}
                      >
                        <Trash2 className="size-4" />
                        Eliminar seleccionados ({permisosToRemove.length})
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                      onClick={handleOpenAddPermisos}
                      disabled={permisosDisponibles.every(p => selectedItem.permisos[p.clave])}
                    >
                      <Plus className="size-4" />
                      Agregar permisos
                    </Button>
                  </div>
                </div>

                {/* Lista desplegable de permisos */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setIsPermisosExpanded(!isPermisosExpanded)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="size-4 text-slate-600" />
                      <span className="font-medium text-slate-900">Lista completa de permisos</span>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        {getPermisosActivosCount(selectedItem.permisos)} activos
                      </Badge>
                      {(selectedItem.permisosQuitados ?? []).length > 0 && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          {selectedItem.permisosQuitados!.length} quitado{selectedItem.permisosQuitados!.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    {isPermisosExpanded ? (
                      <ChevronUp className="size-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="size-5 text-slate-400" />
                    )}
                  </button>

                  {isPermisosExpanded && (
                    <div className="divide-y divide-slate-100">
                      {/* Todos los permisos del catálogo — activos → quitados → no asignados */}
                      {[...permisosDisponibles].sort((a, b) => {
                        const score = (clave: string) => {
                          if (selectedItem.permisos[clave]) return 2;                          // Activo
                          if ((selectedItem.permisosQuitados ?? []).includes(clave)) return 1; // Quitado
                          return 0;                                                             // No asignado
                        };
                        return score(b.clave) - score(a.clave);
                      }).map((permiso) => {
                        const activo      = !!selectedItem.permisos[permiso.clave];
                        const quitado     = !activo && (selectedItem.permisosQuitados ?? []).includes(permiso.clave);
                        const seleccionado = permisosToRemove.includes(permiso.clave);
                        const esMinimo    = PERMISOS_MINIMOS.includes(permiso.clave);

                        /* ── colores de fila ── */
                        const rowClass = seleccionado
                          ? 'bg-red-50 border-l-2 border-red-400'
                          : activo
                            ? 'bg-emerald-50/50 hover:bg-emerald-50'
                            : quitado
                              ? 'bg-amber-50/40 hover:bg-amber-50'
                              : 'bg-white hover:bg-slate-50';

                        return (
                          <div
                            key={permiso.clave}
                            className={`flex items-center justify-between p-4 transition-colors ${rowClass}`}
                          >
                            <div className="flex items-center gap-3">
                              {activo ? (
                                <Checkbox
                                  checked={seleccionado}
                                  onCheckedChange={() => handleTogglePermisoToRemove(permiso.clave)}
                                  className="border-slate-300 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                                />
                              ) : quitado ? (
                                /* ícono "fue quitado" */
                                <div className="p-2 rounded-lg bg-amber-100">
                                  <MinusCircle className="size-4 text-amber-500" />
                                </div>
                              ) : (
                                /* ícono "nunca asignado" */
                                <div className="p-2 rounded-lg bg-slate-100">
                                  <X className="size-4 text-slate-300" />
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-medium ${
                                    seleccionado ? 'text-red-700 line-through' :
                                    activo       ? 'text-emerald-900' :
                                    quitado      ? 'text-amber-800'   :
                                                   'text-slate-400'
                                  }`}>
                                    {permiso.label}
                                  </p>
                                  {esMinimo && activo && (
                                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 py-0">
                                      mínimo requerido
                                    </Badge>
                                  )}
                                </div>
                                {permiso.descripcion && (
                                  <p className={`text-xs ${
                                    seleccionado ? 'text-red-500'    :
                                    activo       ? 'text-emerald-600':
                                    quitado      ? 'text-amber-600'  :
                                                   'text-slate-300'
                                  }`}>
                                    {permiso.descripcion}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {activo ? (
                                <>
                                  {seleccionado ? (
                                    <Badge className="bg-red-100 text-red-700 border-0">Seleccionado</Badge>
                                  ) : (
                                    <Badge className="bg-emerald-100 text-emerald-700 border-0">Activo</Badge>
                                  )}
                                  <Button
                                    variant="ghost" size="sm"
                                    className={`h-8 w-8 p-0 ${seleccionado ? 'text-red-600 bg-red-100 hover:bg-red-200' : 'text-red-400 hover:text-red-700 hover:bg-red-50'}`}
                                    onClick={() => handleTogglePermisoToRemove(permiso.clave)}
                                    title={seleccionado ? 'Quitar selección' : 'Seleccionar para quitar'}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </>
                              ) : quitado ? (
                                /* Estado QUITADO: badge ámbar + botón para reactivar */
                                <>
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                                    Quitado
                                  </Badge>
                                  <Button
                                    variant="ghost" size="sm"
                                    className="h-8 w-8 p-0 text-amber-500 hover:text-amber-700 hover:bg-amber-100"
                                    title="Reactivar: abre el diálogo de agregar con este permiso pre-seleccionado"
                                    onClick={() => {
                                      setPermisosToAdd(prev =>
                                        prev.includes(permiso.clave) ? prev : [...prev, permiso.clave]
                                      );
                                      setIsAddPermisosDialogOpen(true);
                                    }}
                                  >
                                    <RotateCcw className="size-4" />
                                  </Button>
                                </>
                              ) : (
                                /* Estado NO ASIGNADO: solo badge gris sutil */
                                <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200">
                                  No asignado
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedItem.esSistema && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-700 text-sm">
                    <Info className="size-4 shrink-0" />
                    Este es un rol del sistema. Los cambios de permisos se guardarán en la base de datos.
                  </div>
                )}
              </TabsContent>

              {/* Tab: Auditoría */}
              <TabsContent value="auditoria" className="pt-4">
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList className="size-5 text-slate-600" />
                  <h4 className="font-semibold text-slate-900">Log de Auditoría del Sistema</h4>
                </div>
                {auditLog.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <History className="size-10 mx-auto mb-2 opacity-30" />
                    <p>No hay registros de auditoría</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {auditLog.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="p-1.5 bg-slate-200 rounded shrink-0 mt-0.5">
                          <History className="size-3 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              {entry.accion}
                            </Badge>
                            <span className="text-xs text-slate-400">{entry.fecha}</span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">{entry.detalle}</p>
                          <p className="text-xs text-slate-400">Por: {entry.usuario}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDetailDialogOpen(false); setSelectedItem(null); }}>
              Cerrar
            </Button>
            {selectedItem && !selectedItem.esSistema && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  setIsDetailDialogOpen(false);
                  handleOpenEdit(selectedItem);
                }}
              >
                <Edit className="size-4 mr-2" />
                Editar rol
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG AGREGAR PERMISOS ===== */}
      <Dialog open={isAddPermisosDialogOpen} onOpenChange={(open) => {
        setIsAddPermisosDialogOpen(open);
        if (!open) { setPermisosToAdd([]); }
        // No resetear selectedItem — el panel de detalles debe seguir abierto
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-emerald-600" />
              Agregar Permisos al Rol
            </DialogTitle>
            <DialogDescription>
              Selecciona los permisos que deseas agregar a "{selectedItem?.nombre}". No se pueden duplicar permisos ya asignados.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-80 overflow-y-auto">
            {selectedItem && permisosDisponibles.filter(p => !selectedItem.permisos[p.clave]).length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Check className="size-10 mx-auto mb-2 text-emerald-400" />
                <p>El rol ya tiene todos los permisos disponibles asignados</p>
              </div>
            ) : (
              permisosDisponibles
                .filter(p => selectedItem && !selectedItem.permisos[p.clave])
                .map((permiso) => (
                  <div
                    key={permiso.clave}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      permisosToAdd.includes(permiso.clave)
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-slate-50 border-slate-200 hover:border-emerald-200'
                    }`}
                    onClick={() => setPermisosToAdd(prev =>
                      prev.includes(permiso.clave) ? prev.filter(p => p !== permiso.clave) : [...prev, permiso.clave]
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={permisosToAdd.includes(permiso.clave)}
                          onCheckedChange={() => setPermisosToAdd(prev =>
                            prev.includes(permiso.clave) ? prev.filter(p => p !== permiso.clave) : [...prev, permiso.clave]
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium">{permiso.label}</p>
                          {permiso.descripcion && <p className="text-xs text-slate-500">{permiso.descripcion}</p>}
                        </div>
                      </div>
                      {permisosToAdd.includes(permiso.clave) && <Check className="size-4 text-emerald-600" />}
                    </div>
                  </div>
                ))
            )}
          </div>
          {permisosToAdd.length === 0 && (
            <p className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle className="size-3" />
              Selecciona al menos un permiso para agregar
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddPermisosDialogOpen(false); setPermisosToAdd([]); }}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleConfirmAddPermisos}
              disabled={permisosToAdd.length === 0}
            >
              Agregar {permisosToAdd.length > 0 ? `(${permisosToAdd.length})` : ''} permiso(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG SELECCIONAR PERMISOS A ELIMINAR ===== */}
      <Dialog open={isRemoveSelectDialogOpen} onOpenChange={(open) => {
        setIsRemoveSelectDialogOpen(open);
        if (!open) { setPermisosToRemove([]); }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldMinus className="size-5 text-orange-600" />
              Eliminar Permisos del Rol
            </DialogTitle>
            <DialogDescription>
              Selecciona los permisos que deseas quitar de <strong>"{selectedItem?.nombre}"</strong>. Debes conservar al menos un permiso activo. Los permisos quitados se pueden volver a agregar.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-80 overflow-y-auto">
            {selectedItem && permisosDisponibles.filter(p => selectedItem.permisos[p.clave]).length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ShieldMinus className="size-10 mx-auto mb-2 text-slate-300" />
                <p>Este rol no tiene permisos activos para quitar</p>
              </div>
            ) : (
              permisosDisponibles
                .filter(p => selectedItem && selectedItem.permisos[p.clave])
                .map((permiso) => {
                  const seleccionado = permisosToRemove.includes(permiso.clave);
                  const esMinimo = PERMISOS_MINIMOS.includes(permiso.clave);
                  const activosRestantes = selectedItem
                    ? permisosDisponibles.filter(p => selectedItem.permisos[p.clave]).length
                    : 0;
                  const bloqueado = esMinimo || (activosRestantes - permisosToRemove.length <= 1 && !seleccionado);
                  return (
                    <div
                      key={permiso.clave}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        bloqueado ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                          : seleccionado ? 'bg-red-50 border-red-300 cursor-pointer'
                          : 'bg-slate-50 border-slate-200 hover:border-red-200 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (bloqueado) return;
                        setPermisosToRemove(prev =>
                          prev.includes(permiso.clave) ? prev.filter(p => p !== permiso.clave) : [...prev, permiso.clave]
                        );
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={seleccionado}
                            disabled={bloqueado}
                            onCheckedChange={() => {
                              if (bloqueado) return;
                              setPermisosToRemove(prev =>
                                prev.includes(permiso.clave) ? prev.filter(p => p !== permiso.clave) : [...prev, permiso.clave]
                              );
                            }}
                            className="border-slate-300 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-medium ${seleccionado ? 'text-red-700 line-through' : 'text-slate-900'}`}>
                                {permiso.label}
                              </p>
                              {esMinimo && (
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 py-0">
                                  mínimo requerido
                                </Badge>
                              )}
                            </div>
                            {permiso.descripcion && <p className="text-xs text-slate-500">{permiso.descripcion}</p>}
                          </div>
                        </div>
                        {seleccionado && <Trash2 className="size-4 text-red-500 shrink-0" />}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
          {permisosToRemove.length === 0 && (
            <p className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle className="size-3" />
              Selecciona al menos un permiso para quitar
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsRemoveSelectDialogOpen(false); setPermisosToRemove([]); }}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={permisosToRemove.length === 0}
              onClick={() => {
                if (permisosToRemove.length === 0) return;
                setIsRemoveSelectDialogOpen(false);
                setIsRemovePermisoDialogOpen(true);
              }}
            >
              <Trash2 className="size-4 mr-2" />
              Eliminar {permisosToRemove.length > 0 ? `(${permisosToRemove.length})` : ''} permiso(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== ALERT CONFIRMAR AGREGAR PERMISO(S) ===== */}
      <AlertDialog open={isConfirmAddDialogOpen} onOpenChange={(open) => {
        setIsConfirmAddDialogOpen(open);
        if (!open) setPermisosToAdd([]);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-emerald-700">
              <ShieldPlus className="size-5" />
              ¿Agregar {permisosToAdd.length === 1 ? 'este permiso' : `estos ${permisosToAdd.length} permisos`}?
            </AlertDialogTitle>
            {/* div en lugar de AlertDialogDescription para evitar <ul> dentro de <p> (HTML inválido) */}
            <div className="text-muted-foreground text-sm space-y-3">
              <p>
                Estás a punto de agregar los siguientes permisos al rol <strong className="text-slate-900">"{selectedItem?.nombre}"</strong>.
                Los usuarios con este rol ganarán acceso a los módulos correspondientes.
              </p>
              <div className="space-y-1.5">
                {permisosToAdd.map(k => {
                  const cfg = permisosDisponibles.find(p => p.clave === k);
                  return (
                    <div key={k} className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-1.5">
                      <ShieldPlus className="size-3.5 shrink-0" />
                      <span className="font-medium">{cfg?.label}</span>
                      {cfg?.descripcion && <span className="text-emerald-400">— {cfg.descripcion}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPermisosToAdd([])}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteAddPermisos}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Sí, agregar {permisosToAdd.length === 1 ? 'permiso' : `${permisosToAdd.length} permisos`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== ALERT ELIMINAR PERMISO(S) ===== */}
      <AlertDialog open={isRemovePermisoDialogOpen} onOpenChange={(open) => {
        setIsRemovePermisoDialogOpen(open);
        if (!open) { setPermisosToRemove([]); }
        // No resetear selectedItem — el panel de detalles debe seguir abierto
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <Trash2 className="size-5" />
              ¿Quitar {permisosToRemove.length === 1 ? 'este permiso' : `estos ${permisosToRemove.length} permisos`}?
            </AlertDialogTitle>
            {/* div en lugar de AlertDialogDescription para evitar <div> dentro de <p> (HTML inválido) */}
            <div className="text-muted-foreground text-sm space-y-3">
              <p>
                Los siguientes permisos serán quitados del rol <strong className="text-slate-900">"{selectedItem?.nombre}"</strong>.
                Los usuarios con este rol perderán acceso a los módulos correspondientes.
              </p>
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-amber-800 text-xs">
                ℹ️ El permiso <strong>no se borrará de la base de datos</strong> — solo se desactiva para este rol.
                Puedes volver a agregarlo en cualquier momento.
              </div>
              <div className="space-y-1.5">
                {permisosToRemove.map(k => {
                  const cfg = permisosDisponibles.find(p => p.clave === k);
                  return (
                    <div key={k} className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                      <Trash2 className="size-3.5 shrink-0" />
                      <span className="font-medium">{cfg?.label}</span>
                      {cfg?.descripcion && <span className="text-amber-500">— {cfg.descripcion}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPermisosToRemove([])}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemovePermiso}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Quitar {permisosToRemove.length === 1 ? 'permiso' : `${permisosToRemove.length} permisos`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== ALERT ELIMINAR ROL ===== */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open: boolean) => {
        setIsDeleteDialogOpen(open);
        if (!open) setSelectedItem(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="size-5" />
              ¿Eliminar el rol "{selectedItem?.nombre}"?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">Esta acción no se puede deshacer. El rol será eliminado permanentemente del sistema y quedará registrado en el log de auditoría.</span>
              <span className="block font-medium text-slate-700">Condiciones para eliminar:</span>
              <span className="block">
                <span className={`flex items-center gap-1.5 text-sm ${selectedItem?.esSistema ? 'text-red-600' : 'text-emerald-600'}`}>
                  {selectedItem?.esSistema ? <X className="size-3" /> : <Check className="size-3" />}
                  {selectedItem?.esSistema ? 'No cumple: Es un rol del sistema' : 'Cumple: No es rol del sistema'}
                </span>
                <span className={`flex items-center gap-1.5 text-sm ${(selectedItem?.cantidadUsuarios || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {(selectedItem?.cantidadUsuarios || 0) > 0 ? <X className="size-3" /> : <Check className="size-3" />}
                  {(selectedItem?.cantidadUsuarios || 0) > 0
                    ? `No cumple: Tiene ${selectedItem?.cantidadUsuarios} usuario(s) asignado(s)`
                    : 'Cumple: Sin usuarios asignados'}
                </span>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItem(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRol}
              className="bg-red-600 hover:bg-red-700"
              disabled={selectedItem?.esSistema || (selectedItem?.cantidadUsuarios || 0) > 0}
            >
              Confirmar eliminación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== ALERT CAMBIAR ESTADO ===== */}
      <AlertDialog open={isToggleEstadoDialogOpen} onOpenChange={(open: boolean) => {
        setIsToggleEstadoDialogOpen(open);
        if (!open) setSelectedItem(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Info className="size-5 text-blue-600" />
              ¿Confirmar cambio de estado?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Estás a punto de <strong className="text-slate-900">{selectedItem?.estado ? 'desactivar' : 'activar'}</strong> el rol <strong className="text-slate-900">"{selectedItem?.nombre}"</strong>.
              </p>
              {selectedItem?.estado && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-amber-700 text-sm flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>Al desactivar este rol, los {selectedItem?.cantidadUsuarios} usuarios asignados podrían perder acceso a las funcionalidades correspondientes.</span>
                  </p>
                </div>
              )}
              <div className="text-sm text-slate-600 space-y-1">
                <p className="flex items-center gap-2">
                  <span className="font-medium">📅 Fecha de registro:</span>
                  <span>{new Date().toLocaleString('es-CO')}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium">👤 Usuario:</span>
                  <span>Administrador</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedItem(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleToggleEstado(selectedItem?.id)}
              className={selectedItem?.estado ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            >
              {selectedItem?.estado ? 'Desactivar rol' : 'Activar rol'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== ALERT GUARDADO EXITOSO ===== */}
      <AlertDialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-emerald-700">
              <Check className="size-5" />
              ¡Cambios guardados con éxito!
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line text-slate-700">
              {resultMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setIsSuccessDialogOpen(false)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Aceptar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===== ALERT ERROR AL GUARDAR ===== */}
      <AlertDialog open={isErrorDialogOpen} onOpenChange={setIsErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="size-5" />
              No se pudo guardar los cambios
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resultMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setIsErrorDialogOpen(false)}
              className="bg-red-600 hover:bg-red-700"
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
