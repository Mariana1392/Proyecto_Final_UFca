import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, UserCircle, Users, CheckCircle2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';

export default function UsuariosScreen() {
  const { userRole } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formNombre, setFormNombre] = useState('');
  const [formCedula, setFormCedula] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRolId, setFormRolId] = useState('');
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: usData, error: usErr }, { data: rolesData }] = await Promise.all([
        supabase.from('usuarios').select('id,nombre,cedula,email,username,activo,rol_id,roles(nombre)').order('nombre'),
        supabase.from('roles').select('id,nombre').order('nombre')
      ]);

      if (usErr) throw usErr;

      setUsuarios(usData ?? []);
      setRoles(rolesData ?? []);
    } catch (err: any) {
      toast.error('Error al cargar usuarios: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleCreate = async () => {
    if (!formNombre.trim() || !formCedula.trim() || !formEmail.trim() || !formUsername.trim() || !formPassword.trim() || !formRolId) {
      return toast.error('Por favor completa todos los campos requeridos');
    }
    if (formPassword.length < 6) {
      return toast.error('La contraseña debe tener al menos 6 caracteres');
    }

    setSaving(true);
    try {
      // 1. Crear en Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: formEmail.trim(),
        password: formPassword.trim(),
        options: { data: { nombre: formNombre.trim() } },
      });
      if (authErr) throw authErr;
      if (!authData.user) throw new Error('Error en Auth de Supabase');

      // 2. Crear en tabla usuarios
      const payload = {
        id: authData.user.id,
        nombre: formNombre.trim(),
        email: formEmail.trim(),
        username: formUsername.trim().toLowerCase(),
        cedula: formCedula.trim(),
        rol_id: formRolId,
        activo: true,
        estado_cuenta: 'activo',
      };

      const { error: dbErr } = await supabase.from('usuarios').insert(payload);
      if (dbErr) throw dbErr;

      toast.success('Usuario creado exitosamente');
      setIsCreateOpen(false);
      
      // Limpiar formulario
      setFormNombre(''); setFormCedula(''); setFormEmail('');
      setFormUsername(''); setFormPassword(''); setFormRolId('');
      
      cargar();
    } catch (err: any) {
      toast.error('Error al crear usuario: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (id: string, currentStatus: boolean, esAdminProp: boolean) => {
    if (esAdminProp && currentStatus) {
      return toast.error('No se puede desactivar a un administrador.');
    }
    try {
      const { error } = await supabase.from('usuarios').update({ activo: !currentStatus }).eq('id', id);
      if (error) throw error;
      toast.success(`Usuario ${!currentStatus ? 'activado' : 'desactivado'}`);
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, activo: !currentStatus } : u));
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  if (userRole !== 'admin') {
    return <div className="p-4 text-center text-muted-foreground">Acceso denegado</div>;
  }

  const filtered = usuarios.filter(u => 
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.cedula?.includes(searchTerm) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Usuarios</h2>
          <p className="text-xs text-muted-foreground">Directorio y gestión</p>
        </div>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 px-3 text-xs gap-1.5" onClick={() => setIsCreateOpen(true)}>
          <Plus size={14} />
          Nuevo
        </Button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nombre, cédula o correo..." 
          className="pl-9 h-10 text-sm bg-card border-none shadow-sm"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3" />
            Cargando usuarios...
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed shadow-none bg-transparent">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="size-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-foreground">No hay usuarios</p>
              <p className="text-xs text-muted-foreground mt-1">No se encontraron resultados.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(u => (
            <Card key={u.id} className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <UserCircle className="size-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground leading-tight">{u.nombre}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{u.cedula} · {u.email}</p>
                      <div className="flex gap-1.5 mt-1.5">
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 border-none ${u.roles?.nombre === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {u.roles?.nombre || 'Usuario'}
                        </Badge>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 border-none ${u.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full"
                    onClick={() => handleToggleActivo(u.id, u.activo, u.roles?.nombre === 'admin')}
                  >
                    {u.activo ? <XCircle size={18} className="text-red-500" /> : <CheckCircle2 size={18} className="text-emerald-500" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog Crear Usuario */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md w-[95vw] rounded-xl">
          <DialogHeader className="text-left">
            <DialogTitle>Nuevo Usuario</DialogTitle>
            <DialogDescription>Registra un nuevo asociado o administrador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre completo</Label>
              <Input className="h-9 text-sm" value={formNombre} onChange={e => setFormNombre(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Identificación</Label>
                <Input 
                  className="h-9 text-sm" 
                  type="number" 
                  value={formCedula} 
                  onChange={e => {
                    const val = e.target.value;
                    if (val.length <= 10) setFormCedula(val);
                    else toast.error('La cédula no puede exceder los 10 dígitos');
                  }} 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre de usuario</Label>
                <Input className="h-9 text-sm" value={formUsername} onChange={e => setFormUsername(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Correo electrónico</Label>
              <Input className="h-9 text-sm" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contraseña temporal</Label>
                <Input className="h-9 text-sm" type="text" value={formPassword} onChange={e => setFormPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rol del sistema</Label>
                <select
                  value={formRolId}
                  onChange={e => setFormRolId(e.target.value)}
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4 flex flex-row gap-2">
            <Button variant="outline" className="flex-1 h-9" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700" onClick={handleCreate} disabled={saving}>
              {saving ? 'Guardando...' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
