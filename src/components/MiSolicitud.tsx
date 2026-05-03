import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  UserCircle, FileText, CheckCircle2, Clock, XCircle, Send, UserPlus,
  MapPin, Calendar, Award, Shield, PiggyBank, CreditCard, Users,
  TrendingUp, Target, Trophy, Sparkles, Upload, X, FileImage,
  ExternalLink, AlertTriangle, Briefcase, MessageSquare,
} from 'lucide-react';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

// ─── tipos de identificación ────────────────────────────────────────────────
const TIPOS_ID = [
  { value: 'CC',  label: 'Cédula de Ciudadanía (CC)' },
  { value: 'TI',  label: 'Tarjeta de Identidad (TI)' },
  { value: 'CE',  label: 'Cédula de Extranjería (CE)' },
  { value: 'PP',  label: 'Pasaporte (PP)' },
  { value: 'NIT', label: 'NIT' },
];

// ─── Reglas de validación por tipo de ID ────────────────────────────────────
const ID_RULES: Record<string, { soloNumeros: boolean; min: number; max: number; hint: string }> = {
  CC:  { soloNumeros: true,  min: 6,  max: 10, hint: '6–10 dígitos numéricos' },
  TI:  { soloNumeros: true,  min: 8,  max: 11, hint: '8–11 dígitos numéricos' },
  CE:  { soloNumeros: false, min: 6,  max: 12, hint: '6–12 caracteres alfanuméricos' },
  PP:  { soloNumeros: false, min: 5,  max: 12, hint: '5–12 caracteres alfanuméricos' },
  NIT: { soloNumeros: true,  min: 9,  max: 10, hint: '9–10 dígitos (sin guion ni dígito de verificación)' },
};

function validarNumeroId(tipo: string, valor: string): string | null {
  const v = valor.trim();
  if (!v) return 'El número de identificación es obligatorio';
  const r = ID_RULES[tipo];
  if (!r) return null;
  if (r.soloNumeros && !/^\d+$/.test(v))
    return `El ${TIPOS_ID.find(t => t.value === tipo)?.label ?? tipo} solo debe contener dígitos numéricos`;
  if (!r.soloNumeros && !/^[a-zA-Z0-9]+$/.test(v))
    return 'Solo se permiten letras y números (sin espacios ni caracteres especiales)';
  if (v.length < r.min) return `Debe tener al menos ${r.min} caracteres (${r.hint})`;
  if (v.length > r.max) return `No puede superar ${r.max} caracteres (${r.hint})`;
  return null;
}

function validarTelefono(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  const limpio = v.replace(/[\s\-().]/g, '');
  if (!/^(\+57)?[0-9]{10}$/.test(limpio) && !/^[0-9]{7}$/.test(limpio))
    return 'Número inválido. Ej: 3001234567 o +573001234567';
  return null;
}

function validarIngreso(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return 'Ingresa solo números (ej: 2500000)';
  if (parseFloat(v) <= 0) return 'El ingreso debe ser mayor a 0';
  return null;
}

function validarMotivacion(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  if (v.length < 20) return `Mínimo 20 caracteres (llevas ${v.length})`;
  if (v.length > 1000) return 'Máximo 1000 caracteres';
  return null;
}

interface Solicitud {
  id: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  nombres: string;
  apellidos: string;
  cedula: string;
  tipo_identificacion: string | null;
  telefono: string | null;
  direccion: string | null;
  ocupacion: string | null;
  ingreso_mensual: string | null;
  motivacion: string | null;
  documentos: string[] | null;
  observaciones: string | null;
  fecha_solicitud: string;
}

