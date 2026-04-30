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
  Lock, Unlock, AlertTriangle, Info, History, Settings, Clock, ShieldPlus, ShieldMinus
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { toast } from 'sonner';

// ── Supabase + Auth ───────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type PermisoKey = 'dashboard' | 'configuracion' | 'roles' | 'usuarios' | 'asociados' |
  'ahorros' | 'creditos' | 'eventos' | 'compras' | 'ventas' | 'reportes';

interface Permiso { key: PermisoKey; label: string; acciones: string[]; }
interface AuditEntry { id: string; accion: string; detalle: string; fecha: string; usuario: string; }

const PERMISOS_CONFIG: Permiso[] = [
  { key: 'dashboard',    label: 'Dashboard',                  acciones: ['ver', 'estadísticas'] },
  { key: 'configuracion',label: 'Configuración',              acciones: ['ver', 'crear', 'editar', 'eliminar'] },
  { key: 'roles',        label: 'Gestión de Roles',           acciones: ['ver', 'crear', 'editar', 'eliminar'] },
  { key: 'usuarios',     label: 'Gestión de Usuarios',        acciones: ['ver', 'crear', 'editar', 'eliminar'] },
  { key: 'asociados',    label: 'Gestión de Asociados',       acciones: ['ver', 'crear', 'editar', 'eliminar'] },
  { key: 'ahorros',      label: 'Módulo de Ahorros',          acciones: ['ver', 'crear', 'editar'] },
  { key: 'creditos',     label: 'Módulo de Créditos',         acciones: ['ver', 'crear', 'editar', 'aprobar'] },
  { key: 'eventos',      label: 'Módulo de Eventos',          acciones: ['ver', 'crear', 'editar'] },
  { key: 'compras',      label: 'Módulo de Compras',          acciones: ['ver', 'crear', 'editar'] },
  { key: 'ventas',       label: 'Módulo de Ventas',           acciones: ['ver', 'crear', 'editar'] },
  { key: 'reportes',     label: 'Reportes y Estadísticas',    acciones: ['ver', 'exportar'] },
];

const PERMISOS_MINIMOS: PermisoKey[] = ['dashboard'];

// Filtro adicional: permisos específicos para filtrar roles (inicializado en el componente)

// Permisos por defecto para roles del sistema
const PERMISOS_ADMIN: Record<PermisoKey, boolean> = {
  dashboard: true, configuracion: true, roles: true, usuarios: true, asociados: true,
  ahorros: true, creditos: true, eventos: true, compras: true, ventas: true, reportes: true,
};
const PERMISOS_ASOCIADO: Record<PermisoKey, boolean> = {
  dashboard: true, configuracion: false, roles: false, usuarios: false, asociados: false,
  ahorros: true, creditos: true, eventos: true, compras: true, ventas: false, reportes: false,
};

interface RolesProps {
  userRole?: 'admin' | 'asociado';
}

