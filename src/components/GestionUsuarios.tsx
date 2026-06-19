import { useState, useEffect } from 'react';
import PiggyBankLoader from './ui/PiggyBankLoader';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Search, Plus, ChevronLeft, ChevronRight, ChevronDown, UserCircle, UserCircle2, Edit, Trash2, Shield, Clock, FileText, AlertTriangle, User, Lock, History, Unlock, Ban, Mail, Phone, Calendar, MapPin, UserCheck } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../contexts/AuthContext';
import { rolLabel } from '../lib/permissions';
import { useExpulsion } from './gestion-usuarios/useExpulsion';
import { validateEmail } from '../lib/validation';
import { ExpulsionDialog } from './gestion-usuarios/ExpulsionDialog';

// ── Helpers ───────────────────────────────────────────────────────────────────
// rolLabel viene de '../lib/permissions' — no redefinir aquí

/** Devuelve true si la identificación contiene alguna letra (dato inválido) */
const tieneLetrasId = (id: string) => id ? /[a-zA-Z]/.test(id) : false;

const getRolColor = (rol: string) => {
  if (rol === 'admin' || rol === 'Administrador')                   return 'bg-emerald-100 text-emerald-700';
  if (rol === 'asociado' || rol === 'Asociado')                     return 'bg-blue-100 text-blue-700';
  if (rol === 'usuario' || rol === 'Usuario' || rol === 'Usuario Normal') return 'bg-amber-100 text-amber-700';
  return 'bg-purple-100 text-purple-700';
};

/** Traduce los mensajes de error de Supabase Auth al español */
const traducirErrorAuth = (msg: string): string => {
  if (msg.includes('Password should be at least'))     return 'La contraseña debe tener al menos 6 caracteres';
  if (msg.includes('password'))                        return 'La contraseña no cumple los requisitos mínimos (al menos 6 caracteres)';
  if (msg.includes('User already registered'))         return 'Este correo ya está registrado en el sistema';
  if (msg.includes('Email already in use'))            return 'Este correo ya está en uso por otro usuario';
  if (msg.includes('Invalid email'))                   return 'El formato del correo electrónico no es válido';
  if (msg.includes('Email not confirmed'))             return 'El correo no ha sido confirmado aún';
  if (msg.includes('Invalid login credentials'))       return 'Credenciales incorrectas';
  if (msg.includes('Too many requests'))               return 'Demasiados intentos. Espera un momento e intenta de nuevo';
  if (msg.includes('signup is disabled'))              return 'El registro de nuevos usuarios está deshabilitado';
  if (msg.includes('Email rate limit exceeded'))       return 'Límite de correos superado. Intenta más tarde';
  if (msg.includes('security purposes') || msg.includes('only request this after')) {
    const segundos = msg.match(/(\d+)\s*second/)?.[1];
    return segundos
      ? `Por seguridad, debes esperar ${segundos} segundos antes de crear otro usuario`
      : 'Por seguridad, debes esperar unos segundos antes de crear otro usuario';
  }
  if (msg.includes('weak_password'))                   return 'La contraseña es demasiado débil. Usa al menos 6 caracteres con letras y números';
  return msg; // fallback: mostrar mensaje original si no se reconoce
};

interface GestionUsuariosProps {
  userRole?: UserRole;
}