const ESTADO_CONFIG = {
  pendiente: {
    label: 'Pendiente de revisión',
    Icon: Clock,
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  aprobada: {
    label: 'Solicitud aprobada',
    Icon: CheckCircle2,
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rechazada: {
    label: 'Solicitud rechazada',
    Icon: XCircle,
    cls: 'bg-red-50 text-red-700 border-red-200',
  },
};

// ─── Slot de archivo ────────────────────────────────────────────────────────
interface ArchivoSlotProps {
  label: string;
  accept: string;
  file: File | null;
  required?: boolean;
  hint: string;
  onChange: (f: File | null) => void;
}
function ArchivoSlot({ label, accept, file, required, hint, onChange }: ArchivoSlotProps) {
  const ref = useRef<HTMLInputElement>(null);
  const esImagen = file ? file.type.startsWith('image/') : false;
  const esPdf    = file ? file.type === 'application/pdf' : false;

  return (
    <div className={`relative rounded-xl border-2 border-dashed transition-colors p-4 ${
      file ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-emerald-200'
    }`}>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${esPdf ? 'bg-red-100' : 'bg-blue-100'}`}>
            {esPdf ? (
              <FileText className="size-5 text-red-600" />
            ) : (
              <FileImage className="size-5 text-blue-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB · {esPdf ? 'PDF' : 'Imagen'}</p>
          </div>
          <button
            type="button"
            onClick={() => { onChange(null); if (ref.current) ref.current.value = ''; }}
            className="p-1 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="w-full text-left">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-200 rounded-lg shrink-0">
              <Upload className="size-5 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">
                {label} {required && <span className="text-red-500">*</span>}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function MiSolicitud() {
  const { user } = useAuth();

  const [solicitud, setSolicitud]       = useState<Solicitud | null>(null);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  // Campos del formulario
  const [tipoId, setTipoId]             = useState('CC');
  const [cedula, setCedula]             = useState('');
  const [telefono, setTelefono]         = useState('');
  const [direccion, setDireccion]       = useState('');
  const [ocupacion, setOcupacion]       = useState('');
  const [ingresoMensual, setIngresoMensual] = useState('');
  const [motivacion, setMotivacion]     = useState('');
  // Archivos: cédula y extracto bancario (ambos opcionales)
  const [pdf1, setPdf1] = useState<File | null>(null);
  const [pdf2, setPdf2] = useState<File | null>(null);

  // Errores de validación en tiempo real
  const [cedulaError, setCedulaError]           = useState<string | null>(null);
  const [cedulaTouched, setCedulaTouched]       = useState(false);
  const [telefonoError, setTelefonoError]       = useState<string | null>(null);
  const [ingresoError, setIngresoError]         = useState<string | null>(null);
  const [motivacionError, setMotivacionError]   = useState<string | null>(null);
  const [cedulaDuplicada, setCedulaDuplicada]   = useState(false);

  useEffect(() => { cargarSolicitud(); }, []);

  async function cargarSolicitud() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('solicitudes_asociados')
        .select('id,estado,nombres,apellidos,cedula,tipo_identificacion,telefono,direccion,ocupacion,ingreso_mensual,motivacion,documentos,observaciones,fecha_solicitud')
        .eq('usuario_id', user.id)
        .order('fecha_solicitud', { ascending: false })
        .limit(1)
        .maybeSingle();
      setSolicitud(data ?? null);
    } catch { /* tabla puede no existir aún */ }
    setLoading(false);
  }

  // Sube un archivo a Supabase Storage y devuelve la URL pública
  async function subirArchivo(file: File): Promise<string> {
    const BUCKET = 'solicitudes';

    // Intentar crear el bucket si no existe (falla silenciosamente si ya existe
    // o si no hay permisos — en ese caso el upload fallará con mensaje claro)
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024, // 5 MB
    }).catch(() => { /* ya existe o sin permisos — continuamos */ });

    const ext  = file.name.split('.').pop() ?? 'bin';
    const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      if (error.message.toLowerCase().includes('bucket not found')) {
        throw new Error(
          'El almacenamiento de archivos no está configurado. ' +
          'Crea el bucket "solicitudes" en Supabase Dashboard → Storage → New bucket (público).'
        );
      }
      throw new Error(`Error al subir "${file.name}": ${error.message}`);
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    // ── Validación completa antes de enviar ──────────────────────────────────
    setCedulaTouched(true);
    const errCedula   = validarNumeroId(tipoId, cedula);
    const errTelefono = validarTelefono(telefono);
    const errIngreso  = validarIngreso(ingresoMensual);
    const errMotiv    = validarMotivacion(motivacion);

    setCedulaError(errCedula);
    setTelefonoError(errTelefono);
    setIngresoError(errIngreso);
    setMotivacionError(errMotiv);

    if (errCedula || errTelefono || errIngreso || errMotiv) {
      toast.error('Corrige los errores del formulario antes de continuar');
      return;
    }
    // Validar tipos de archivo si se adjuntaron
    if (pdf1 && pdf1.type !== 'application/pdf') {
      toast.error('La cédula debe ser un archivo PDF');
      return;
    }
    if (pdf2 && pdf2.type !== 'application/pdf') {
      toast.error('El extracto bancario debe ser un archivo PDF');
      return;
    }
    // Validar tamaño de archivos (máx 5 MB)
    if (pdf1 && pdf1.size > 5 * 1024 * 1024) {
      toast.error('El archivo de cédula supera el límite de 5 MB');
      return;
    }
    if (pdf2 && pdf2.size > 5 * 1024 * 1024) {
      toast.error('El archivo de extracto bancario supera el límite de 5 MB');
      return;
    }

    setSubmitting(true);
    try {
      // Subir archivos (solo los que se adjuntaron)
      const urls: string[] = [];
      if (pdf1) urls.push(await subirArchivo(pdf1));
      if (pdf2) urls.push(await subirArchivo(pdf2));

      const partes    = user.nombre.trim().split(' ');
      const mitad     = Math.ceil(partes.length / 2);
      const nombres   = partes.slice(0, mitad).join(' ');
      const apellidos = partes.slice(mitad).join(' ') || nombres;

      // Payload base (columnas que siempre existen)
      const payloadBase: Record<string, any> = {
        usuario_id:      user.id,
        nombres,
        apellidos,
        email:           user.email,
        cedula:          cedula.trim(),
        telefono:        telefono.trim()       || null,
        direccion:       direccion.trim()      || null,
        ocupacion:       ocupacion.trim()      || null,
        ingreso_mensual: ingresoMensual.trim() || null,
        motivacion:      motivacion.trim()     || null,
        fecha_solicitud: new Date().toISOString(),
        estado:          'pendiente',
        observaciones:   null,
      };

      // Intentar con las columnas nuevas primero; si fallan, reintentar sin ellas
      const payloadCompleto = {
        ...payloadBase,
        tipo_identificacion: tipoId,
        documentos:          urls,
      };

      let error: any;

      const guardar = async (payload: Record<string, any>) => {
        // Si ya tenemos el id de la solicitud → actualizar directamente
        if (solicitud?.id) {
          return supabase.from('solicitudes_asociados').update(payload).eq('id', solicitud.id);
        }
        // Intentar insertar; si hay conflicto de cédula (constraint unique),
        // buscar el registro existente de ESTE usuario y actualizarlo
        const result = await supabase.from('solicitudes_asociados').insert(payload);
        if (result.error?.message?.includes('cedula_key') || result.error?.code === '23505') {
          // Existe una solicitud con esta cédula — buscar si pertenece a este usuario
          const { data: existente } = await supabase
            .from('solicitudes_asociados')
            .select('id, usuario_id')
            .eq('cedula', cedula.trim())
            .maybeSingle();
          if (existente?.usuario_id && existente.usuario_id !== user!.id) {
            throw new Error('Ya existe una solicitud registrada con esta cédula por otro usuario. Verifica el número de identificación.');
          }
          if (existente?.id) {
            return supabase.from('solicitudes_asociados').update(payload).eq('id', existente.id);
          }
        }
        return result;
      };

      ({ error } = await guardar(payloadCompleto));

      // Si falló por columna inexistente, reintentar solo con campos base
      if (error && (error.message?.includes('column') || error.message?.includes('schema cache'))) {
        console.warn('Columnas nuevas no disponibles, guardando sin tipo_identificacion/documentos:', error.message);
        ({ error } = await guardar(payloadBase));
      }

      if (error) throw error;

      // Notificar al admin sobre la nueva solicitud
      await supabase.from('notificaciones').insert({
        titulo:     'Nueva solicitud de afiliación',
        mensaje:    `${nombres} ${apellidos} ha enviado una solicitud de membresía y está pendiente de revisión.`,
        tipo:       'solicitud_afiliacion',
        leida:      false,
        para_admin: true,
        asociado_id: null,
      }).then(() => {}).catch(() => {}); // silencioso — no bloquea si falla

      toast.success('¡Solicitud enviada!', {
        description: 'El equipo de UFCA revisará tu solicitud pronto.',
      });
      setShowForm(false);
      setPdf1(null); setPdf2(null);
      await cargarSolicitud();
    } catch (err: any) {
      const msg: string = err.message ?? '';
      // Error de cédula duplicada → marcar el campo visualmente
      if (
        msg.includes('cedula_key') ||
        msg.includes('23505') ||
        msg.toLowerCase().includes('cédula') ||
        msg.toLowerCase().includes('cedula') ||
        msg.toLowerCase().includes('duplicate')
      ) {
        setCedulaDuplicada(true);
        setCedulaError('Esta cédula ya tiene una solicitud registrada por otro usuario. Verifica el número.');
        toast.error('Número de identificación duplicado', {
          description: 'Ya existe una solicitud con este número en el sistema.',
        });
      } else {
        toast.error('Error al enviar solicitud', { description: msg });
      }
    }
    setSubmitting(false);
  }

  function resetForm() {
    setCedula(''); setTipoId('CC'); setTelefono('');
    setDireccion(''); setOcupacion(''); setIngresoMensual(''); setMotivacion('');
    setPdf1(null); setPdf2(null);
    setCedulaError(null); setCedulaTouched(false);
    setTelefonoError(null); setIngresoError(null); setMotivacionError(null);
    setCedulaDuplicada(false);
    setShowForm(false);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mi Portal</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Gestiona tu perfil y solicitud de membresía en UFCA
        </p>
      </div>

      {/* Tarjeta de perfil */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-full">
              <UserCircle className="size-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base">Mi Perfil</CardTitle>
              <CardDescription>Información de tu cuenta</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Nombre</p>
              <p className="text-slate-900 font-medium">{user?.nombre}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Correo electrónico</p>
              <p className="text-slate-900 font-medium">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Estado de cuenta</p>
              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                Activo
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Tipo</p>
              <Badge className="bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100">
                Usuario registrado
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Sección de solicitud / CTA ── */}
      {loading ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400 text-sm">Cargando...</CardContent>
        </Card>

      ) : !solicitud && !showForm ? (
        /* ── CTA: aún no hay solicitud ── */
        <Card className="border-2 border-dashed border-emerald-200 shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="py-10 text-center space-y-5">
            <div className="flex justify-center">
              <div className="p-5 bg-white rounded-full shadow-sm border border-emerald-100">
                <UserPlus className="size-12 text-emerald-500" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">¿Quieres ser asociado de UFCA?</h3>
              <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                Completa tu solicitud con tu identificación y documentos requeridos.
                El equipo la revisará y recibirás una respuesta pronto.
              </p>
            </div>
            <Button
              onClick={() => setShowForm(true)}
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200 px-10 gap-2 text-base"
            >
              <UserPlus className="size-5" />
              Hazte asociado
            </Button>
          </CardContent>
        </Card>

      ) : showForm ? (
        /* ── Formulario de solicitud ── */
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-full">
                <FileText className="size-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Solicitud de membresía</CardTitle>
                <CardDescription>Completa la información y adjunta tus documentos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Identificación */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Shield className="size-4 text-emerald-600" />
                  Identificación
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  {/* Tipo de ID */}
                  <div className="space-y-1.5">
                    <Label htmlFor="tipo-id">Tipo de identificación <span className="text-red-500">*</span></Label>
                    <Select
                      value={tipoId}
                      onValueChange={v => {
                        setTipoId(v);
                        setCedula('');
                        setCedulaError(null);
                        setCedulaTouched(false);
                        setCedulaDuplicada(false);
                      }}
                    >
                      <SelectTrigger id="tipo-id">
                        <SelectValue placeholder="Selecciona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_ID.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Número de identificación */}
                  <div className="space-y-1.5">
                    <Label htmlFor="sol-cedula">
                      Número de identificación <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="sol-cedula"
                      placeholder={
                        tipoId === 'CC'  ? 'Ej: 1023456789' :
                        tipoId === 'TI'  ? 'Ej: 10234567890' :
                        tipoId === 'CE'  ? 'Ej: CE123456' :
                        tipoId === 'PP'  ? 'Ej: AB123456' :
                        tipoId === 'NIT' ? 'Ej: 900123456' : ''}
                      value={cedula}
                      className={`transition-colors ${
                        cedulaTouched && cedulaError
                          ? 'border-red-400 focus-visible:ring-red-200 bg-red-50'
                          : cedulaTouched && !cedulaError && cedula.trim()
                          ? 'border-emerald-400 focus-visible:ring-emerald-200 bg-emerald-50/40'
                          : ''
                      }`}
                      onChange={e => {
                        const raw = e.target.value;
                        const regla = ID_RULES[tipoId];
                        // Filtrar caracteres no permitidos según el tipo
                        const filtrado = regla?.soloNumeros
                          ? raw.replace(/\D/g, '')
                          : raw.replace(/[^a-zA-Z0-9]/g, '');
                        setCedula(filtrado);
                        setCedulaTouched(true);
                        setCedulaDuplicada(false);
                        setCedulaError(validarNumeroId(tipoId, filtrado));
                      }}
                      onBlur={() => {
                        setCedulaTouched(true);
                        setCedulaError(validarNumeroId(tipoId, cedula));
                      }}
                    />
                    {/* Hint de formato */}
                    {!cedulaTouched && ID_RULES[tipoId] && (
                      <p className="text-xs text-slate-400">{ID_RULES[tipoId].hint}</p>
                    )}
                    {/* Error en tiempo real */}
                    {cedulaTouched && cedulaError && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="size-3 shrink-0" />
                        {cedulaError}
                      </p>
                    )}
                    {/* Éxito */}
                    {cedulaTouched && !cedulaError && cedula.trim() && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="size-3 shrink-0" />
                        Número válido
                      </p>
                    )}
                  </div>

                  {/* Teléfono */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="sol-telefono">Teléfono de contacto</Label>
                    <Input
                      id="sol-telefono"
                      type="tel"
                      placeholder="+57 300 123 4567"
                      value={telefono}
                      className={`transition-colors ${
                        telefonoError
                          ? 'border-red-400 focus-visible:ring-red-200 bg-red-50'
                          : telefono.trim() && !telefonoError
                          ? 'border-emerald-400 focus-visible:ring-emerald-200 bg-emerald-50/40'
                          : ''
                      }`}
                      onChange={e => {
                        // Solo permitir dígitos, +, espacios, guiones y paréntesis
                        const val = e.target.value.replace(/[^\d\s\+\-\(\)\.]/g, '');
                        setTelefono(val);
                        setTelefonoError(validarTelefono(val));
                      }}
                      onBlur={() => setTelefonoError(validarTelefono(telefono))}
                    />
                    {telefonoError && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="size-3 shrink-0" />
                        {telefonoError}
                      </p>
                    )}
                  </div>

                  {/* Dirección */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="sol-direccion">Dirección de residencia</Label>
                    <Input
                      id="sol-direccion"
                      placeholder="Ej: Calle 10 #20-30, Medellín"
                      value={direccion}
                      onChange={e => setDireccion(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Información laboral */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Briefcase className="size-4 text-emerald-600" />
                  Información laboral
                </h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sol-ocupacion">Ocupación / Cargo</Label>
                    <Input
                      id="sol-ocupacion"
                      placeholder="Ej: Contador, Docente…"
                      value={ocupacion}
                      onChange={e => setOcupacion(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sol-ingreso">Ingreso mensual (COP)</Label>
                    <Input
                      id="sol-ingreso"
                      inputMode="numeric"
                      placeholder="Ej: 2500000"
                      value={ingresoMensual}
                      className={`transition-colors ${
                        ingresoError
                          ? 'border-red-400 focus-visible:ring-red-200 bg-red-50'
                          : ingresoMensual.trim() && !ingresoError
                          ? 'border-emerald-400 focus-visible:ring-emerald-200 bg-emerald-50/40'
                          : ''
                      }`}
                      onChange={e => {
                        // Solo permitir dígitos y un punto decimal
                        const val = e.target.value.replace(/[^\d.]/g, '');
                        setIngresoMensual(val);
                        setIngresoError(validarIngreso(val));
                      }}
                      onBlur={() => setIngresoError(validarIngreso(ingresoMensual))}
                    />
                    {ingresoError && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="size-3 shrink-0" />
                        {ingresoError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Motivación */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <MessageSquare className="size-4 text-emerald-600" />
                  Motivación
                </h4>
                <div className="space-y-1.5">
                  <Textarea
                    id="sol-motivacion"
                    rows={3}
                    maxLength={1000}
                    className={`resize-none text-sm transition-colors ${
                      motivacionError
                        ? 'border-red-400 focus-visible:ring-red-200 bg-red-50'
                        : motivacion.trim().length >= 20
                        ? 'border-emerald-400 focus-visible:ring-emerald-200'
                        : ''
                    }`}
                    placeholder="¿Por qué deseas ingresar a la asociación UFCA? (mínimo 20 caracteres)"
                    value={motivacion}
                    onChange={e => {
                      setMotivacion(e.target.value);
                      setMotivacionError(validarMotivacion(e.target.value));
                    }}
                    onBlur={() => setMotivacionError(validarMotivacion(motivacion))}
                  />
                  <div className="flex items-center justify-between">
                    {motivacionError ? (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="size-3 shrink-0" />
                        {motivacionError}
                      </p>
                    ) : <span />}
                    <span className={`text-xs shrink-0 ${
                      motivacion.length > 950 ? 'text-amber-500' : 'text-slate-400'
                    }`}>
                      {motivacion.length}/1000
                    </span>
                  </div>
                </div>
              </div>

              {/* Documentos */}
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Upload className="size-4 text-emerald-600" />
                    Documentos adjuntos
                  </h4>
                  <span className="text-xs text-slate-400">Máx. 5 MB por archivo</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2 text-slate-600 text-xs">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-slate-400" />
                  <span>
                    Puedes adjuntar tu <strong>cédula</strong> y/o tu <strong>extracto bancario</strong> en formato PDF.
                    Ambos documentos son <strong>opcionales</strong>.
                  </span>
                </div>

                <div className="space-y-3">
                  <ArchivoSlot
                    label="Cédula de Ciudadanía"
                    accept="application/pdf"
                    file={pdf1}
                    hint="Opcional · Solo archivos PDF · Copia de tu cédula"
                    onChange={setPdf1}
                  />
                  <ArchivoSlot
                    label="Extracto bancario"
                    accept="application/pdf"
                    file={pdf2}
                    hint="Opcional · Solo archivos PDF · Extracto de cuenta bancaria"
                    onChange={setPdf2}
                  />
                </div>

                {/* Indicador de progreso de archivos */}
                <div className="flex items-center gap-2 pt-1">
                  {[pdf1, pdf2].map((f, i) => (
                    <div
                      key={i}
                      className={`flex-1 h-1.5 rounded-full transition-colors ${
                        f ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                  <span className="text-xs text-slate-500 shrink-0">
                    {[pdf1, pdf2].filter(Boolean).length} / 2 archivos
                  </span>
                </div>
              </div>

              {/* Resumen de errores si existen */}
              {(cedulaError || telefonoError || ingresoError || motivacionError) && cedulaTouched && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
                  <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" />
                    Corrige los siguientes errores:
                  </p>
                  {cedulaError    && <p className="text-xs text-red-600 pl-5">• {cedulaError}</p>}
                  {telefonoError  && <p className="text-xs text-red-600 pl-5">• {telefonoError}</p>}
                  {ingresoError   && <p className="text-xs text-red-600 pl-5">• {ingresoError}</p>}
                  {motivacionError && <p className="text-xs text-red-600 pl-5">• {motivacionError}</p>}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    !!(cedulaTouched && cedulaError) ||
                    !!telefonoError ||
                    !!ingresoError ||
                    !!motivacionError
                  }
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="size-4" />
                  {submitting ? 'Enviando...' : 'Enviar solicitud'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

      ) : solicitud ? (
        /* ── Estado de solicitud existente ── */
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 rounded-full">
                <FileText className="size-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Mi Solicitud de Membresía</CardTitle>
                <CardDescription>Estado actual de tu solicitud</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Banner de estado */}
            {(() => {
              const cfg = ESTADO_CONFIG[solicitud.estado];
              return (
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${cfg.cls}`}>
                  <cfg.Icon className="size-5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">{cfg.label}</p>
                    <p className="text-xs opacity-75 mt-0.5">
                      Enviada el{' '}
                      {new Date(solicitud.fecha_solicitud).toLocaleDateString('es-CO', {
                        day: '2-digit', month: 'long', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Motivo de rechazo */}
            {solicitud.estado === 'rechazada' && solicitud.observaciones && (
              <Alert variant="destructive" className="py-3">
                <AlertDescription>
                  <strong>Motivo del rechazo:</strong> {solicitud.observaciones}
                </AlertDescription>
              </Alert>
            )}

            {/* Datos enviados */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                {solicitud.tipo_identificacion && (
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Tipo de ID</p>
                    <p className="text-slate-800 text-sm mt-0.5">
                      {TIPOS_ID.find(t => t.value === solicitud.tipo_identificacion)?.label ?? solicitud.tipo_identificacion}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 font-medium">Número de identificación</p>
                  <p className="text-slate-800 text-sm mt-0.5">{solicitud.cedula}</p>
                </div>
                {solicitud.telefono && (
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Teléfono</p>
                    <p className="text-slate-800 text-sm mt-0.5">{solicitud.telefono}</p>
                  </div>
                )}
                {solicitud.direccion && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-slate-500 font-medium">Dirección</p>
                    <p className="text-slate-800 text-sm mt-0.5">{solicitud.direccion}</p>
                  </div>
                )}
                {solicitud.ocupacion && (
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Ocupación</p>
                    <p className="text-slate-800 text-sm mt-0.5">{solicitud.ocupacion}</p>
                  </div>
                )}
                {solicitud.ingreso_mensual && (
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Ingreso mensual</p>
                    <p className="text-slate-800 text-sm mt-0.5">{solicitud.ingreso_mensual}</p>
                  </div>
                )}
              </div>
              {solicitud.motivacion && (
                <div className="pt-1 border-t border-slate-200">
                  <p className="text-xs text-slate-500 font-medium mb-1">Motivación</p>
                  <p className="text-slate-700 text-sm leading-relaxed">{solicitud.motivacion}</p>
                </div>
              )}

              {/* Documentos adjuntos */}
              {solicitud.documentos && solicitud.documentos.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-2">Documentos adjuntos</p>
                  <div className="space-y-1.5">
                    {solicitud.documentos.map((url, i) => {
                      const isPdf = url.toLowerCase().includes('.pdf') || url.includes('pdf');
                      return (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-sm"
                        >
                          {isPdf
                            ? <FileText className="size-4 text-red-500 shrink-0" />
                            : <FileImage className="size-4 text-blue-500 shrink-0" />
                          }
                          <span className="flex-1 text-slate-700 truncate">
                            {isPdf ? `Documento ${i + 1} (PDF)` : 'Foto / Imagen'}
                          </span>
                          <ExternalLink className="size-3.5 text-slate-400 shrink-0" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Mensaje si aprobada */}
            {solicitud.estado === 'aprobada' && (
              <Alert className="bg-emerald-50 border-emerald-200 py-3">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <AlertDescription className="text-emerald-700 text-sm">
                  ¡Felicidades! Tu solicitud fue aprobada. Recarga la página o vuelve a iniciar sesión para acceder a todas las funcionalidades de asociado.
                </AlertDescription>
              </Alert>
            )}

            {/* Reenviar si rechazada */}
            {solicitud.estado === 'rechazada' && (
              <Button
                onClick={() => setShowForm(true)}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 gap-2"
              >
                <UserPlus className="size-4" />
                Enviar nueva solicitud
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* ── Sección informativa: Sobre UFCA ── */}
      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-emerald-100 rounded-lg">
            <Sparkles className="size-4 text-emerald-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-800">Sobre UFCA</h2>
        </div>

        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50">
          <CardContent className="p-5 space-y-4">
            <p className="text-slate-700 text-sm leading-relaxed">
              Somos una <span className="font-semibold text-emerald-700">sociedad conformada por familiares y amigos</span> dedicada
              a manejar microinversiones en fiducia, préstamos y dos tipos de ahorros: permanente y voluntario.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-emerald-100">
                <div className="p-1.5 bg-emerald-100 rounded-lg shrink-0">
                  <MapPin className="size-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">Ubicación</p>
                  <p className="text-xs text-slate-500 mt-0.5">Medellín, Colombia</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-blue-100">
                <div className="p-1.5 bg-blue-100 rounded-lg shrink-0">
                  <Calendar className="size-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">Experiencia</p>
                  <p className="text-xs text-slate-500 mt-0.5">2 años de trayectoria</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-purple-100">
                <div className="p-1.5 bg-purple-100 rounded-lg shrink-0">
                  <UserCircle className="size-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">Administración</p>
                  <p className="text-xs text-slate-500 mt-0.5">María Edilma Arboleda</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-amber-100">
                <div className="p-1.5 bg-amber-100 rounded-lg shrink-0">
                  <Award className="size-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800">Confianza</p>
                  <p className="text-xs text-slate-500 mt-0.5">Unión familiar y amistosa</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="text-center p-3 bg-white rounded-xl border border-emerald-100">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users className="size-4 text-emerald-600" />
                  <span className="text-lg font-bold text-emerald-600">1.200+</span>
                </div>
                <p className="text-xs text-slate-500">Asociados</p>
              </div>
              <div className="text-center p-3 bg-white rounded-xl border border-emerald-100">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Target className="size-4 text-emerald-600" />
                  <span className="text-lg font-bold text-emerald-600">$2.5M</span>
                </div>
                <p className="text-xs text-slate-500">En ahorros</p>
              </div>
              <div className="text-center p-3 bg-white rounded-xl border border-emerald-100">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Trophy className="size-4 text-emerald-600" />
                  <span className="text-lg font-bold text-emerald-600">98%</span>
                </div>
                <p className="text-xs text-slate-500">Satisfacción</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Beneficios ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <Shield className="size-4 text-blue-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-800">Beneficios al ser asociado</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="border-emerald-100 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl shrink-0">
                <PiggyBank className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Ahorros</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Ahorro permanente y voluntario con rentabilidad garantizada.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-100 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl shrink-0">
                <CreditCard className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Créditos</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Préstamos con tasas preferenciales y plazos flexibles.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-100 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shrink-0">
                <Users className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Comunidad</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Red de referidos y bonificaciones por cada nuevo miembro.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-100 hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shrink-0">
                <TrendingUp className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Eventos</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Acceso exclusivo a eventos, premios y actividades especiales.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-3 p-5 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl text-white">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white/20 rounded-xl shrink-0">
              <Shield className="size-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">¿Por qué confiar en UFCA?</p>
              <p className="text-emerald-50 text-xs mt-1 leading-relaxed">
                Somos más que una institución financiera, somos una familia comprometida
                con el bienestar económico de nuestros asociados. Tus datos y tu dinero,
                siempre protegidos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