export default function Roles({ userRole }: RolesProps) {
  // Filtro de permisos para roles (implementado en UI de filtros)
  const [filterPermiso, setFilterPermiso] = useState<'todos' | PermisoKey>('todos');
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
  const [isClearHistoryDialogOpen, setIsClearHistoryDialogOpen] = useState(false);
  const [resultMessage, setResultMessage]             = useState('');
  const [selectedItem, setSelectedItem]               = useState<any>(null);
  const [permisosToRemove, setPermisosToRemove]       = useState<PermisoKey[]>([]);
  const [permisosToAdd, setPermisosToAdd]             = useState<PermisoKey[]>([]);
  const [detailTab, setDetailTab]                     = useState('info');
  const [isPermisosExpanded, setIsPermisosExpanded]   = useState(true);
  const itemsPerPage = 5;

  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  const addAuditEntry = async (accion: string, detalle: string, registroId?: string) => {
    const entrada: AuditEntry = {
      id: String(Date.now()), accion, detalle,
      fecha: new Date().toLocaleString('es-CO'), usuario: usuarioActualNombre,
    };
    setAuditLog(prev => [entrada, ...prev]);

    // Persistir en Supabase
    await supabase.from('auditoria').insert({
      usuario_id:  usuarioActualId,
      accion,
      tabla:       'roles',
      registro_id: registroId ?? null,
      detalle:     { descripcion: detalle, usuario: usuarioActualNombre },
    }).then(({ error }) => {
      if (error) console.warn('Error al guardar auditoría:', error.message);
    });
  };

  // El filtrado por nombre de rol ha sido eliminado; se mantiene solo el filtro por permisos
  const [formData, setFormData] = useState({
    nombre: '', descripcion: '',
    permisos: Object.fromEntries(PERMISOS_CONFIG.map(p => [p.key, false])) as Record<PermisoKey, boolean>
  });

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
      ] = await Promise.all([
        supabase.from('roles').select('*, label').order('label, nombre'),
        // Contar usuarios por rol de forma confiable
        supabase.from('usuarios').select('rol_id').eq('activo', true),
        supabase.from('auditoria').select('*')
          .eq('tabla', 'roles')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (error) throw error;

      // Mapa de conteos por rol_id
      const conteoMap: Record<string, number> = {};
      (conteos || []).forEach((u: any) => {
        if (u.rol_id) conteoMap[u.rol_id] = (conteoMap[u.rol_id] || 0) + 1;
      });

      const mapeados = (data || []).map((r: any) => {
        const permisosRaw: any[] = Array.isArray(r.permisos) ? r.permisos : [];
        // Si la BD no tiene permisos guardados aún, usar los valores por defecto
        const usarDefecto = permisosRaw.length === 0;
        const permisos = Object.fromEntries(
          PERMISOS_CONFIG.map(p => [p.key, permisosRaw.includes(p.key)])
        ) as Record<PermisoKey, boolean>;

        if (usarDefecto && r.nombre === 'admin')    Object.assign(permisos, PERMISOS_ADMIN);
        if (usarDefecto && r.nombre === 'asociado') Object.assign(permisos, PERMISOS_ASOCIADO);

        return {
          id:               r.id,
          // Usar label de la BD; si no existe (migración pendiente) usar traducción fallback
          nombre:           r.label ?? (r.nombre === 'admin' ? 'Administrador' : r.nombre === 'asociado' ? 'Asociado' : r.nombre),
          nombre_db:        r.nombre,
          descripcion:      r.descripcion ?? '',
          permisos,
          cantidadUsuarios: conteoMap[r.id] ?? 0,
          estado:           r.activo ?? true,
          // Usa el campo es_sistema de la BD + nombres conocidos como doble protección
          esSistema:        r.es_sistema === true || r.nombre === 'admin' || r.nombre === 'asociado' || r.nombre === 'usuario',
          fechaCreacion:    r.created_at ? new Date(r.created_at).toLocaleDateString('es-CO') : '—',
        };
      });
      setRoles(mapeados);

      // Cargar auditoría persistida
      const auditMapeada: AuditEntry[] = (auditoriaData || []).map((a: any) => ({
        id:      a.id,
        accion:  a.accion,
        detalle: a.detalle?.descripcion ?? '—',
        fecha:   new Date(a.created_at).toLocaleString('es-CO'),
        usuario: a.detalle?.usuario ?? 'Sistema',
      }));
      setAuditLog(auditMapeada);

    } catch (err: any) {
      toast.error('Error al cargar roles: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredRoles  = roles.filter(r => {
    const permisos = r.permisos as any;
    const matchesPermiso = filterPermiso === 'todos' || !!permisos[filterPermiso];
    const matchesSearch = !searchTerm.trim() ||
      r.nombre.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      r.descripcion.toLowerCase().includes(searchTerm.trim().toLowerCase());
    return matchesPermiso && matchesSearch;
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
      addAuditEntry(!rol.estado ? 'ROL ACTIVADO' : 'ROL DESACTIVADO',
        `El rol "${rol.nombre}" fue ${!rol.estado ? 'activado' : 'desactivado'} por ${usuarioActualNombre} el ${new Date().toLocaleString('es-CO')}`,
        id);
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
      permisos: Object.fromEntries(PERMISOS_CONFIG.map(p => [p.key, false])) as Record<PermisoKey, boolean>
    });
    setIsCreateDialogOpen(true);
  };

  const handleOpenEdit = (rol: any) => {
    const rolActual = roles.find(r => r.id === rol.id);
    if (!rolActual) { toast.error('El rol ya no está disponible.'); return; }
    setSelectedItem(rolActual);
    setFormData({ nombre: rolActual.nombre, descripcion: rolActual.descripcion, permisos: { ...rolActual.permisos } });
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
      const { data, error } = await supabase.from('roles')
        .insert({ nombre: nombreTrim.toLowerCase(), label: nombreTrim, descripcion: descTrim, permisos: permisosToArray(formData.permisos), activo: true })
        .select().single();
      if (error) throw error;

      setRoles(prev => [...prev, {
        id: data.id, nombre: nombreTrim, nombre_db: nombreTrim.toLowerCase(),
        descripcion: descTrim, permisos: { ...formData.permisos },
        cantidadUsuarios: 0, estado: true, esSistema: false,
        fechaCreacion: new Date().toLocaleDateString('es-CO'),
      }]);
      addAuditEntry('ROL CREADO', `Se creó el rol "${nombreTrim}" con ${permisosActivos} permisos por ${usuarioActualNombre}`, data.id);
      toast.success('✅ Rol creado exitosamente', {
        description: `"${nombreTrim}" con ${permisosActivos} de ${PERMISOS_CONFIG.length} permisos`, duration: 4000,
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

    try {
      const updatePayload: any = {
        descripcion: descTrim,
        permisos:    permisosToArray(formData.permisos),
      };
      // Siempre actualizar el label (nombre de pantalla)
      updatePayload.label = nombreTrim;
      // Solo actualizar el nombre interno si no es un rol del sistema
      if (!selectedItem.esSistema) {
        updatePayload.nombre = nombreTrim.toLowerCase();
      }

      const { error } = await supabase.from('roles')
        .update(updatePayload)
        .eq('id', selectedItem.id);
      if (error) throw error;

      const updatedRol = { ...selectedItem, nombre: nombreTrim, descripcion: descTrim, permisos: { ...formData.permisos } };
      setRoles(prev => prev.map(r => r.id === selectedItem.id ? updatedRol : r));
      setSelectedItem(updatedRol);
      addAuditEntry('ROL EDITADO', `Se actualizó "${nombreTrim}" por ${usuarioActualNombre}`, selectedItem.id);
      toast.success('✏️ Rol actualizado exitosamente', {
        description: `"${nombreTrim}" con ${permisosActivos} permisos`, duration: 4000,
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

    // Proceder con la eliminación
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', selectedItem.id);

    if (error) {
      toast.error('Error al eliminar rol: ' + error.message);
      setIsDeleteDialogOpen(false); setSelectedItem(null); return;
    }

    setRoles(prev => prev.filter(r => r.id !== selectedItem.id));
    addAuditEntry(
      'ROL ELIMINADO',
      `El rol "${rolActual.nombre}" fue eliminado permanentemente por ${usuarioActualNombre}`,
    );
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
    const nuevosPermisos = { ...selectedItem.permisos };
    permisosToAdd.forEach(p => { nuevosPermisos[p] = true; });
    try {
      const { error } = await supabase.from('roles').update({ permisos: permisosToArray(nuevosPermisos) }).eq('id', selectedItem.id);
      if (error) throw error;
      const updatedRol = { ...selectedItem, permisos: nuevosPermisos };
      setRoles(prev => prev.map(r => r.id === selectedItem.id ? updatedRol : r));
      setSelectedItem(updatedRol);
      const labels = permisosToAdd.map(p => PERMISOS_CONFIG.find(c => c.key === p)?.label).join(', ');
      addAuditEntry('PERMISOS AGREGADOS', `Permisos agregados a "${selectedItem.nombre}": ${labels} por ${usuarioActualNombre}`, selectedItem.id);
      const total = Object.values(nuevosPermisos).filter(v => v).length;
      toast.success(`${permisosToAdd.length} permiso(s) agregado(s)`, {
        description: `"${selectedItem.nombre}" ahora tiene ${total} de ${PERMISOS_CONFIG.length} permisos`, duration: 4000,
      });
    } catch (err: any) {
      toast.error('Error al agregar permisos: ' + err.message);
    }
    setIsConfirmAddDialogOpen(false);
    setPermisosToAdd([]);
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
      const labels = faltanMinimos.map(m => PERMISOS_CONFIG.find(p => p.key === m)?.label).join(', ');
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
    const nuevosPermisos = { ...selectedItem.permisos };
    permisosToRemove.forEach(k => { nuevosPermisos[k] = false; });

    try {
      const { error } = await supabase.from('roles').update({ permisos: permisosToArray(nuevosPermisos) }).eq('id', selectedItem.id);
      if (error) throw error;
      const updatedRol = { ...selectedItem, permisos: nuevosPermisos };
      setRoles(prev => prev.map(r => r.id === selectedItem.id ? updatedRol : r));
      setSelectedItem(updatedRol);
      const labels = permisosToRemove.map(k => PERMISOS_CONFIG.find(p => p.key === k)?.label).join(', ');
      const total  = Object.values(nuevosPermisos).filter(v => v).length;
      addAuditEntry(
        'PERMISO(S) ELIMINADO(S)',
        `Se eliminaron ${permisosToRemove.length} permiso(s) de "${selectedItem.nombre}": ${labels} — por ${usuarioActualNombre}`,
        selectedItem.id,
      );
      toast.success(`🗑️ ${permisosToRemove.length} permiso(s) eliminado(s)`, {
        description: `"${selectedItem.nombre}" ahora tiene ${total} de ${PERMISOS_CONFIG.length} permisos`, duration: 4000,
      });
    } catch (err: any) {
      toast.error('Error al eliminar permisos: ' + err.message);
    }
    setIsRemovePermisoDialogOpen(false);
    setPermisosToRemove([]);
  };

  const getPermisosBadges = (permisos: Record<PermisoKey, boolean>) =>
    Object.entries(permisos).filter(([, v]) => v).map(([key]) => (
      <Badge key={key} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
        {PERMISOS_CONFIG.find(p => p.key === key)?.label || key}
      </Badge>
    ));

  const getPermisosActivosCount = (permisos: Record<PermisoKey, boolean>) =>
    Object.values(permisos).filter(v => v).length;

  const handleClearHistory = async () => {
    try {
      // Borrar de Supabase todos los registros de auditoría del módulo roles
      const { error } = await supabase
        .from('auditoria')
        .delete()
        .eq('tabla', 'roles');
      if (error) throw error;
    } catch (err: any) {
      // Si la tabla aún no existe simplemente ignoramos — el estado local sí se limpia
      console.warn('No se pudo limpiar auditoría en BD:', err.message);
    }

    // Dejar solo un registro que indique que se limpió
    const entradaReset: AuditEntry = {
      id: String(Date.now()), accion: 'HISTORIAL LIMPIADO',
      detalle: 'El historial fue limpiado manualmente por el Administrador',
      fecha: new Date().toLocaleString('es-CO'), usuario: usuarioActualNombre,
    };
    setAuditLog([entradaReset]);
    setIsClearHistoryDialogOpen(false);
    toast.success('🧹 Historial limpiado exitosamente', { duration: 4000 });
  };

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
    <div className="p-8 bg-slate-50 min-h-screen">
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
              <div className="flex gap-2 w-full sm:w-auto">
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
                    {PERMISOS_CONFIG.map(p => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
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
                            {rol.esSistema ? (
                              /* Roles del sistema: estado fijo, no se puede cambiar */
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
                            {/* Agregar permiso */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedItem(rol);
                                setPermisosToAdd([]);
                                setIsAddPermisosDialogOpen(true);
                              }}
                              title={PERMISOS_CONFIG.every(p => rol.permisos[p.key]) ? 'El rol ya tiene todos los permisos' : 'Agregar permiso'}
                              disabled={PERMISOS_CONFIG.every(p => rol.permisos[p.key])}
                              className={PERMISOS_CONFIG.every(p => rol.permisos[p.key]) ? 'opacity-40 cursor-not-allowed' : 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300'}
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
                              title={getPermisosActivosCount(rol.permisos) <= 1 ? 'Debe conservar al menos un permiso' : 'Eliminar permiso'}
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <History className="size-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Historial de Cambios</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">
                    Registro completo de todas las acciones realizadas en el módulo de roles
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-sm px-3 py-1">
                  {auditLog.length} registro(s)
                </Badge>
                {auditLog.length > 1 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsClearHistoryDialogOpen(true)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="size-4 mr-1" />
                    Limpiar historial
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <History className="size-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No hay cambios registrados</p>
                <p className="text-sm mt-1">Los cambios realizados aparecerán aquí automáticamente</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {auditLog.map((entry, index) => (
                  <div 
                    key={entry.id} 
                    className="flex items-start gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-center size-10 bg-white border-2 border-blue-200 rounded-full shrink-0">
                      <span className="text-xs font-bold text-blue-600">#{auditLog.length - index}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs font-semibold ${
                            entry.accion.includes('CREADO') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            entry.accion.includes('EDITADO') || entry.accion.includes('AGREGADO') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            entry.accion.includes('ELIMINADO') ? 'bg-red-50 text-red-700 border-red-200' :
                            entry.accion.includes('ACTIVADO') ? 'bg-green-50 text-green-700 border-green-200' :
                            entry.accion.includes('DESACTIVADO') ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {entry.accion}
                        </Badge>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="size-3" />
                          {entry.fecha}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 mb-2">{entry.detalle}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <UserCircle2 className="size-3.5" />
                        <span>Realizado por: <span className="font-medium text-slate-700">{entry.usuario}</span></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                />
                {roles.some(r => r.nombre.toLowerCase() === formData.nombre.trim().toLowerCase()) && formData.nombre.trim() && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    Ya existe un rol con este nombre
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
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                />
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
              <div className="grid grid-cols-2 gap-3">
                {PERMISOS_CONFIG.map((permiso) => (
                  <div
                    key={permiso.key}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.permisos[permiso.key]
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => handlePermisoChange(permiso.key)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={formData.permisos[permiso.key]}
                          onCheckedChange={() => handlePermisoChange(permiso.key)}
                        />
                        <div>
                          <Label className="cursor-pointer">{permiso.label}</Label>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {permiso.acciones.join(', ')}
                          </p>
                        </div>
                      </div>
                      {formData.permisos[permiso.key] && (
                        <Check className="size-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
        if (!open) setSelectedItem(null);
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
                  onChange={(e) => !selectedItem?.esSistema && setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  disabled={selectedItem?.esSistema}
                  className={selectedItem?.esSistema ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}
                />
                {!selectedItem?.esSistema && roles.some(r => r.nombre.toLowerCase() === formData.nombre.trim().toLowerCase() && r.id !== selectedItem?.id) && formData.nombre.trim() && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    Ya existe otro rol con este nombre
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-descripcion">Descripción *</Label>
                <Textarea
                  id="edit-descripcion"
                  rows={3}
                  value={formData.descripcion}
                  onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                />
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
              <div className="grid grid-cols-2 gap-3">
                {PERMISOS_CONFIG.map((permiso) => (
                  <div
                    key={permiso.key}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.permisos[permiso.key]
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => handlePermisoChange(permiso.key)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={formData.permisos[permiso.key]}
                          onCheckedChange={() => handlePermisoChange(permiso.key)}
                        />
                        <div>
                          <Label className="cursor-pointer">{permiso.label}</Label>
                          <p className="text-xs text-slate-500 mt-0.5">{permiso.acciones.join(', ')}</p>
                        </div>
                      </div>
                      {formData.permisos[permiso.key] && (
                        <Check className="size-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setSelectedItem(null); }}>
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
                  <div>
                    <Label className="text-slate-500 text-xs">Permisos activos</Label>
                    <p className="font-semibold mt-1 text-emerald-700">
                      {getPermisosActivosCount(selectedItem.permisos)} de {PERMISOS_CONFIG.length} permisos
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
                      {getPermisosActivosCount(selectedItem.permisos)} de {PERMISOS_CONFIG.length} permisos activos
                      {permisosToRemove.length > 0 && (
                        <span className="ml-2 text-red-600 font-medium">· {permisosToRemove.length} seleccionado(s) para eliminar</span>
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
                      disabled={PERMISOS_CONFIG.every(p => selectedItem.permisos[p.key])}
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
                    </div>
                    {isPermisosExpanded ? (
                      <ChevronUp className="size-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="size-5 text-slate-400" />
                    )}
                  </button>

                  {isPermisosExpanded && (
                    <div className="divide-y divide-slate-100">
                      {PERMISOS_CONFIG.map((permiso) => {
                        const activo = selectedItem.permisos[permiso.key];
                        const seleccionado = permisosToRemove.includes(permiso.key);
                        const esMinimo = PERMISOS_MINIMOS.includes(permiso.key);
                        return (
                          <div
                            key={permiso.key}
                            className={`flex items-center justify-between p-4 transition-colors ${
                              seleccionado
                                ? 'bg-red-50 border-l-2 border-red-400'
                                : activo ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {activo ? (
                                <Checkbox
                                  checked={seleccionado}
                                  onCheckedChange={() => handleTogglePermisoToRemove(permiso.key)}
                                  className="border-slate-300 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                                />
                              ) : (
                                <div className={`p-2 rounded-lg ${activo ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                  {activo ? (
                                    <Check className="size-4 text-emerald-600" />
                                  ) : (
                                    <X className="size-4 text-slate-400" />
                                  )}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-medium ${
                                    seleccionado ? 'text-red-700 line-through' :
                                    activo ? 'text-emerald-900' : 'text-slate-600'
                                  }`}>
                                    {permiso.label}
                                  </p>
                                  {esMinimo && activo && (
                                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 py-0">
                                      mínimo requerido
                                    </Badge>
                                  )}
                                </div>
                                <p className={`text-xs ${
                                  seleccionado ? 'text-red-500' :
                                  activo ? 'text-emerald-600' : 'text-slate-400'
                                }`}>
                                  {activo ? `Acciones: ${permiso.acciones.join(', ')}` : 'Sin acceso'}
                                </p>
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
                                    variant="ghost"
                                    size="sm"
                                    className={`h-8 w-8 p-0 ${
                                      seleccionado
                                        ? 'text-red-600 bg-red-100 hover:bg-red-200'
                                        : 'text-red-400 hover:text-red-700 hover:bg-red-50'
                                    }`}
                                    onClick={() => handleTogglePermisoToRemove(permiso.key)}
                                    title={seleccionado ? 'Quitar selección' : 'Seleccionar para eliminar'}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </>
                              ) : (
                                <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                                  Inactivo
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
        if (!open) { setPermisosToAdd([]); setSelectedItem(null); }
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
            {selectedItem && PERMISOS_CONFIG
              .filter(p => !selectedItem.permisos[p.key])
              .length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Check className="size-10 mx-auto mb-2 text-emerald-400" />
                <p>El rol ya tiene todos los permisos disponibles asignados</p>
              </div>
            ) : (
              PERMISOS_CONFIG
                .filter(p => selectedItem && !selectedItem.permisos[p.key])
                .map((permiso) => (
                  <div
                    key={permiso.key}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      permisosToAdd.includes(permiso.key)
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-slate-50 border-slate-200 hover:border-emerald-200'
                    }`}
                    onClick={() => {
                      setPermisosToAdd(prev =>
                        prev.includes(permiso.key)
                          ? prev.filter(p => p !== permiso.key)
                          : [...prev, permiso.key]
                      );
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={permisosToAdd.includes(permiso.key)}
                          onCheckedChange={() => {
                            setPermisosToAdd(prev =>
                              prev.includes(permiso.key)
                                ? prev.filter(p => p !== permiso.key)
                                : [...prev, permiso.key]
                            );
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium">{permiso.label}</p>
                          <p className="text-xs text-slate-500">{permiso.acciones.join(', ')}</p>
                        </div>
                      </div>
                      {permisosToAdd.includes(permiso.key) && (
                        <Check className="size-4 text-emerald-600" />
                      )}
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
            <Button variant="outline" onClick={() => { setIsAddPermisosDialogOpen(false); setPermisosToAdd([]); setSelectedItem(null); }}>
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
              Selecciona los permisos que deseas eliminar de <strong>"{selectedItem?.nombre}"</strong>. Debes conservar al menos un permiso activo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-80 overflow-y-auto">
            {selectedItem && PERMISOS_CONFIG.filter(p => selectedItem.permisos[p.key]).length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ShieldMinus className="size-10 mx-auto mb-2 text-slate-300" />
                <p>Este rol no tiene permisos activos para eliminar</p>
              </div>
            ) : (
              PERMISOS_CONFIG
                .filter(p => selectedItem && selectedItem.permisos[p.key])
                .map((permiso) => {
                  const seleccionado = permisosToRemove.includes(permiso.key);
                  const esMinimo = PERMISOS_MINIMOS.includes(permiso.key);
                  const activosRestantes = selectedItem
                    ? PERMISOS_CONFIG.filter(p => selectedItem.permisos[p.key]).length
                    : 0;
                  const bloqueado = esMinimo || (activosRestantes - permisosToRemove.length <= 1 && !seleccionado);
                  return (
                    <div
                      key={permiso.key}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        bloqueado
                          ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                          : seleccionado
                            ? 'bg-red-50 border-red-300 cursor-pointer'
                            : 'bg-slate-50 border-slate-200 hover:border-red-200 cursor-pointer'
                      }`}
                      onClick={() => {
                        if (bloqueado) return;
                        setPermisosToRemove(prev =>
                          prev.includes(permiso.key)
                            ? prev.filter(p => p !== permiso.key)
                            : [...prev, permiso.key]
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
                                prev.includes(permiso.key)
                                  ? prev.filter(p => p !== permiso.key)
                                  : [...prev, permiso.key]
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
                            <p className="text-xs text-slate-500">{permiso.acciones.join(', ')}</p>
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
              Selecciona al menos un permiso para eliminar
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
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Estás a punto de agregar los siguientes permisos al rol <strong className="text-slate-900">"{selectedItem?.nombre}"</strong>.
                Los usuarios con este rol ganarán acceso a los módulos correspondientes.
              </span>
              <ul className="space-y-1.5 mt-2">
                {permisosToAdd.map(k => {
                  const cfg = PERMISOS_CONFIG.find(p => p.key === k);
                  return (
                    <li key={k} className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-1.5">
                      <ShieldPlus className="size-3.5 shrink-0" />
                      <span className="font-medium">{cfg?.label}</span>
                      <span className="text-emerald-400">— {cfg?.acciones.join(', ')}</span>
                    </li>
                  );
                })}
              </ul>
            </AlertDialogDescription>
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
        if (!open) { setPermisosToRemove([]); setSelectedItem(null); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="size-5" />
              ¿Eliminar {permisosToRemove.length === 1 ? 'este permiso' : `estos ${permisosToRemove.length} permisos`}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Estás a punto de eliminar los siguientes permisos del rol <strong className="text-slate-900">"{selectedItem?.nombre}"</strong>.
                Los usuarios con este rol perderán acceso a los módulos correspondientes.
              </span>
              <ul className="space-y-1.5 mt-2">
                {permisosToRemove.map(k => {
                  const cfg = PERMISOS_CONFIG.find(p => p.key === k);
                  return (
                    <li key={k} className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
                      <Trash2 className="size-3.5 shrink-0" />
                      <span className="font-medium">{cfg?.label}</span>
                      <span className="text-red-400">— {cfg?.acciones.join(', ')}</span>
                    </li>
                  );
                })}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPermisosToRemove([])}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemovePermiso}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar {permisosToRemove.length === 1 ? 'permiso' : `${permisosToRemove.length} permisos`}
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

      {/* ===== ALERT CONFIRMAR LIMPIAR HISTORIAL ===== */}
      <AlertDialog open={isClearHistoryDialogOpen} onOpenChange={setIsClearHistoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-5" />
              ¿Confirmar limpieza de historial?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="text-slate-700">
                Estás a punto de <strong>eliminar permanentemente</strong> todos los registros del historial de cambios.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 text-sm flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>Esta acción no se puede deshacer. Se perderá el registro de todas las acciones realizadas hasta el momento.</span>
                </p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700 text-sm flex items-start gap-2">
                  <Info className="size-4 shrink-0 mt-0.5" />
                  <span>Se creará un nuevo registro indicando que el historial fue limpiado manualmente.</span>
                </p>
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <p className="flex items-center gap-2">
                  <span className="font-medium">📊 Registros a eliminar:</span>
                  <span className="font-bold text-slate-900">{auditLog.length - 1}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium">👤 Usuario:</span>
                  <span>Administrador</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsClearHistoryDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="size-4 mr-1" />
              Limpiar historial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