export default function GestionUsuarios({ userRole: _userRoleProp }: GestionUsuariosProps) {
  // ── Fuente única de verdad — AuthContext ───────────────────────────────────
  // El usuario actual viene del contexto global, no se re-fetcha aquí.
  const { user: authUser } = useAuth();
  // Es admin si su rol en BD es 'admin' (no comparamos label traducido)
  const esAdmin = authUser?.rol === 'admin';

  const [searchTerm, setSearchTerm]                             = useState('');
  const [currentPage, setCurrentPage]                           = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen]               = useState(false);
  const [isEditModalOpen, setIsEditModalOpen]                   = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen]               = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]             = useState(false);
  const [isToggleEstadoDialogOpen, setIsToggleEstadoDialogOpen] = useState(false);
  const [selectedUsuario, setSelectedUsuario]                   = useState<any>(null);
  const [isFixIdModalOpen, setIsFixIdModalOpen]                 = useState(false);
  const [fixIdUsuario, setFixIdUsuario]                         = useState<any>(null);
  const [fixIdValue, setFixIdValue]                             = useState('');
  const [fixIdError, setFixIdError]                             = useState('');
  const [fixIdLoading, setFixIdLoading]                         = useState(false);

  // ── Hook de Expulsión ──────────────────────────────────────────────────────
  const {
    isExpulsionOpen,
    setIsExpulsionOpen,
    expulsionAsociado,
    ejecutando: ejecutandoExpulsion,
    datosExpulsion,
    abrirExpulsion,
    ejecutarExpulsion,
  } = useExpulsion();

  const renderMoraBadge = (cuotas: number) => {
    if (cuotas <= 0) return null;
    let color = "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100";
    if (cuotas === 2) {
      color = "bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100";
    } else if (cuotas >= 3) {
      color = "bg-red-100 text-red-800 border-red-200 hover:bg-red-100";
    }
    return (
      <Badge variant="outline" className={`text-[10px] font-semibold py-0 px-1.5 rounded-full ${color}`}>
        {cuotas} {cuotas === 1 ? 'cuota' : 'cuotas'}
      </Badge>
    );
  };
  const itemsPerPage = 10;

  // ── Errores inline por campo ─────────────────────────────────────────────────
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validarCampoUsuario = (name: string, value: string, excludeId?: string) => {
    let error = '';
    const v = value.trim();
    switch (name) {
      case 'cedula':
        if (!v) error = 'La identificación es obligatoria';
        else if (!/^\d+$/.test(v)) error = 'Solo se permiten números';
        else if (v.length < 6) error = 'Mínimo 6 dígitos';
        else if (v.length > 15) error = 'Máximo 15 dígitos';
        else if (usuarios.some(u => u.cedula === v && u.id !== excludeId)) error = '⚠ Esta cédula ya está registrada';
        break;
      case 'username':
        if (!v) error = 'El nombre de usuario es obligatorio';
        else if (v.length < 3) error = 'Mínimo 3 caracteres';
        else if (usuarios.some(u => u.username?.toLowerCase() === v.toLowerCase() && u.id !== excludeId)) error = '⚠ Este nombre de usuario ya está en uso';
        break;
      case 'nombre':
        if (!v) error = 'El nombre completo es obligatorio';
        else if (v.length < 3) error = 'Mínimo 3 caracteres';
        break;
      case 'email':
        if (!v) error = 'El correo es obligatorio';
        else if (!validateEmail(v)) error = 'Formato de correo no válido';
        else if (usuarios.some(u => u.email?.toLowerCase() === v.toLowerCase() && u.id !== excludeId)) error = '⚠ Este correo ya está registrado';
        break;
      case 'telefono':
        if (!v) error = 'El teléfono es obligatorio';
        else if (v.length > 15) error = 'Máximo 15 caracteres';
        break;

      case 'direccion':
        if (!v) error = 'La dirección es obligatoria para asociados';
        break;
      case 'fechaIngreso':
        if (!v) error = 'La fecha de ingreso es obligatoria';
        break;
    }
    setFormErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleFormChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    validarCampoUsuario(name, value);
  };

  const handleEditChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    validarCampoUsuario(name, value, selectedUsuario?.id);
  };

  const [auditoria, setAuditoria]           = useState<any[]>([]);
  const [auditoriaPage, setAuditoriaPage]   = useState(1);
  const [auditFiltro, setAuditFiltro]       = useState('todos');
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const AUDITORIA_PER_PAGE = 5;
  const [filterRol, setFilterRol]           = useState('');
  const [filterEstado, setFilterEstado]     = useState('');
  const [formData, setFormData]         = useState({
    cedula: '', username: '', nombre: '',
    email: '', telefono: '', rol: '', rolId: '',
    direccion: '', fechaIngreso: '',
  });

  // ── Estado Supabase ──────────────────────────────────────────────────────────
  const [usuarios, setUsuarios]     = useState<any[]>([]);
  const [roles, setRoles]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { cargarDatos(); }, []);

  // ── Tiempo real: recarga cuando cambian usuarios ───────────────────────────
  useRealtimeSubscription(
    'realtime:usuarios',
    ['usuarios'],
    cargarDatos,
  );

  async function cargarDatos() {
  try {
    setLoading(true);

    // El perfil del usuario actual ya viene de AuthContext — no re-fetchar aquí.
    const primerDiaMes = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
    const [
      { data: usData, error: usErr },
      { data: rolesData },
      { data: auditoriaData },
      { data: creditosData },
      { data: cuentasData },
      { data: transMesData },
    ] = await Promise.all([
      supabase.from('usuarios').select('*, roles(nombre, es_sistema)').order('nombre'),
      supabase.from('roles').select('*').order('nombre'),
      supabase.from('auditoria').select('*').eq('tabla', 'usuarios').order('created_at', { ascending: false }).limit(100),
      supabase.from('creditos').select('id, asociado_id, estado, anulado, saldo, monto, cuota_mensual, plazo_meses, fecha_desembolso, tasa_interes'),
      supabase.from('cuentas_ahorro').select('id, asociado_id, tipo, estado, anulado, monto_ahorrado'),
      supabase.from('transacciones').select('ahorro_id, tipo').in('tipo', ['aporte_permanente']).eq('anulado', false).gte('fecha_pago', primerDiaMes),
    ]);

    if (usErr) throw usErr;

    // Calcular cuotas atrasadas por usuario
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diaHoy = hoy.getDate();
    const ahorroMoraActiva = diaHoy >= 17;
    const paidSavingsSet = new Set((transMesData || []).map((t: any) => t.ahorro_id));
    const cuotasAtrasadasMap: Record<string, number> = {};

    if (ahorroMoraActiva && cuentasData) {
      cuentasData.forEach((c: any) => {
        if (c.tipo === 'permanente' && c.estado === 'activo' && !c.anulado && !paidSavingsSet.has(c.id)) {
          cuotasAtrasadasMap[c.asociado_id] = (cuotasAtrasadasMap[c.asociado_id] || 0) + 1;
        }
      });
    }

    if (creditosData) {
      creditosData.forEach((cr: any) => {
        if (!cr.anulado && cr.estado === 'en_mora') {
          const crMonto = Number(cr.monto) || 0;
          const crSaldo = Number(cr.saldo) || crMonto;
          const crCuota = Number(cr.cuota_mensual) || 0;
          const crPlazo = Number(cr.plazo_meses) || 0;
          
          const crCuotasPagadas = crCuota > 0 ? Math.max(0, Math.round((crMonto - crSaldo) / crCuota)) : 0;
          const crFechaBase = cr.fecha_desembolso ? new Date(cr.fecha_desembolso + 'T00:00:00') : null;
          const crFechaVencProxima = crFechaBase && crCuotasPagadas < crPlazo
            ? new Date(crFechaBase.getFullYear(), crFechaBase.getMonth() + crCuotasPagadas + 1, crFechaBase.getDate())
            : null;

          if (crFechaVencProxima && crFechaVencProxima <= hoy) {
            const crDiasMora = Math.floor((hoy.getTime() - crFechaVencProxima.getTime()) / 86400000) + 1;
            if (crDiasMora > 0) {
              const mesesAtrasados = Math.floor(crDiasMora / 30) + 1;
              cuotasAtrasadasMap[cr.asociado_id] = (cuotasAtrasadasMap[cr.asociado_id] || 0) + mesesAtrasados;
            }
          }
        }
      });
    }

    // Construir sets de estado financiero por usuario
    const conHistorial    = new Set<string>();
    const conObligaciones = new Set<string>();

    for (const c of (creditosData || [])) {
      conHistorial.add(c.asociado_id);
      if (!c.anulado && ['activo', 'pendiente', 'aprobado'].includes(c.estado))
        conObligaciones.add(c.asociado_id);
    }
    for (const ah of (cuentasData || [])) {
      conHistorial.add(ah.asociado_id);
      if (!ah.anulado && ah.tipo === 'permanente' && ah.estado === 'activo' && ah.monto_ahorrado > 0)
        conObligaciones.add(ah.asociado_id);
    }

    const usuariosMapeados = (usData || []).map((u: any) => {
      const rolDb = u.roles?.nombre ?? 'usuario';
      return {
        id:               u.id,
        cedula:           u.cedula || '',
        username:         u.username || u.email?.split('@')[0] || '—',
        nombre:           u.nombre,
        email:            u.email,
        telefono:         u.telefono || '',
        direccion:        u.direccion || '',
        rol:              rolLabel(rolDb),
        rol_nombre_db:    rolDb,
        rol_id:           u.rol_id,
        asociado_id:      u.id,
        ultimoAcceso:     u.ultimo_acceso
          ? new Date(u.ultimo_acceso).toLocaleString('es-CO')
          : 'Nunca',
        estado:           u.activo,
        fechaCreacion:    u.created_at?.split('T')[0] ?? '—',
        fechaModificacion: u.updated_at?.split('T')[0] ?? '—',
        soloLectura:      false,
        esSistema:        rolDb === 'admin' && (u.roles?.es_sistema ?? false),
        tieneHistorialFinanciero: conHistorial.has(u.id),
        tieneObligacionesActivas: conObligaciones.has(u.id),
        cuotasAtrasadas:  cuotasAtrasadasMap[u.id] || 0,
      };
    });

    setUsuarios(usuariosMapeados);
    setRoles(rolesData || []);

    // Cargar auditoría persistida desde Supabase
    const auditoriaFormateada = (auditoriaData || []).map((r: any) => ({
      id:               r.id,
      usuarioId:        r.usuario_id,
      usuarioNombre:    r.datos_despues?.usuarioNombre ?? '—',
      estadoAnterior:   r.datos_despues?.estadoAnterior ?? '—',
      estadoNuevo:      r.datos_despues?.estadoNuevo ?? '—',
      fechaHora:        new Date(r.created_at).toLocaleString('es-CO'),
      adminResponsable: r.datos_despues?.adminResponsable ?? '—',
      accion:           r.accion,
      cambios:          Array.isArray(r.datos_despues?.cambios) ? r.datos_despues.cambios : [],
    }));
    setAuditoria(auditoriaFormateada);
  } catch (err: any) {
    toast.error('Error al cargar usuarios: ' + err.message);
  } finally {
    setLoading(false);
  }
}

  // ── Filtro y paginación ──────────────────────────────────────────────────────
  const filteredUsuarios = usuarios.filter(u => {
    const term = searchTerm.toLowerCase();
    const matchSearch = !term ||
      u.nombre.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.username || '').toLowerCase().includes(term) ||
      (u.cedula || '').toLowerCase().includes(term) ||
      u.rol.toLowerCase().includes(term);
    const matchRol    = !filterRol    || u.rol === filterRol;
    const matchEstado = !filterEstado ||
      (filterEstado === 'activo' ? u.estado === true : u.estado === false);
    return matchSearch && matchRol && matchEstado;
  });

  const totalPages      = Math.ceil(filteredUsuarios.length / itemsPerPage);
  const startIndex      = (currentPage - 1) * itemsPerPage;
  const endIndex        = startIndex + itemsPerPage;
  const currentUsuarios = filteredUsuarios.slice(startIndex, endIndex);

  // Texto de paginación sin mostrar "1 a 0"
  const paginacionTexto = filteredUsuarios.length === 0
    ? 'Sin resultados'
    : `Mostrando ${startIndex + 1} a ${Math.min(endIndex, filteredUsuarios.length)} de ${filteredUsuarios.length} usuarios`;

  // ── Guardar auditoría en Supabase ────────────────────────────────────────────
  async function guardarAuditoria(registro: {
    usuarioId: string;
    usuarioNombre: string;
    estadoAnterior: string;
    estadoNuevo: string;
    fechaHora: string;
    adminResponsable: string;
    accion: string;
    cambios?: { campo: string; antes: string; despues: string }[];
  }) {
    await supabase.from('auditoria').insert({
      usuario_id:  registro.usuarioId,
      accion:      registro.accion,
      tabla:       'usuarios',
      registro_id: registro.usuarioId,
      datos_despues: {
        usuarioNombre:    registro.usuarioNombre,
        estadoAnterior:   registro.estadoAnterior,
        estadoNuevo:      registro.estadoNuevo,
        adminResponsable: registro.adminResponsable,
        fechaHora:        registro.fechaHora,
        cambios:          registro.cambios ?? [],
      },
    });
    setAuditoria(prev => [{ ...registro, id: String(Date.now()) }, ...prev]);
    setAuditoriaPage(1);
  }

  // ── Toggle estado ────────────────────────────────────────────────────────────
  const handleToggleEstado = async (id: string) => {
    const usuario    = usuarios.find(u => u.id === id);

    // Protección: el usuario administrador nunca puede desactivarse
    if (usuario?.esSistema) {
      toast.error('Acción no permitida', {
        description: `El usuario "${usuario.nombre}" tiene rol de administrador del sistema y no puede ser desactivado.`,
      });
      setIsToggleEstadoDialogOpen(false);
      setSelectedUsuario(null);
      return;
    }

    const nuevoEstado = !usuario?.estado;
    const fechaHora  = new Date().toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    // Bloquear desactivación si tiene procesos pendientes
    if (!nuevoEstado && usuario?.asociado_id) {
      const asociadoId = usuario.asociado_id;
      const [
        { data: ahorros },
        { data: creditos },
      ] = await Promise.all([
        supabase.from('cuentas_ahorro').select('id').eq('tipo','permanente').eq('asociado_id', asociadoId).eq('estado', 'activo').eq('anulado', false).limit(1),
        supabase.from('creditos').select('id').eq('asociado_id', asociadoId).in('estado', ['activo', 'pendiente', 'aprobado']).limit(1),
      ]);

      const procesos: string[] = [];
      if (ahorros && ahorros.length > 0)  procesos.push('ahorros permanentes activos');
      if (creditos && creditos.length > 0) procesos.push('créditos activos o pendientes');

      if (procesos.length > 0) {
        toast.error(`No se puede desactivar a "${usuario?.nombre}"`, {
          description: `Tiene: ${procesos.join(', ')}. Resuelve estos procesos antes de desactivar la cuenta.`,
        });
        setIsToggleEstadoDialogOpen(false);
        setSelectedUsuario(null);
        return;
      }
    }

    try {
      const { error } = await supabase.from('usuarios').update({ activo: nuevoEstado }).eq('id', id);
      if (error) throw error;

      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, estado: nuevoEstado } : u));

      nuevoEstado
        ? toast.success(`Usuario "${usuario?.nombre}" activado`, {
            description: `El usuario ya puede iniciar sesión | ${fechaHora}`,
          })
        : toast.warning(`Usuario "${usuario?.nombre}" desactivado`, {
            description: `El usuario NO podrá iniciar sesión | ${fechaHora}`,
          });

      guardarAuditoria({
        usuarioId:        id,
        usuarioNombre:    usuario?.nombre ?? '—',
        estadoAnterior:   usuario?.estado ? 'Activo' : 'Inactivo',
        estadoNuevo:      nuevoEstado ? 'Activo' : 'Inactivo',
        fechaHora,
        adminResponsable: authUser?.nombre ?? 'Desconocido',
        accion:           nuevoEstado ? 'ACTIVACIÓN' : 'DESACTIVACIÓN',
      });
    } catch (err: any) {
      toast.error('Error al cambiar estado: ' + err.message);
    }

    setIsToggleEstadoDialogOpen(false);
    setSelectedUsuario(null);
  };

  // ── Ver detalles ─────────────────────────────────────────────────────────────
  const handleViewDetails = (usuario: any) => {
    if (!esAdmin) {
      toast.error('Acceso denegado', {
        description: 'Solo los administradores pueden ver detalles de otros usuarios.',
      });
      return;
    }
    const existe = usuarios.find(u => u.id === usuario.id);
    if (!existe) {
      toast.error('Usuario no encontrado', {
        description: 'El usuario fue eliminado o ya no existe.',
      });
      return;
    }
    setSelectedUsuario(usuario);
    setIsDetailModalOpen(true);
  };

  // ── Crear ────────────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setFormData({ cedula: '', username: '', nombre: '', email: '', telefono: '', rol: '', rolId: '', direccion: '', fechaIngreso: '' });
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.cedula.trim()) { toast.error('La identificación es obligatoria'); return; }
    if (!/^\d+$/.test(formData.cedula.trim())) { toast.error('La identificación solo debe contener números'); return; }
    if (formData.cedula.trim().length > 15)    { toast.error('La identificación no puede superar 15 dígitos'); return; }
    if (!formData.username.trim())       { toast.error('El nombre de usuario es obligatorio'); return; }
    if (!formData.nombre.trim())         { toast.error('El nombre es obligatorio'); return; }
    if (!formData.email.trim())          { toast.error('El correo electrónico es obligatorio'); return; }
    if (!formData.telefono.trim())       { toast.error('El teléfono es obligatorio'); return; }
    if (formData.telefono.trim().length > 15) { toast.error('El teléfono no puede superar 15 caracteres'); return; }
    if (!formData.rolId)                  { toast.error('Debes seleccionar un rol'); return; }

    // Campos adicionales si es Asociado
    if (formData.rol === 'Asociado') {
      if (!formData.direccion.trim())    { toast.error('La dirección es obligatoria para asociados'); return; }
      if (!formData.fechaIngreso.trim()) { toast.error('La fecha de ingreso es obligatoria para asociados'); return; }
    }

    if (!validateEmail(formData.email)) { toast.error('El formato del email no es válido'); return; }

    if (usuarios.some(u => u.cedula === formData.cedula.trim()))
      { toast.error(`Ya existe un usuario con la identificación "${formData.cedula}"`); return; }
    if (usuarios.some(u => u.username.toLowerCase() === formData.username.trim().toLowerCase()))
      { toast.error(`Ya existe un usuario con el nombre "${formData.username}"`); return; }
    if (usuarios.some(u => u.email.toLowerCase() === formData.email.trim().toLowerCase()))
      { toast.error(`Ya existe un usuario con el email "${formData.email}"`); return; }

    try {
      // Enviar invitación por email usando el helper de administración (inviteUser)
      const { data: inviteRes, error: inviteErr } = await supabase.functions.invoke('admin-helper', {
        body: {
          action: 'inviteUser',
          email: formData.email.trim(),
          redirectTo: `${window.location.origin}/?bienvenido=1`,
          data: { nombre: formData.nombre.trim(), rol: formData.rol },
        }
      });
      if (inviteErr) throw inviteErr;
      if (!inviteRes?.data?.user) throw new Error('No se pudo invitar al usuario en Auth');
      const authUserObj = inviteRes.data.user;

      // Campos adicionales para usuarios con rol Asociado
      const camposAsociado = formData.rol === 'Asociado' ? {
        cedula:        formData.cedula.trim(),
        telefono:      formData.telefono.trim(),
        direccion:     formData.direccion.trim(),
        fecha_ingreso: formData.fechaIngreso.trim(),
        estado_cuenta: 'activo',
      } : {};

      // UPSERT — el trigger on_auth_user_created puede haber creado ya la fila con el mismo id
      const { error: userErr } = await supabase.from('usuarios').upsert({
        id:             authUserObj.id,
        nombre:         formData.nombre.trim(),
        email:          formData.email.trim(),
        username:       formData.username.trim().toLowerCase(),
        cedula:         formData.cedula.trim(),
        telefono:       formData.telefono.trim(),
        rol_id:         formData.rolId,
        activo:         true,
        ...camposAsociado,
      }, { onConflict: 'id' });
      if (userErr) throw userErr;

      const fechaHoraCreacion = new Date().toLocaleString('es-CO', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });

      setUsuarios(prev => [...prev, {
        id:             authUserObj.id,
        cedula:         formData.cedula.trim(),
        username:       formData.username.trim().toLowerCase(),
        nombre:         formData.nombre.trim(),
        email:          formData.email.trim(),
        telefono:       formData.telefono.trim(),
        rol:            formData.rol,
        asociado_id:    authUserObj.id,
        ultimoAcceso:   'Nunca',
        estado:         true,
        fechaCreacion:  new Date().toISOString().split('T')[0],
        soloLectura:    false,
      }]);

      guardarAuditoria({
        usuarioId:        authUserObj.id,
        usuarioNombre:    formData.nombre.trim(),
        estadoAnterior:   '—',
        estadoNuevo:      `Rol: ${formData.rol} | Email: ${formData.email.trim()}`,
        fechaHora:        fechaHoraCreacion,
        adminResponsable: authUser?.nombre ?? 'Desconocido',
        accion:           'CREACIÓN',
      });

      toast.success(`Usuario "${formData.nombre}" creado e invitado exitosamente`);
      setIsCreateModalOpen(false);
    } catch (err: any) {
      toast.error(traducirErrorAuth(err.message));
    }
  };

  // ── Editar ───────────────────────────────────────────────────────────────────
  const handleOpenEdit = (usuario: any) => {
    setSelectedUsuario(usuario);
    // Si la identificación contiene letras (dato inválido), limpiarla
    // para obligar al admin a ingresar una identificación numérica válida.
    const idActual = usuario.cedula ?? '';
    const idLimpia = tieneLetrasId(idActual) ? '' : idActual;
    const rolEncontrado = roles.find(r => r.label === usuario.rol || rolLabel(r.nombre) === usuario.rol);
    setFormData({
      cedula: idLimpia,
      username:       usuario.username,
      nombre:         usuario.nombre,
      email:          usuario.email,
      telefono:       usuario.telefono || '',
      direccion:      usuario.direccion || '',
      rol:            usuario.rol,
      rolId:          rolEncontrado?.id ?? usuario.rol_id ?? '',
      fechaIngreso:   '',
    });
    setIsEditModalOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedUsuario) return;
    if (!formData.nombre.trim())         { toast.error('El nombre es obligatorio'); return; }
    if (!formData.cedula.trim()) { toast.error('La identificación es obligatoria'); return; }
    if (!/^\d+$/.test(formData.cedula.trim())) { toast.error('La identificación solo debe contener números'); return; }
    if (formData.cedula.trim().length > 15)    { toast.error('La identificación no puede superar 15 dígitos'); return; }
    if (!formData.username.trim())       { toast.error('El nombre de usuario es obligatorio'); return; }
    if (!formData.email.trim())          { toast.error('El correo electrónico es obligatorio'); return; }
    if (formData.telefono.trim().length > 15) { toast.error('El teléfono no puede superar 15 caracteres'); return; }
    if (!formData.rolId)                  { toast.error('El rol es obligatorio'); return; }

    if (!validateEmail(formData.email)) { toast.error('El formato del email no es válido'); return; }

    // Solo comparar contra usuarios reales (no registros soloLectura de asociados sin cuenta)
    const usuariosReales = usuarios.filter(u => !u.soloLectura);
    if (usuariosReales.some(u => u.cedula === formData.cedula.trim() && u.id !== selectedUsuario.id))
      { toast.error(`Ya existe otro usuario con la identificación "${formData.cedula}"`); return; }
    if (usuariosReales.some(u => (u.username || '').toLowerCase() === formData.username.trim().toLowerCase() && u.id !== selectedUsuario.id))
      { toast.error(`Ya existe otro usuario con el nombre de usuario "${formData.username}"`); return; }
    if (usuariosReales.some(u => u.email.toLowerCase() === formData.email.trim().toLowerCase() && u.id !== selectedUsuario.id))
      { toast.error(`Ya existe otro usuario con el email "${formData.email}"`); return; }

    try {
      const { error } = await supabase.from('usuarios')
        .update({
          nombre:         formData.nombre.trim(),
          email:          formData.email.trim(),
          username:       formData.username.trim().toLowerCase(),
          cedula:         formData.cedula.trim(),
          telefono:       formData.telefono.trim(),
          direccion:      formData.direccion.trim(),
          rol_id:         formData.rolId,
        })
        .eq('id', selectedUsuario.id);
      if (error) throw error;

      setUsuarios(prev => prev.map(u =>
        u.id === selectedUsuario.id
          ? { ...u,
              nombre:         formData.nombre.trim(),
              email:          formData.email.trim(),
              username:       formData.username.trim().toLowerCase(),
              cedula:         formData.cedula.trim(),
              telefono:       formData.telefono.trim(),
              direccion:      formData.direccion.trim(),
              rol:            formData.rol,
              rol_id:         formData.rolId,
              fechaModificacion: new Date().toISOString().split('T')[0],
            }
          : u
      ));
      // Detectar qué campos cambiaron
      const camposAudit: { campo: string; antes: string; despues: string }[] = [];
      const comparar = (campo: string, antes: string, despues: string) => {
        if ((antes ?? '').trim() !== (despues ?? '').trim())
          camposAudit.push({ campo, antes: antes || '—', despues: despues || '—' });
      };
      comparar('Nombre',          selectedUsuario.nombre,         formData.nombre.trim());
      comparar('Usuario',         selectedUsuario.username,       formData.username.trim());
      comparar('Email',           selectedUsuario.email,          formData.email.trim());
      comparar('Identificación',  selectedUsuario.cedula, formData.cedula.trim());
      comparar('Teléfono',        selectedUsuario.telefono,       formData.telefono.trim());
      comparar('Dirección',       selectedUsuario.direccion,      formData.direccion.trim());
      comparar('Rol',             selectedUsuario.rol,            formData.rol);

      guardarAuditoria({
        usuarioId:        selectedUsuario.id,
        usuarioNombre:    formData.nombre.trim(),
        estadoAnterior:   camposAudit.length > 0 ? camposAudit.map(c => `${c.campo}: ${c.antes}`).join(' | ') : '—',
        estadoNuevo:      camposAudit.length > 0 ? camposAudit.map(c => `${c.campo}: ${c.despues}`).join(' | ') : 'Sin cambios',
        fechaHora:        new Date().toLocaleString('es-CO'),
        adminResponsable: authUser?.nombre ?? 'Desconocido',
        accion:           'EDICIÓN',
        cambios:          camposAudit,
      });
      toast.success(`✅ Usuario "${formData.nombre}" actualizado exitosamente`);
    } catch (err: any) {
      toast.error('Error al actualizar usuario: ' + err.message);
    }

    setIsEditModalOpen(false);
    setSelectedUsuario(null);
  };

  // ── Eliminar ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selectedUsuario) return;

    // Protección: el usuario administrador nunca puede eliminarse
    if (selectedUsuario.esSistema) {
      toast.error('Acción no permitida', {
        description: `El usuario "${selectedUsuario.nombre}" tiene rol de administrador del sistema y no puede eliminarse.`,
      });
      setIsDeleteDialogOpen(false);
      setSelectedUsuario(null);
      return;
    }

    // Bloquear eliminación si el usuario tiene CUALQUIER historial financiero,
    // sin importar el estado, saldo o si está anulado. En una cooperativa financiera
    // los actores con historial nunca se eliminan — solo se desactivan.
    if (selectedUsuario.asociado_id) {
      try {
        const id = selectedUsuario.asociado_id;
        const [creditosRes, ahorrosRes] = await Promise.all([
          supabase.from('creditos').select('id').eq('asociado_id', id).limit(1),
          supabase.from('cuentas_ahorro').select('id').eq('asociado_id', id).limit(1),
        ]);

        const tieneHistorial: string[] = [];
        if ((creditosRes.data?.length ?? 0) > 0) tieneHistorial.push('créditos');
        if ((ahorrosRes.data?.length  ?? 0) > 0) tieneHistorial.push('cuentas de ahorro');

        if (tieneHistorial.length > 0) {
          toast.error('No se puede eliminar este usuario', {
            description: `Tiene historial financiero: ${tieneHistorial.join(', ')}. El flujo correcto es desactivar la cuenta, no eliminarla.`,
            duration: 8000,
          });
          setIsDeleteDialogOpen(false); setSelectedUsuario(null); return;
        }
      } catch (verifyErr: any) {
        toast.error('Error al verificar registros del usuario: ' + verifyErr.message);
        setIsDeleteDialogOpen(false); setSelectedUsuario(null); return;
      }
    }

    const fechaHora = new Date().toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    try {
      // Eliminar de la tabla usuarios
      if (!selectedUsuario.soloLectura) {
        const { error: dbErr } = await supabase.from('usuarios').delete().eq('id', selectedUsuario.id);
        if (dbErr) throw dbErr;

        // Eliminar de Supabase Auth via función SQL con SECURITY DEFINER
        await supabase.rpc('eliminar_usuario_auth', { user_id: selectedUsuario.id });

        // Eliminar la cuenta de auth.users mediante la Edge Function para garantizar
        // que el usuario no pueda volver a autenticarse aunque el cascade falle.
        try {
          const { error: adminErr } = await supabase.functions.invoke('admin-helper', {
            body: { action: 'deleteUser', userId: selectedUsuario.id }
          });
          if (adminErr) {
            // Si el usuario ya no existe en auth (p. ej. ya fue eliminado por el RPC),
            // se registra como advertencia pero no se interrumpe la operación.
            console.warn('admin-helper deleteUser:', adminErr.message);
          }
        } catch (adminEx: any) {
          console.warn('admin-helper deleteUser (excepción):', adminEx?.message ?? adminEx);
        }
      }

      guardarAuditoria({
        usuarioId:        selectedUsuario.id,
        usuarioNombre:    selectedUsuario.nombre,
        estadoAnterior:   selectedUsuario.estado ? 'Activo' : 'Inactivo',
        estadoNuevo:      'ELIMINADO',
        fechaHora,
        adminResponsable: authUser?.nombre ?? 'Desconocido',
        accion:           'ELIMINACIÓN',
      });

      setUsuarios(prev => prev.filter(u => u.id !== selectedUsuario.id));
      toast.success(`Usuario "${selectedUsuario.nombre}" eliminado exitosamente`);
    } catch (err: any) {
      toast.error('Error al eliminar usuario: ' + err.message);
    }

    setIsDeleteDialogOpen(false);
    setSelectedUsuario(null);
  };

  // ── Corregir identificación (modal rápido) ───────────────────────────────────
  const handleOpenFixId = (usuario: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setFixIdUsuario(usuario);
    setFixIdValue('');
    setFixIdError('');
    setIsFixIdModalOpen(true);
  };

  const handleSaveFixId = async () => {
    const val = fixIdValue.trim();
    if (!val)            { setFixIdError('Ingresa el número de identificación'); return; }
    if (!/^\d+$/.test(val)) { setFixIdError('Solo se permiten dígitos numéricos'); return; }
    if (val.length > 15) { setFixIdError('Máximo 15 dígitos'); return; }
    if (val.length < 5)  { setFixIdError('Mínimo 5 dígitos'); return; }

    // Verificar que no exista ya ese número en otro usuario
    if (usuarios.some(u => u.cedula === val && u.id !== fixIdUsuario.id)) {
      setFixIdError(`Ya existe otro usuario con la identificación "${val}"`);
      return;
    }

    setFixIdLoading(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ cedula: val })
        .eq('id', fixIdUsuario.id);
      if (error) throw error;

      setUsuarios(prev => prev.map(u =>
        u.id === fixIdUsuario.id ? { ...u, cedula: val } : u
      ));
      toast.success(`Identificación de "${fixIdUsuario.nombre}" actualizada correctamente`);
      setIsFixIdModalOpen(false);
      setFixIdUsuario(null);
    } catch (err: any) {
      setFixIdError('Error al guardar: ' + err.message);
    }
    setFixIdLoading(false);
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PiggyBankLoader title="Cargando usuarios..." />
      </div>
    );
  }

  // ── JSX ──────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2 flex items-center gap-3">
              <UserCircle className="size-8 text-emerald-600" />
              Gestión de Usuarios
            </h1>
            <p className="text-slate-600">Administra los usuarios del sistema UFCA</p>
          </div>
          {esAdmin && (
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleOpenCreate}>
              <Plus className="size-4" />
              Nuevo usuario
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div>
                  <CardTitle>Lista de Usuarios</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    {filteredUsuarios.length} usuario(s) encontrado(s)
                    {(filterRol || filterEstado || searchTerm) && (
                      <button
                        onClick={() => { setFilterRol(''); setFilterEstado(''); setSearchTerm(''); setCurrentPage(1); }}
                        className="ml-2 text-emerald-600 hover:underline text-xs"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por nombre, usuario, ID o rol..."
                    className="pl-10"
                    autoComplete="off"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <Select value={filterRol || 'todos'} onValueChange={(v) => { setFilterRol(v === 'todos' ? '' : v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Filtrar por rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los roles</SelectItem>
                    {roles.map(r => (
                      <SelectItem key={r.id} value={rolLabel(r.nombre)}>
                        {rolLabel(r.nombre)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterEstado || 'todos'} onValueChange={(v) => { setFilterEstado(v === 'todos' ? '' : v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="activo">Activos</SelectItem>
                    <SelectItem value="inactivo">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Identificación</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                          <UserCircle className="size-16 text-slate-300" />
                          <div>
                            <p className="text-lg font-medium text-slate-700">No existen usuarios en el sistema</p>
                            <p className="text-sm mt-2">Comienza creando el primer usuario haciendo clic en "Nuevo usuario"</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : currentUsuarios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3 text-slate-500">
                          <Search className="size-12 text-slate-300" />
                          <div>
                            <p className="text-lg font-medium text-slate-700">No se encontraron resultados</p>
                            <p className="text-sm">No hay usuarios que coincidan con "{searchTerm}"</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentUsuarios.map((usuario) => (
                      <TableRow
                        key={usuario.id}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => handleViewDetails(usuario)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-100 rounded-lg">
                              <UserCircle className="size-4 text-cyan-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-900">{usuario.nombre}</p>
                                {usuario.rol_nombre_db === 'asociado' && renderMoraBadge(usuario.cuotasAtrasadas)}
                              </div>
                              <p className="text-xs text-slate-400">@{usuario.username}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm text-slate-600">
                              {!usuario.cedula
                                ? <span className="text-slate-400 italic">Sin registro</span>
                                : usuario.cedula}
                            </p>
                            {esAdmin && (tieneLetrasId(usuario.cedula) || !usuario.cedula) && (
                              <button
                                onClick={(e) => handleOpenFixId(usuario, e)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                                title="Haz clic para ingresar la identificación correcta"
                              >
                                <AlertTriangle className="size-2.5" />
                                Corregir
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getRolColor(usuario.rol)}>{usuario.rol}</Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {usuario.esSistema ? (
                              /* Administrador: siempre activo, no se puede cambiar */
                              <div className="flex items-center gap-2" title="El usuario administrador siempre debe estar activo">
                                <Lock className="size-3.5 text-slate-400" />
                                <span className="text-sm text-slate-500">Siempre activo</span>
                              </div>
                            ) : usuario.estado && usuario.tieneObligacionesActivas ? (
                              /* Activo con obligaciones financieras: no se puede desactivar */
                              <div className="flex items-center gap-2" title="Tiene créditos o ahorros activos — usa el flujo de liquidación para desactivar">
                                <Lock className="size-3.5 text-amber-400" />
                                <span className="text-sm text-slate-600">Activo</span>
                              </div>
                            ) : (
                              <>
                                <Switch
                                  checked={usuario.estado}
                                  disabled={!esAdmin}
                                  onCheckedChange={() => {
                                    setSelectedUsuario(usuario);
                                    setIsToggleEstadoDialogOpen(true);
                                  }}
                                />
                                <span className="text-sm text-slate-600">
                                  {usuario.estado ? 'Activo' : 'Inactivo'}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {esAdmin && !usuario.esSistema && (
                            <div className="flex gap-2 justify-end">
                              {/* Si está inactivo: solo ver detalle */}
                              {!usuario.estado ? (
                                <Button
                                  variant="outline" size="sm"
                                  onClick={(e: { stopPropagation: () => void; }) => { e.stopPropagation(); setSelectedUsuario(usuario); setIsDetailModalOpen(true); }}
                                  title="Ver detalle (usuario inactivo)"
                                >
                                  <FileText className="size-4 text-slate-500" />
                                </Button>
                              ) : (
                                /* Activo: editar + eliminar (eliminar solo si no tiene historial financiero) */
                                <>
                                  {!usuario.soloLectura && (
                                    <Button
                                      variant="outline" size="sm"
                                      onClick={(e: { stopPropagation: () => void; }) => { e.stopPropagation(); handleOpenEdit(usuario); }}
                                      title="Editar usuario"
                                    >
                                      <Edit className="size-4" />
                                    </Button>
                                  )}
                                  {usuario.rol_nombre_db === 'asociado' && (
                                    <Button
                                      variant="outline" size="sm"
                                      className="border-red-200 hover:bg-red-50 hover:text-red-700 text-red-600"
                                      onClick={(e: { stopPropagation: () => void; }) => {
                                        e.stopPropagation();
                                        abrirExpulsion(usuario);
                                      }}
                                      title="Suspender / Expulsar asociado"
                                    >
                                      <Ban className="size-4" />
                                    </Button>
                                  )}
                                  {!usuario.tieneHistorialFinanciero && (
                                    <Button
                                      variant="outline" size="sm"
                                      onClick={(e: { stopPropagation: () => void; }) => { e.stopPropagation(); setSelectedUsuario(usuario); setIsDeleteDialogOpen(true); }}
                                      title="Eliminar usuario"
                                    >
                                      <Trash2 className="size-4 text-red-600" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-600">{paginacionTexto}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={currentPage === page ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  >
                    {page}
                  </Button>
                ))}
                <Button variant="outline" size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Historial de cambios — timeline */}
        {(() => {
          const ACTION_CFG: Record<string, { icon: JSX.Element; color: string; bg: string; border: string; dot: string }> = {
            'CREACIÓN':     { icon: <Plus className="size-3.5" />,    color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500' },
            'EDICIÓN':      { icon: <Edit className="size-3.5" />,    color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',    dot: 'bg-blue-500'    },
            'ELIMINACIÓN':  { icon: <Trash2 className="size-3.5" />,  color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     dot: 'bg-red-500'     },
            'ACTIVACIÓN':   { icon: <Unlock className="size-3.5" />,  color: 'text-green-700',   bg: 'bg-green-50',    border: 'border-green-200',   dot: 'bg-green-500'   },
            'DESACTIVACIÓN':{ icon: <Lock className="size-3.5" />,    color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200',  dot: 'bg-orange-500'  },
          };
          const getCfg = (accion: string) =>
            ACTION_CFG[accion] ?? { icon: <History className="size-3.5" />, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', dot: 'bg-slate-400' };

          const getDetalle = (entry: any) => {
            if (entry.accion === 'EDICIÓN') {
              if (Array.isArray(entry.cambios) && entry.cambios.length > 0)
                return entry.cambios.map((c: any) => `${c.campo}: ${c.antes} → ${c.despues}`).join(' · ');
              return 'Sin cambios registrados';
            }
            return entry.estadoNuevo || '—';
          };

          const conteoPorAccion = auditoria.reduce((acc, e) => {
            const k = e.accion ?? 'SIN_ACCION';
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const auditFiltrada   = auditFiltro === 'todos' ? auditoria : auditoria.filter(e => e.accion === auditFiltro);
          const totalAudPaginas = Math.ceil(auditFiltrada.length / AUDITORIA_PER_PAGE);
          const audPagina       = auditFiltrada.slice((auditoriaPage - 1) * AUDITORIA_PER_PAGE, auditoriaPage * AUDITORIA_PER_PAGE);

          return (
            <Card>
              <CardHeader className="pb-3">
                <button
                  className="w-full flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-left"
                  onClick={() => setHistorialAbierto(v => !v)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                      <History className="size-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle>Historial de Cambios</CardTitle>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {auditoria.length} registro{auditoria.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <ChevronDown className={`size-5 text-slate-400 shrink-0 mt-1 transition-transform ${historialAbierto ? 'rotate-180' : ''}`} />
                </button>

                {/* Chips de filtro — solo visibles cuando está expandido */}
                {historialAbierto && auditoria.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => { setAuditFiltro('todos'); setAuditoriaPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        auditFiltro === 'todos'
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      Todos
                      <span className={`font-bold ${auditFiltro === 'todos' ? 'text-slate-300' : 'text-slate-400'}`}>
                        {auditoria.length}
                      </span>
                    </button>
                    {Object.entries(conteoPorAccion).map(([accion, count]) => {
                      const cfg = getCfg(accion);
                      const activo = auditFiltro === accion;
                      return (
                        <button
                          key={accion}
                          onClick={() => { setAuditFiltro(activo ? 'todos' : accion); setAuditoriaPage(1); }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                            activo
                              ? `${cfg.bg} ${cfg.border} ${cfg.color} ring-2 ring-offset-1 ring-current/40`
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className={`size-2 rounded-full shrink-0 ${cfg.dot}`} />
                          {accion}
                          <span className={`font-bold ${activo ? '' : 'text-slate-400'}`}>{count as number}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardHeader>

              {historialAbierto && <CardContent>
                {auditoria.length === 0 ? (
                  <div className="text-center py-14">
                    <div className="inline-flex items-center justify-center size-14 rounded-full bg-slate-100 mb-4">
                      <History className="size-7 text-slate-300" />
                    </div>
                    <p className="font-medium text-slate-500">Sin registros aún</p>
                    <p className="text-sm text-slate-400 mt-1">Los cambios en usuarios aparecerán aquí automáticamente</p>
                  </div>
                ) : auditFiltrada.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-slate-400">Sin registros para esta acción.</p>
                    <button
                      onClick={() => { setAuditFiltro('todos'); setAuditoriaPage(1); }}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Ver todos los registros
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Timeline */}
                    <div className="relative pl-1">
                      <div className="absolute left-[19px] top-5 bottom-5 w-px bg-slate-200 dark:bg-slate-700" />
                      <div className="space-y-3">
                        {audPagina.map((entry) => {
                          const cfg = getCfg(entry.accion);
                          return (
                            <div key={entry.id} className="relative flex gap-3 items-start group">
                              {/* Ícono */}
                              <div className={`relative z-10 flex items-center justify-center size-10 rounded-full border-2 border-white shadow-sm shrink-0 ${cfg.bg}`}>
                                <span className={cfg.color}>{cfg.icon}</span>
                              </div>

                              {/* Tarjeta */}
                              <div className={`flex-1 p-3.5 rounded-xl border transition-shadow group-hover:shadow-sm ${cfg.bg} ${cfg.border}`}>
                                <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[11px] font-bold uppercase tracking-wider ${cfg.color}`}>
                                      {entry.accion ?? '—'}
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-medium">
                                      · {entry.usuarioNombre}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                                    <Clock className="size-3" />
                                    {entry.fechaHora}
                                  </span>
                                </div>

                                {/* Detalle */}
                                {entry.accion === 'EDICIÓN' && Array.isArray(entry.cambios) && entry.cambios.length > 0 ? (
                                  <div className="space-y-1 mt-1">
                                    {entry.cambios.map((c: any, i: number) => (
                                      <div key={i} className="flex items-center gap-1.5 text-xs">
                                        <span className="font-semibold text-slate-600 shrink-0">{c.campo}:</span>
                                        <span className="text-red-500 line-through truncate max-w-[120px]" title={c.antes}>{c.antes}</span>
                                        <span className="text-slate-400">→</span>
                                        <span className="text-emerald-600 font-medium truncate max-w-[120px]" title={c.despues}>{c.despues}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-700 leading-relaxed">{getDetalle(entry)}</p>
                                )}

                                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-current/10">
                                  <UserCircle2 className={`size-3.5 ${cfg.color} opacity-70`} />
                                  <span className="text-xs text-slate-500">
                                    <span className="font-semibold text-slate-600">{entry.adminResponsable}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Paginación */}
                    {totalAudPaginas > 1 && (
                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-500">
                          {(auditoriaPage - 1) * AUDITORIA_PER_PAGE + 1}–{Math.min(auditoriaPage * AUDITORIA_PER_PAGE, auditFiltrada.length)} de {auditFiltrada.length} registro{auditFiltrada.length !== 1 ? 's' : ''}
                          {auditFiltro !== 'todos' && (
                            <button onClick={() => { setAuditFiltro('todos'); setAuditoriaPage(1); }} className="ml-2 text-blue-600 hover:underline">
                              Ver todos
                            </button>
                          )}
                        </p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setAuditoriaPage(1)} disabled={auditoriaPage === 1}
                            className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">«</button>
                          <button onClick={() => setAuditoriaPage(p => Math.max(1, p - 1))} disabled={auditoriaPage === 1}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">‹ Ant.</button>
                          <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg">
                            {auditoriaPage} / {totalAudPaginas}
                          </span>
                          <button onClick={() => setAuditoriaPage(p => Math.min(totalAudPaginas, p + 1))} disabled={auditoriaPage === totalAudPaginas}
                            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Sig. ›</button>
                          <button onClick={() => setAuditoriaPage(totalAudPaginas)} disabled={auditoriaPage === totalAudPaginas}
                            className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">»</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>}
            </Card>
          );
        })()}
      </div>

      {/* ── Modal Crear Usuario ── */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
          <DialogHeader className="bg-gradient-to-br from-[#021810] to-[#054030] p-6 text-white relative">
            <div className="absolute inset-0 opacity-5" style={{backgroundImage:'radial-gradient(#fff 1px,transparent 1px)',backgroundSize:'20px 20px'}}/>
            <DialogTitle className="flex items-center gap-2.5 text-xl font-bold text-white relative z-10">
              <UserCircle className="size-6 text-[#f0c040]" />
              Crear Nuevo Usuario
            </DialogTitle>
            <DialogDescription className="text-emerald-100/70 text-xs font-medium mt-1 relative z-10">
              Completa los datos del nuevo usuario para registrarlo en el sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
            {/* Sección 1: Información Personal y de Contacto */}
            <div className="bg-slate-50/40 border border-slate-100 rounded-2xl p-4 space-y-4 transition-all">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-1">
                <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-700">
                  <UserCircle2 className="size-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Información Personal</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c-nombre" className="text-slate-700 font-semibold text-xs">Nombre completo *</Label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input id="c-nombre" placeholder="Juan Pérez"
                      value={formData.nombre}
                      onChange={e => handleFormChange('nombre', e.target.value)}
                      onBlur={e => validarCampoUsuario('nombre', e.target.value)}
                      className={`pl-9 h-10 rounded-xl transition-all ${formErrors.nombre ? 'border-red-400 bg-red-50/10 focus:ring-red-100' : 'border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-50/20'}`} />
                  </div>
                  {formErrors.nombre && <p className="text-[11px] text-red-500 flex items-center gap-1 font-medium mt-1 animate-pulse"><AlertTriangle className="size-3 shrink-0"/>{formErrors.nombre}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="c-identificacion" className="text-slate-700 font-semibold text-xs">Identificación *</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input id="c-identificacion" placeholder="1010123456"
                      inputMode="numeric" maxLength={15}
                      value={formData.cedula}
                      onChange={(e) => { const v = e.target.value.replace(/\D/g,'').slice(0,15); handleFormChange('cedula', v); }}
                      onBlur={e => validarCampoUsuario('cedula', e.target.value)}
                      className={`pl-9 h-10 rounded-xl transition-all ${formErrors.cedula ? 'border-red-400 bg-red-50/10 focus:ring-red-100' : 'border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-50/20'}`} />
                  </div>
                  {formErrors.cedula ? (
                    <p className="text-[11px] text-red-500 flex items-center gap-1 font-medium mt-1 animate-pulse"><AlertTriangle className="size-3 shrink-0"/>{formErrors.cedula}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1 pl-1">Solo números, de 6 a 15 dígitos</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c-email" className="text-slate-700 font-semibold text-xs">Correo electrónico *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input id="c-email" type="email" placeholder="juan.perez@ufca.com"
                      value={formData.email}
                      onChange={e => handleFormChange('email', e.target.value)}
                      onBlur={e => validarCampoUsuario('email', e.target.value)}
                      className={`pl-9 h-10 rounded-xl transition-all ${formErrors.email ? 'border-red-400 bg-red-50/10 focus:ring-red-100' : 'border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-50/20'}`} />
                  </div>
                  {formErrors.email && <p className="text-[11px] text-red-500 flex items-center gap-1 font-medium mt-1 animate-pulse"><AlertTriangle className="size-3 shrink-0"/>{formErrors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="c-telefono" className="text-slate-700 font-semibold text-xs">Teléfono *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input id="c-telefono" placeholder="+57 300 111 2222"
                      inputMode="tel" maxLength={15}
                      value={formData.telefono}
                      onChange={(e) => { const v = e.target.value.replace(/[^\d+\s\-()]/g,'').slice(0,15); handleFormChange('telefono', v); }}
                      onBlur={e => validarCampoUsuario('telefono', e.target.value)}
                      className={`pl-9 h-10 rounded-xl transition-all ${formErrors.telefono ? 'border-red-400 bg-red-50/10 focus:ring-red-100' : 'border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-50/20'}`} />
                  </div>
                  {formErrors.telefono ? (
                    <p className="text-[11px] text-red-500 flex items-center gap-1 font-medium mt-1 animate-pulse"><AlertTriangle className="size-3 shrink-0"/>{formErrors.telefono}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400 mt-1 pl-1">Máximo 15 caracteres</p>
                  )}
                </div>
              </div>
            </div>

            {/* Sección 2: Credenciales y Rol */}
            <div className="bg-slate-50/40 border border-slate-100 rounded-2xl p-4 space-y-4 transition-all">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-1">
                <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-700">
                  <Lock className="size-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Credenciales del Sistema</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c-username" className="text-slate-700 font-semibold text-xs">Nombre de usuario *</Label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input id="c-username" placeholder="juan.perez"
                      value={formData.username}
                      onChange={e => handleFormChange('username', e.target.value)}
                      onBlur={e => validarCampoUsuario('username', e.target.value)}
                      className={`pl-9 h-10 rounded-xl transition-all ${formErrors.username ? 'border-red-400 bg-red-50/10 focus:ring-red-100' : 'border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-50/20'}`} />
                  </div>
                  {formErrors.username && <p className="text-[11px] text-red-500 flex items-center gap-1 font-medium mt-1 animate-pulse"><AlertTriangle className="size-3 shrink-0"/>{formErrors.username}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="c-rol" className="text-slate-700 font-semibold text-xs">Rol de Usuario *</Label>
                  <Select
                    value={formData.rolId}
                    onValueChange={(id: string) => {
                      const r = roles.find(r => r.id === id);
                      setFormData(prev => ({ ...prev, rolId: id, rol: r ? (r.label ?? rolLabel(r.nombre)) : '' }));
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-emerald-50/20 transition-all">
                      <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white">
                      {roles.map(r => (
                        <SelectItem key={r.id} value={r.id} className="rounded-lg">{r.label ?? rolLabel(r.nombre)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Sección 3: Datos de Asociado (Condicional) */}
            {formData.rol === 'Asociado' && (
              <div className="bg-gradient-to-br from-emerald-50/30 to-emerald-50/70 border border-emerald-100 rounded-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center gap-2.5 border-b border-emerald-100/50 pb-2 mb-1">
                  <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
                    <User className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">Datos de Asociado</h3>
                    <p className="text-[10px] text-emerald-800/80 font-medium">Requeridos para el registro de asociados activos</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="c-direccion" className="text-emerald-950 font-semibold text-xs">Dirección de residencia *</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-emerald-600" />
                      <Input id="c-direccion" placeholder="Calle 10 # 5-20, Florencia"
                        value={formData.direccion}
                        onChange={e => handleFormChange('direccion', e.target.value)}
                        onBlur={e => validarCampoUsuario('direccion', e.target.value)}
                        className={`pl-9 h-10 rounded-xl transition-all ${formErrors.direccion ? 'border-red-400 bg-red-50/10 focus:ring-red-100' : 'border-emerald-200 bg-white/80 focus:bg-white focus:border-emerald-600 focus:ring-emerald-50/20'}`} />
                    </div>
                    {formErrors.direccion && <p className="text-[11px] text-red-500 flex items-center gap-1 font-medium mt-1 animate-pulse"><AlertTriangle className="size-3 shrink-0"/>{formErrors.direccion}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="c-fecha-ingreso" className="text-emerald-950 font-semibold text-xs">Fecha de ingreso *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-emerald-600" />
                      <Input id="c-fecha-ingreso" type="date"
                        value={formData.fechaIngreso}
                        onChange={e => handleFormChange('fechaIngreso', e.target.value)}
                        onBlur={e => validarCampoUsuario('fechaIngreso', e.target.value)}
                        className={`pl-9 h-10 rounded-xl transition-all ${formErrors.fechaIngreso ? 'border-red-400 bg-red-50/10 focus:ring-red-100' : 'border-emerald-200 bg-white/80 focus:bg-white focus:border-emerald-600 focus:ring-emerald-50/20'}`} />
                    </div>
                    {formErrors.fechaIngreso && <p className="text-[11px] text-red-500 flex items-center gap-1 font-medium mt-1 animate-pulse"><AlertTriangle className="size-3 shrink-0"/>{formErrors.fechaIngreso}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-50 px-6 py-4 flex gap-2 border-t border-slate-100 justify-end">
            <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="rounded-xl h-10 px-5 font-semibold text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800 transition-all">
              Cancelar
            </Button>
            <Button onClick={handleCreate} className="rounded-xl h-10 px-5 font-semibold bg-gradient-to-r from-emerald-600 to-[#0a7050] hover:from-emerald-700 hover:to-[#054030] text-white shadow-lg shadow-emerald-900/10 hover:shadow-emerald-900/20 hover:scale-[1.01] active:scale-[0.99] transition-all">
              Crear usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Editar Usuario ── */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="size-5 text-emerald-600" />
              Editar Usuario: {selectedUsuario?.nombre}
            </DialogTitle>
            <DialogDescription>Actualiza la información del usuario</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Alerta cuando la identificación es inválida (letras) o está vacía */}
            {selectedUsuario && (tieneLetrasId(selectedUsuario.cedula ?? '') || !selectedUsuario.cedula) && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm">
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  {tieneLetrasId(selectedUsuario.cedula ?? '')
                    ? <>Este usuario tenía la identificación <strong>"{selectedUsuario.cedula}"</strong> con letras, lo cual no es válido.</>
                    : <>Este usuario no tiene número de identificación registrado.</>
                  }
                  {' '}Por favor ingresa el número de documento correcto (solo dígitos, máx. 15).
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="e-identificacion">Identificación * <span className="text-xs text-slate-400 font-normal">(solo números, máx. 15)</span></Label>
                <Input id="e-identificacion" placeholder="1010123456"
                  inputMode="numeric" maxLength={15}
                  value={formData.cedula}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g,'').slice(0,15); handleEditChange('cedula', v); }}
                  className={formErrors.cedula ? 'border-red-400' : ''} />
                {formErrors.cedula && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{formErrors.cedula}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-username">Nombre de usuario *</Label>
                <Input id="e-username" placeholder="juan.perez"
                  value={formData.username}
                  onChange={(e) => handleEditChange('username', e.target.value)}
                  className={formErrors.username ? 'border-red-400' : ''} />
                {formErrors.username && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{formErrors.username}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="e-nombre">Nombre completo *</Label>
                <Input id="e-nombre" placeholder="Juan Pérez"
                  value={formData.nombre}
                  onChange={(e) => handleEditChange('nombre', e.target.value)}
                  className={formErrors.nombre ? 'border-red-400' : ''} />
                {formErrors.nombre && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{formErrors.nombre}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-email">Email *</Label>
                <Input id="e-email" type="email" placeholder="juan.perez@ufca.com"
                  value={formData.email}
                  onChange={(e) => handleEditChange('email', e.target.value)}
                  className={formErrors.email ? 'border-red-400' : ''} />
                {formErrors.email && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{formErrors.email}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="e-telefono">Teléfono <span className="text-xs text-slate-400 font-normal">(máx. 15 caracteres)</span></Label>
                <Input id="e-telefono" placeholder="+57 300 111 2222"
                  inputMode="tel" maxLength={15}
                  value={formData.telefono}
                  onChange={(e) => { const v = e.target.value.replace(/[^\d+\s\-()]/g,'').slice(0,15); handleEditChange('telefono', v); }}
                  className={formErrors.telefono ? 'border-red-400' : ''} />
                {formErrors.telefono && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3"/>{formErrors.telefono}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-rol">Rol *</Label>
                <Select
                  value={formData.rolId}
                  onValueChange={(id: string) => {
                    const r = roles.find(r => r.id === id);
                    setFormData(prev => ({ ...prev, rolId: id, rol: r ? (r.label ?? rolLabel(r.nombre)) : '' }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label ?? rolLabel(r.nombre)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-direccion">Dirección</Label>
              <Input id="e-direccion" placeholder="Calle 10 # 5-20, Florencia"
                value={formData.direccion}
                onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))} />
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                <strong>Nota:</strong> Para cambiar la contraseña, el usuario debe solicitarlo desde la página de inicio de sesión.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setIsEditModalOpen(false); setSelectedUsuario(null); }}>Cancelar</Button>
            <Button onClick={handleEdit} className="bg-emerald-600 hover:bg-emerald-700">Actualizar usuario</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Ver Detalles ── */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5 text-emerald-600" />
              Detalles del Usuario
            </DialogTitle>
            <DialogDescription>Información completa del usuario</DialogDescription>
          </DialogHeader>
          {selectedUsuario && (
            <div className="space-y-4 py-2">
              {/* Encabezado del perfil */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="p-4 bg-cyan-100 rounded-full">
                  <UserCircle className="size-10 text-cyan-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900">{selectedUsuario.nombre}</h3>
                  <p className="text-sm text-slate-500">@{selectedUsuario.username}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getRolColor(selectedUsuario.rol)}>{selectedUsuario.rol}</Badge>
                    <Badge className={selectedUsuario.estado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                      {selectedUsuario.estado ? '● Activo' : '● Inactivo'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Datos personales */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <User className="size-4 text-slate-500" />
                  Datos personales
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <Label className="text-xs text-slate-500">Nombre completo</Label>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedUsuario.nombre || '—'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Nombre de usuario</Label>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">
                      {selectedUsuario.username && selectedUsuario.username !== '—'
                        ? `@${selectedUsuario.username}`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Identificación</Label>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-sm font-medium text-slate-900">
                        {selectedUsuario.cedula && !selectedUsuario.cedula.includes('-')
                          ? selectedUsuario.cedula
                          : '—'}
                      </p>
                      {(tieneLetrasId(selectedUsuario.cedula ?? '') || !selectedUsuario.cedula) && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300">
                          <AlertTriangle className="size-2.5" />
                          Pendiente
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Teléfono</Label>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">
                      {selectedUsuario.telefono || '—'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-slate-500">Correo electrónico</Label>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedUsuario.email || '—'}</p>
                  </div>
                  {selectedUsuario.direccion && (
                    <div className="col-span-2">
                      <Label className="text-xs text-slate-500">Dirección</Label>
                      <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedUsuario.direccion}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-slate-500">Rol asignado</Label>
                    <p className="text-sm font-medium mt-0.5">
                      <Badge className={`${getRolColor(selectedUsuario.rol)} text-xs`}>{selectedUsuario.rol}</Badge>
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Estado</Label>
                    <p className="text-sm font-medium mt-0.5">
                      <Badge className={`text-xs ${selectedUsuario.estado ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {selectedUsuario.estado ? '● Activo' : '● Inactivo'}
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>

              {/* Fechas y acceso */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="size-4 text-slate-500" />
                  Historial de actividad
                </h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <Label className="text-xs text-slate-500">Fecha de creación</Label>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedUsuario.fechaCreacion}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Última modificación</Label>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedUsuario.fechaModificacion}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs text-slate-500">Último acceso al sistema</Label>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedUsuario.ultimoAcceso}</p>
                  </div>
                </div>
              </div>

              {!selectedUsuario.estado && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-sm">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>Este usuario está <strong>inactivo</strong> y no puede iniciar sesión ni realizar acciones en el sistema.</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDetailModalOpen(false); setSelectedUsuario(null); }}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal Eliminar ── */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="size-5" />
              ¿Eliminar usuario permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Estás a punto de eliminar a <strong className="text-slate-900">"{selectedUsuario?.nombre}"</strong> (@{selectedUsuario?.username}).
                Esta acción <strong>no se puede deshacer</strong>.
              </span>
              <span className="block p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <span className="flex items-center gap-2 mb-1 font-medium">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  Consecuencias de la eliminación:
                </span>
                <ul className="space-y-1 ml-5 list-disc text-xs">
                  <li>El usuario no podrá iniciar sesión</li>
                  <li>No aparecerá en listados operativos</li>
                  <li>La acción quedará registrada en auditoría</li>
                </ul>
              </span>
              <span className="block text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                ⚠️ <strong>Solo para cuentas sin historial financiero</strong> (creadas por error o de prueba).
                Si el usuario tiene créditos o cuentas de ahorro — aunque estén pagados o cerrados —
                la eliminación será bloqueada. El flujo correcto es: cerrar créditos →
                crear <strong>Liquidación</strong> → <strong>desactivar</strong> la cuenta.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedUsuario(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Modal Cambiar Estado ── */}
      <AlertDialog open={isToggleEstadoDialogOpen} onOpenChange={setIsToggleEstadoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio de estado?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de {selectedUsuario?.estado ? 'desactivar' : 'activar'} al usuario "{selectedUsuario?.nombre}".
              {selectedUsuario?.estado && ' El usuario no podrá acceder al sistema mientras esté inactivo.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedUsuario(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleToggleEstado(selectedUsuario?.id)}
              className={selectedUsuario?.estado ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'}
            >
              {selectedUsuario?.estado ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Modal Corregir Identificación ── */}
      <Dialog open={isFixIdModalOpen} onOpenChange={(open) => { if (!open) { setIsFixIdModalOpen(false); setFixIdUsuario(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Corregir identificación
            </DialogTitle>
            <DialogDescription>
              Ingresa el número de documento correcto para <strong>{fixIdUsuario?.nombre}</strong>.
              Solo se aceptan dígitos (máx. 15).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="fix-id-input">Número de identificación *</Label>
              <Input
                id="fix-id-input"
                placeholder="Ej: 1023456789"
                inputMode="numeric"
                maxLength={15}
                autoFocus
                value={fixIdValue}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 15);
                  setFixIdValue(val);
                  setFixIdError('');
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFixId(); }}
                className={fixIdError ? 'border-red-400 focus-visible:ring-red-200' : ''}
              />
              {fixIdError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="size-3 shrink-0" />
                  {fixIdError}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsFixIdModalOpen(false); setFixIdUsuario(null); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveFixId}
              disabled={fixIdLoading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {fixIdLoading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExpulsionDialog
        open={isExpulsionOpen}
        onOpenChange={setIsExpulsionOpen}
        asociado={expulsionAsociado}
        datos={datosExpulsion}
        ejecutando={ejecutandoExpulsion}
        onConfirm={ejecutarExpulsion}
        adminNombre={authUser?.nombre ?? authUser?.email ?? 'Administrador'}
        onSuccess={cargarDatos}
      />
    </div>
  );
}