import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { CheckCircle, Sparkles, Target, Trophy, UserPlus, Users, X, Shield, UserCircle2, Award, Calendar, MapPin, Clock, PiggyBank, CreditCard, TrendingUp, Upload, FileText, ImageIcon, Briefcase, Trash2, AlertCircle } from 'lucide-react';
import logo from '../assets/logo.svg';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';

// Fallback component for images
const ImageWithFallback = ({ src, alt, className }: { src: string; alt: string; className: string }) => (
  <img src={src} alt={alt} className={className} />
);

// ─── Tipos de documento requeridos ──────────────────────────────────────────
interface DocumentoConfig {
  key: 'cedula' | 'cartaLaboral' | 'fotografia';
  label: string;
  descripcion: string;
  icon: React.ReactNode;
  accept: string;
  color: string;
}

const DOCUMENTOS_REQUERIDOS: DocumentoConfig[] = [
  {
    key: 'cedula',
    label: 'Copia de Cédula',
    descripcion: 'Documento de identidad (frente y respaldo)',
    icon: <FileText className="size-5" />,
    accept: 'image/*,.pdf',
    color: 'blue',
  },
  {
    key: 'cartaLaboral',
    label: 'Carta Laboral o Certificado de Ingresos',
    descripcion: 'Documento que acredite su situación laboral e ingresos',
    icon: <Briefcase className="size-5" />,
    accept: 'image/*,.pdf',
    color: 'purple',
  },
  {
    key: 'fotografia',
    label: 'Fotografía Reciente',
    descripcion: 'Foto de frente, fondo blanco, tamaño carnet',
    icon: <ImageIcon className="size-5" />,
    accept: 'image/*',
    color: 'amber',
  },
];

// ─── Componente de zona de carga (FUERA del padre para evitar remount) ───────
interface FileZoneProps {
  config: DocumentoConfig;
  file: File | null;
  onSelect: (key: DocumentoConfig['key'], file: File | null) => void;
}

function FileZone({ config, file, onSelect }: FileZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const colorMap: Record<string, { border: string; bg: string; icon: string; text: string }> = {
    blue:   { border: 'border-blue-300',   bg: 'bg-blue-50',   icon: 'text-blue-500',   text: 'text-blue-700'   },
    purple: { border: 'border-purple-300', bg: 'bg-purple-50', icon: 'text-purple-500', text: 'text-purple-700' },
    amber:  { border: 'border-amber-300',  bg: 'bg-amber-50',  icon: 'text-amber-500',  text: 'text-amber-700'  },
  };
  const c = colorMap[config.color] ?? colorMap['blue'];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onSelect(config.key, dropped);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    onSelect(config.key, selected);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-1">
        <span className={c.icon}>{config.icon}</span>
        <span className="text-sm font-medium text-slate-800">{config.label} <span className="text-red-500">*</span></span>
      </div>
      <p className="text-xs text-slate-500 mb-2">{config.descripcion}</p>

      {file ? (
        <div className={`flex items-center justify-between p-3 rounded-xl border-2 ${c.border} ${c.bg}`}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={c.icon}>{config.icon}</span>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${c.text} truncate`}>{file.name}</p>
              <p className="text-xs text-slate-500">{formatSize(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { onSelect(config.key, null); if (inputRef.current) inputRef.current.value = ''; }}
            className="p-1 hover:bg-red-100 rounded-lg transition-colors text-red-400 hover:text-red-600 shrink-0"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all
            ${dragging ? `${c.border} ${c.bg} scale-[1.01]` : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
        >
          <Upload className="size-6 text-slate-400" />
          <div className="text-center">
            <p className="text-sm text-slate-600 font-medium">Arrastra el archivo aquí</p>
            <p className="text-xs text-slate-400">o haz clic para seleccionar</p>
          </div>
          <p className="text-xs text-slate-400">
            {config.accept.includes('.pdf') ? 'PDF, JPG, PNG, WEBP' : 'JPG, PNG, WEBP'} · Máx. 5 MB
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={config.accept}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

interface HeroProps {
  onNavigateToDashboard: () => void;
  onNavigateToLogin: () => void;
}

export default function Hero({ onNavigateToDashboard, onNavigateToLogin }: HeroProps) {
  const [showSolicitudModal, setShowSolicitudModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [formData, setFormData] = useState({
    nombres: '', apellidos: '', cedula: '', telefono: '',
    email: '', direccion: '', ocupacion: '', ingresoMensual: '', motivacion: '',
  });
  const [documentos, setDocumentos] = useState<{
    cedula: File | null;
    cartaLaboral: File | null;
    fotografia: File | null;
  }>({ cedula: null, cartaLaboral: null, fotografia: null });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDocumentoSelect = (key: 'cedula' | 'cartaLaboral' | 'fotografia', file: File | null) => {
    setDocumentos(prev => ({ ...prev, [key]: file }));
  };

  // Sube un archivo a Supabase Storage con ruta fija (sin timestamp)
  // Ruta: solicitudes/{cedula}/{tipo}.{ext}  → ComiteEvaluador lista la carpeta por cédula
  const subirDocumento = async (file: File, cedula: string, tipo: string): Promise<void> => {
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `solicitudes/${cedula}/${tipo}.${ext}`;
    const { error } = await supabase.storage
      .from('solicitudes-documentos')
      .upload(path, file, { upsert: true });
    if (error) throw new Error(`Error subiendo ${tipo}: ${error.message}`);
  };

  const docsCompletos = documentos.cedula !== null && documentos.cartaLaboral !== null && documentos.fotografia !== null;

  const handleSubmitSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Validaciones de campos ────────────────────────────────────────────────

    if (!formData.nombres.trim()) {
      toast.error('El campo "Nombres" es obligatorio');
      return;
    }
    if (!formData.apellidos.trim()) {
      toast.error('El campo "Apellidos" es obligatorio');
      return;
    }
    if (!formData.cedula.trim()) {
      toast.error('El campo "Cédula" es obligatorio');
      return;
    }
    if (!/^\d{5,12}$/.test(formData.cedula.trim())) {
      toast.error('La cédula debe contener solo números (entre 5 y 12 dígitos)');
      return;
    }
    if (!formData.telefono.trim()) {
      toast.error('El campo "Teléfono" es obligatorio');
      return;
    }
    if (!/^\d{7,15}$/.test(formData.telefono.replace(/\s/g, ''))) {
      toast.error('El teléfono debe contener solo números (entre 7 y 15 dígitos)');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('El campo "Correo electrónico" es obligatorio');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      toast.error('El correo electrónico no tiene un formato válido');
      return;
    }

    // Validar documentos obligatorios
    if (!docsCompletos) {
      toast.error('Debes adjuntar los 3 documentos requeridos para continuar');
      return;
    }

    // Validar tamaño máximo 5 MB por archivo
    const MAX_SIZE = 5 * 1024 * 1024;
    for (const [tipo, file] of Object.entries(documentos)) {
      if (file && file.size > MAX_SIZE) {
        const nombre = tipo === 'cedula' ? 'Documento de identidad' : tipo === 'cartaLaboral' ? 'Carta laboral' : 'Fotografía';
        toast.error(`"${nombre}" supera el límite de 5 MB. Reduce el tamaño del archivo e inténtalo de nuevo.`);
        return;
      }
    }

    setSubmitting(true);
    setUploadingDocs(true);

    try {
      // ── 0. Verificar cédula duplicada ANTES de subir documentos ──────────
      const { data: existente } = await supabase
        .from('solicitudes')
        .select('id, estado')
        .eq('tipo', 'afiliacion')
        .filter('datos->>cedula', 'eq', formData.cedula.trim())
        .maybeSingle();

      if (existente) {
        const estadoMsg =
          existente.estado === 'pendiente'   ? 'está pendiente de revisión' :
          existente.estado === 'aprobada'    ? 'ya fue aprobada' :
          existente.estado === 'rechazada'   ? 'fue rechazada anteriormente' :
          'ya fue registrada';
        toast.error('Ya existe una solicitud con esta cédula', {
          description: `La solicitud con cédula ${formData.cedula.trim()} ${estadoMsg}. Si tienes dudas, comunícate con la cooperativa.`,
          duration: 6000,
        });
        setSubmitting(false);
        setUploadingDocs(false);
        return;
      }

      // ── 1. Subir documentos a Supabase Storage ───────────────────────────
      await Promise.all([
        subirDocumento(documentos.cedula!,       formData.cedula, 'cedula'),
        subirDocumento(documentos.cartaLaboral!, formData.cedula, 'carta_laboral'),
        subirDocumento(documentos.fotografia!,   formData.cedula, 'fotografia'),
      ]);
      setUploadingDocs(false);

      // ── 2. Guardar solicitud en la BD ────────────────────────────────────
      const { error } = await supabase.from('solicitudes').insert({
        tipo:   'afiliacion',
        estado: 'pendiente',
        datos: {
          nombres:         formData.nombres.trim(),
          apellidos:       formData.apellidos.trim(),
          cedula:          formData.cedula.trim(),
          telefono:        formData.telefono.trim(),
          email:           formData.email.trim(),
          direccion:       formData.direccion.trim(),
          ocupacion:       formData.ocupacion.trim(),
          ingreso_mensual: formData.ingresoMensual,
          motivacion:      formData.motivacion.trim(),
        },
      });
      if (error) throw error;

      // ── 3. Notificar al admin ─────────────────────────────────────────────
      await supabase.from('notificaciones').insert({
        titulo:      'Nueva solicitud de afiliación',
        mensaje:     `${formData.nombres.trim()} ${formData.apellidos.trim()} ha enviado una solicitud de membresía y está pendiente de revisión.`,
        tipo:        'solicitud_afiliacion',
        leida:       false,
        para_admin:  true,
        asociado_id: null,
      }).then(() => {}).catch(() => {});

      toast.success('¡Solicitud enviada exitosamente!', {
        description: 'El comité evaluador revisará tus documentos y te notificará el resultado.',
      });
      setFormData({ nombres:'', apellidos:'', cedula:'', telefono:'', email:'', direccion:'', ocupacion:'', ingresoMensual:'', motivacion:'' });
      setDocumentos({ cedula: null, cartaLaboral: null, fotografia: null });
      setShowSolicitudModal(false);

    } catch (err: any) {
      setUploadingDocs(false);
      const msg: string    = err.message ?? String(err);
      const code: string   = err.code    ?? '';

      // Errores conocidos con mensaje claro para el usuario
      if (code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint')) {
        toast.error('Ya existe una solicitud con esta cédula', {
          description: 'No es posible enviar más de una solicitud con el mismo número de documento.',
          duration: 6000,
        });
      } else if (msg.toLowerCase().includes('bucket') || msg.toLowerCase().includes('storage') || msg.toLowerCase().includes('not found')) {
        toast.error('Error al subir los documentos', {
          description: 'Hubo un problema con el almacenamiento. Inténtalo nuevamente o contacta al administrador.',
        });
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        toast.error('Sin conexión', {
          description: 'Verifica tu conexión a internet e inténtalo nuevamente.',
        });
      } else {
        toast.error('No se pudo enviar la solicitud', {
          description: 'Ocurrió un error inesperado. Por favor inténtalo de nuevo o contacta a la cooperativa.',
        });
      }
    }

    setSubmitting(false);
    setUploadingDocs(false);
  };

  // JSX original sin cambios desde aquí
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Modal de Solicitud */}
      {showSolicitudModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserPlus className="size-8" />
                <div>
                  <h2 className="text-2xl font-bold">Solicitud de Asociación</h2>
                  <p className="text-emerald-100 text-sm">Completa el formulario para unirte a UFCA</p>
                </div>
              </div>
              <button
                onClick={() => setShowSolicitudModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="size-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitSolicitud} className="p-6 space-y-6">
              {/* Datos Personales */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <div className="size-6 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 text-sm">1</span>
                  </div>
                  Datos Personales
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nombres">Nombres *</Label>
                    <Input
                      id="nombres"
                      name="nombres"
                      value={formData.nombres}
                      onChange={handleInputChange}
                      placeholder="Ingresa tus nombres"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="apellidos">Apellidos *</Label>
                    <Input
                      id="apellidos"
                      name="apellidos"
                      value={formData.apellidos}
                      onChange={handleInputChange}
                      placeholder="Ingresa tus apellidos"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cedula">Cédula *</Label>
                    <Input
                      id="cedula"
                      name="cedula"
                      value={formData.cedula}
                      onChange={handleInputChange}
                      placeholder="123456789"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefono">Teléfono *</Label>
                    <Input
                      id="telefono"
                      name="telefono"
                      type="tel"
                      value={formData.telefono}
                      onChange={handleInputChange}
                      placeholder="0987654321"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Correo Electrónico *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="correo@ejemplo.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="direccion">Dirección</Label>
                    <Input
                      id="direccion"
                      name="direccion"
                      value={formData.direccion}
                      onChange={handleInputChange}
                      placeholder="Dirección de domicilio"
                    />
                  </div>
                </div>
              </div>

              {/* Información Laboral */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <div className="size-6 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 text-sm">2</span>
                  </div>
                  Información Laboral
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ocupacion">Ocupación</Label>
                    <Input
                      id="ocupacion"
                      name="ocupacion"
                      value={formData.ocupacion}
                      onChange={handleInputChange}
                      placeholder="Ingeniero, Profesor, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="ingresoMensual">Ingreso Mensual Aproximado</Label>
                    <Input
                      id="ingresoMensual"
                      name="ingresoMensual"
                      value={formData.ingresoMensual}
                      onChange={handleInputChange}
                      placeholder="$1,000"
                    />
                  </div>
                </div>
              </div>

              {/* Motivación */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <div className="size-6 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 text-sm">3</span>
                  </div>
                  Motivación
                </h3>
                <div>
                  <Label htmlFor="motivacion">¿Por qué deseas ser parte de UFCA?</Label>
                  <Textarea
                    id="motivacion"
                    name="motivacion"
                    value={formData.motivacion}
                    onChange={handleInputChange}
                    placeholder="Cuéntanos por qué quieres unirte a nuestra asociación..."
                    className="min-h-24"
                  />
                </div>
              </div>

              {/* Documentos requeridos */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
                  <div className="size-6 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 text-sm">4</span>
                  </div>
                  Documentos para el Comité Evaluador
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Los siguientes documentos son <strong>obligatorios</strong> para que el comité pueda evaluar tu solicitud.
                </p>

                {/* Alerta si faltan documentos y ya se intentó enviar */}
                {!docsCompletos && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                    <AlertCircle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                      Debes adjuntar los 3 documentos para poder enviar la solicitud.{' '}
                      <span className="font-semibold">
                        {([
                          !documentos.cedula && 'Copia de Cédula',
                          !documentos.cartaLaboral && 'Carta Laboral',
                          !documentos.fotografia && 'Fotografía',
                        ] as Array<string | false>).filter((x): x is string => !!x).join(', ')}
                      </span>{' '}
                      {([!documentos.cedula, !documentos.cartaLaboral, !documentos.fotografia] as boolean[]).filter(Boolean).length === 1 ? 'falta' : 'faltan'}.
                    </p>
                  </div>
                )}

                {docsCompletos && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                    <CheckCircle className="size-4 text-emerald-600 shrink-0" />
                    <p className="text-xs text-emerald-700 font-medium">
                      Todos los documentos cargados correctamente. ¡Ya puedes enviar tu solicitud!
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {DOCUMENTOS_REQUERIDOS.map(config => (
                    <FileZone
                      key={config.key}
                      config={config}
                      file={documentos[config.key]}
                      onSelect={handleDocumentoSelect}
                    />
                  ))}
                </div>
              </div>

              {/* Beneficios destacados */}
              <div className="bg-emerald-50 p-4 rounded-xl">
                <p className="text-sm text-emerald-900 font-semibold mb-2">Al ser aceptado tendrás acceso a:</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle className="size-4" />
                    <span>Ahorro permanente</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle className="size-4" />
                    <span>Ahorro voluntario</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle className="size-4" />
                    <span>Créditos con bajas tasas</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <CheckCircle className="size-4" />
                    <span>Eventos exclusivos</span>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSolicitudModal(false)}
                  className="flex-1"
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !docsCompletos}
                  className={`flex-1 gap-2 transition-all ${
                    docsCompletos
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-slate-300 cursor-not-allowed text-slate-500'
                  }`}
                >
                  {submitting ? (
                    <>
                      <div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {uploadingDocs ? 'Subiendo documentos...' : 'Enviando solicitud...'}
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      Enviar Solicitud
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ HERO SECTION ══ */}
      <section className="relative overflow-hidden">
        {/* Fondo verde oscuro institucional */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#021810] via-[#032a1e] to-[#054030]" />
        {/* Orbes decorativos */}
        <div className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-[500px] h-[500px] rounded-full bg-black/15 blur-3xl" />
        {/* Patrón de puntos sutil */}
        <div className="absolute inset-0 opacity-5"
          style={{backgroundImage:'radial-gradient(#fff 1px,transparent 1px)',backgroundSize:'32px 32px'}} />

        <div className="relative z-10 max-w-7xl mx-auto px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* ── Izquierda ── */}
            <div className="space-y-8 animate-scale-in">
              {/* Logo + nombre */}
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-full bg-[#f0c040]/30 blur-xl scale-125" />
                  <img src={logo} alt="UFCA"
                    className="relative w-24 h-24 lg:w-32 lg:h-32 object-contain drop-shadow-2xl" />
                </div>
                <div>
                  <h1 className="text-5xl lg:text-6xl font-black text-white tracking-widest drop-shadow-lg leading-none">
                    UFCA
                  </h1>
                  <p className="text-[#f0c040] font-semibold tracking-[0.2em] text-xs uppercase mt-2">
                    Unión Familiar de Crédito y Ahorro
                  </p>
                  <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 bg-white/10 border border-white/20 text-white/90 rounded-full text-xs font-medium backdrop-blur-sm">
                    <Sparkles className="size-3 text-[#f0c040]" />
                    Sistema Integral de Gestión
                  </span>
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-3 max-w-lg">
                <p className="text-2xl lg:text-3xl font-light text-white/90 leading-relaxed">
                  Administra tus <span className="font-bold text-[#f0c040]">ahorros y crédito</span><br/>con la confianza de una familia.
                </p>
                <p className="text-base text-emerald-100/75 leading-relaxed">
                  Plataforma moderna para gestionar microinversiones, préstamos, ahorro permanente y voluntario de manera segura y transparente.
                </p>
              </div>

              {/* Decoración — línea dorada con destellos */}
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#f0c040]/60 to-transparent" />
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#f0c040]/40" />
                  <span className="size-2.5 rounded-full bg-[#f0c040]/70" />
                  <Sparkles className="size-4 text-[#f0c040]" />
                  <span className="size-2.5 rounded-full bg-[#f0c040]/70" />
                  <span className="size-1.5 rounded-full bg-[#f0c040]/40" />
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#f0c040]/60 to-transparent" />
              </div>
            </div>

            {/* ── Derecha: imagen ── */}
            <div className="relative animate-scale-in" style={{animationDelay:'0.15s'}}>
              <div className="absolute -inset-6 bg-gradient-to-tr from-[#f0c040]/15 to-emerald-300/15 rounded-3xl blur-2xl" />
              <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-2 ring-white/15">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=900&q=85"
                  alt="Gestión Financiera Familiar"
                  className="w-full object-cover aspect-[4/3]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#054030]/50 to-transparent" />
              </div>

              {/* Badge seguro */}
              <div className="absolute -bottom-5 -left-5 bg-white/95 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/30">
                    <Shield className="size-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">100% Seguro</p>
                    <p className="text-xs text-slate-500">Tus datos protegidos</p>
                  </div>
                </div>
              </div>

              {/* Badge años */}
              <div className="absolute -top-4 -right-4 w-14 h-14 bg-[#f0c040] rounded-2xl shadow-xl flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-[#054030] leading-none">2</span>
                <span className="text-[8px] font-bold text-[#054030] uppercase tracking-wider">Años</span>
              </div>
            </div>
          </div>
        </div>

        {/* Onda doble: sombra + principal */}
        <div className="absolute bottom-0 left-0 right-0 leading-none">
          <svg viewBox="0 0 1440 90" className="w-full block" preserveAspectRatio="none">
            {/* Capa sombra */}
            <path d="M0,45 C480,90 960,0 1440,45 L1440,90 L0,90 Z" fill="rgba(5,64,48,0.18)"/>
            {/* Capa principal */}
            <path d="M0,55 C360,90 1080,20 1440,55 L1440,90 L0,90 Z" fill="#eef6f2"/>
          </svg>
        </div>
      </section>

      {/* ══ SECCIÓN SOBRE UFCA ══ */}
      <section className="relative bg-[#eef6f2] overflow-hidden -mt-1">
        {/* Orbe decorativo sutil */}
        <div className="absolute top-0 right-0 w-[600px] h-[500px] rounded-full bg-emerald-100/50 blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-teal-100/30 blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-8 py-24">

          {/* Encabezado centrado */}
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#054030]/8 border border-[#054030]/15 text-[#054030] text-sm font-semibold tracking-wide mb-4">
              <Shield className="size-3.5" />
              Acerca de UFCA
            </span>
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 leading-tight mb-4">
              Fondo de <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#054030] to-[#0f8c62]">Beneficio</span> Familiar
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Una sociedad conformada por familiares y amigos dedicada a gestionar microinversiones, préstamos y ahorros con transparencia y confianza.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* ── Columna izquierda: imagen + badge superpuesto ── */}
            <div className="relative order-2 lg:order-1">
              {/* Halo verde */}
              <div className="absolute -inset-6 bg-gradient-to-br from-emerald-200/50 to-teal-100/50 rounded-3xl blur-2xl" />
              {/* Marco con borde dorado */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-4 ring-[#f0c040]/30">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1551836022-4c4c79ecde51?w=800&q=80"
                  alt="Equipo UFCA"
                  className="w-full object-cover aspect-[4/3]"
                />
                {/* Overlay degradado */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#054030]/60 via-transparent to-transparent" />
                {/* Texto sobre imagen */}
                <div className="absolute bottom-0 left-0 right-0 p-5 pb-4">
                  <p className="text-white font-bold text-base leading-snug">"Más que finanzas,<br/>somos una familia."</p>
                  <p className="text-emerald-200 text-xs mt-1">— María Edilma Arboleda Londoño, Administradora</p>
                </div>
              </div>

              {/* Badge flotante: Medellín — arriba derecha */}
              <div className="absolute -top-4 -right-4 bg-white shadow-xl border border-slate-100 rounded-2xl px-4 py-3 flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <MapPin className="size-4 text-emerald-700" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium leading-none">Ubicación</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">Medellín, Colombia</p>
                </div>
              </div>

              {/* Badge flotante: Años — abajo derecha (alejado del texto) */}
              <div className="absolute -bottom-4 -right-4 bg-[#054030] shadow-xl rounded-2xl px-4 py-3 flex items-center gap-2.5">
                <div className="p-2 bg-white/15 rounded-xl">
                  <Clock className="size-4 text-[#f0c040]" />
                </div>
                <div>
                  <p className="text-xs text-emerald-300 font-medium leading-none">Trayectoria</p>
                  <p className="text-sm font-bold text-white mt-0.5">2 años de experiencia</p>
                </div>
              </div>
            </div>

            {/* ── Columna derecha: contenido ── */}
            <div className="order-1 lg:order-2 space-y-8">

              {/* Tarjetas de datos clave */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: <Users className="size-5 text-emerald-600"/>, label: 'Tipo de organización', val: 'Fondo familiar', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                  { icon: <Award className="size-5 text-amber-600"/>, label: 'Valor central', val: 'Confianza y cercanía', bg: 'bg-amber-50', border: 'border-amber-200' },
                  { icon: <Target className="size-5 text-blue-600"/>, label: 'Enfoque', val: 'Crecer juntos como familia', bg: 'bg-blue-50', border: 'border-blue-200' },
                  { icon: <Calendar className="size-5 text-purple-600"/>, label: 'Fundación', val: '2023 · Medellín', bg: 'bg-purple-50', border: 'border-purple-200' },
                ].map((item) => (
                  <div key={item.label} className={`flex items-start gap-3 p-4 rounded-2xl border ${item.bg} ${item.border}`}>
                    <div className="p-2 bg-white rounded-xl shadow-sm shrink-0">{item.icon}</div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 font-medium leading-none mb-1">{item.label}</p>
                      <p className="text-sm font-bold text-slate-900 leading-tight">{item.val}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Servicios */}
              <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                {/* Header del bloque */}
                <div className="bg-gradient-to-r from-[#054030] to-[#0a7050] px-6 py-4 flex items-center gap-3">
                  <div className="p-2 bg-white/15 rounded-xl">
                    <CheckCircle className="size-5 text-[#f0c040]" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">Nuestros Servicios</p>
                    <p className="text-emerald-200 text-xs">Lo que ofrecemos a nuestros asociados</p>
                  </div>
                </div>
                {/* Lista */}
                <div className="divide-y divide-slate-100">
                  {[
                    { icon: <TrendingUp className="size-4 text-emerald-600"/>, text: 'Microinversiones con respaldo', tag: 'Inversión' },
                    { icon: <CreditCard className="size-4 text-blue-600"/>, text: 'Préstamos con tasas preferenciales', tag: 'Crédito' },
                    { icon: <PiggyBank className="size-4 text-purple-600"/>, text: 'Ahorro permanente para metas a mediano y corto plazo', tag: 'Ahorro' },
                    { icon: <Award className="size-4 text-amber-600"/>, text: 'Ahorro voluntario con flexibilidad total', tag: 'Ahorro' },
                  ].map((s) => (
                    <div key={s.text} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className="p-2 bg-slate-100 rounded-xl shrink-0">{s.icon}</div>
                      <p className="text-sm text-slate-700 font-medium flex-1">{s.text}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full shrink-0">{s.tag}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decoración — línea dorada con destellos */}
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#f0c040]/60 to-transparent" />
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-[#f0c040]/40" />
                  <span className="size-2.5 rounded-full bg-[#f0c040]/70" />
                  <Sparkles className="size-4 text-[#f0c040]" />
                  <span className="size-2.5 rounded-full bg-[#f0c040]/70" />
                  <span className="size-1.5 rounded-full bg-[#f0c040]/40" />
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#f0c040]/60 to-transparent" />
              </div>
            </div>

          </div>
        </div>
        {/* Onda inferior hacia Servicios */}
        <div className="absolute bottom-0 left-0 right-0 leading-none">
          <svg viewBox="0 0 1440 70" className="w-full block" preserveAspectRatio="none">
            <path d="M0,35 C480,70 960,0 1440,35 L1440,70 L0,70 Z" fill="rgba(5,64,48,0.12)"/>
            <path d="M0,50 C360,70 1080,25 1440,50 L1440,70 L0,70 Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* ══ SERVICIOS ══ */}
      <section className="relative overflow-hidden bg-white -mt-1">
        {/* Fondo sutil */}
        <div className="absolute inset-0"
          style={{backgroundImage:'radial-gradient(circle at 20% 50%, #f0fdf4 0%, transparent 60%), radial-gradient(circle at 80% 50%, #f0f9ff 0%, transparent 60%)'}} />

        <div className="relative max-w-7xl mx-auto px-8 py-24">
          {/* Encabezado */}
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#054030]/20 bg-[#054030]/6 text-[#054030] text-sm font-semibold mb-5">
              <Sparkles className="size-3.5 text-[#0f8c62]" />
              Descubre nuestros servicios
            </span>
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mb-4">
              Todo lo que <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#054030] to-[#0f8c62]">necesitas</span>
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Gestiona tus finanzas personales en una sola plataforma moderna, segura y accesible.
            </p>
          </div>

          {/* Tarjetas de servicios */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <PiggyBank className="size-7 text-white" />,
                gradient: 'from-emerald-500 to-teal-600',
                shadow: 'shadow-emerald-200',
                ring: 'ring-emerald-100',
                accent: 'text-emerald-600',
                title: 'Ahorros',
                desc: 'Ahorro permanente y voluntario con seguimiento en tiempo real para cada asociado.',
                tag: 'Permanente · Voluntario',
              },
              {
                icon: <CreditCard className="size-7 text-white" />,
                gradient: 'from-blue-500 to-indigo-600',
                shadow: 'shadow-blue-200',
                ring: 'ring-blue-100',
                accent: 'text-blue-600',
                title: 'Créditos',
                desc: 'Solicitud, aprobación y seguimiento de créditos de forma ágil y transparente.',
                tag: 'Préstamos · Liquidación',
              },
              {
                icon: <Users className="size-7 text-white" />,
                gradient: 'from-violet-500 to-purple-600',
                shadow: 'shadow-violet-200',
                ring: 'ring-violet-100',
                accent: 'text-violet-600',
                title: 'Asociados',
                desc: 'Gestión completa de beneficios prioritarios para el núcleo familiar.',
                tag: 'Membresías · Referidos',
              },
              {
                icon: <TrendingUp className="size-7 text-white" />,
                gradient: 'from-amber-500 to-orange-500',
                shadow: 'shadow-amber-200',
                ring: 'ring-amber-100',
                accent: 'text-amber-600',
                title: 'Dashboard',
                desc: 'Obtenga estadísticas con gráficas interactivas con reportes del estado de cuenta en tiempo real.',
                tag: 'Reportes · Gráficas',
              },
            ].map((s) => (
              <div key={s.title}
                className={`group relative bg-white rounded-3xl p-7 ring-2 ${s.ring} hover:shadow-2xl ${s.shadow} hover:-translate-y-2 transition-all duration-300 cursor-default`}>
                {/* Icono */}
                <div className={`size-16 bg-gradient-to-br ${s.gradient} rounded-2xl flex items-center justify-center mb-5 shadow-lg ${s.shadow} group-hover:scale-110 transition-transform duration-300`}>
                  {s.icon}
                </div>
                {/* Contenido */}
                <h3 className="text-xl font-black text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">{s.desc}</p>
                {/* Tag */}
                <span className={`inline-flex text-[10px] font-bold px-3 py-1 rounded-full bg-slate-100 ${s.accent}`}>
                  {s.tag}
                </span>
                {/* Línea decorativa inferior */}
                <div className={`absolute bottom-0 left-6 right-6 h-0.5 bg-gradient-to-r ${s.gradient} rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </div>
            ))}
          </div>

          {/* Banner CTA inferior */}
          <div className="mt-16 relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#054030] via-[#0a7050] to-[#0f8c62] p-10 shadow-2xl shadow-emerald-900/20">
            {/* Decoraciones */}
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 blur-3xl -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-black/10 blur-2xl translate-y-1/3 -translate-x-1/4" />
            {/* Patrón de puntos */}
            <div className="absolute inset-0 opacity-10"
              style={{backgroundImage:'radial-gradient(#fff 1px,transparent 1px)',backgroundSize:'24px 24px'}} />

            <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
              {/* Texto izquierda */}
              <div className="text-center md:text-left">
                <p className="text-[#f0c040] text-sm font-bold tracking-widest uppercase mb-2">¿Listo para empezar?</p>
                <h3 className="text-2xl lg:text-3xl font-black text-white mb-2">
                  Únete a la familia UFCA
                </h3>
                <p className="text-emerald-200 text-base max-w-lg">
                  Accede a todos los beneficios — ahorros, créditos y más — con el respaldo de una comunidad familiar.
                </p>
              </div>

              {/* Derecha: badges + botón */}
              <div className="flex flex-col items-center gap-4 shrink-0">
                {/* Badges info */}
                <div className="flex gap-3">
                  <div className="flex items-center gap-3 px-5 py-3 bg-white/10 border border-white/20 rounded-2xl backdrop-blur-sm">
                    <Shield className="size-5 text-[#f0c040] shrink-0" />
                    <div>
                      <p className="text-white font-bold text-sm leading-none">100% Seguro</p>
                      <p className="text-emerald-300 text-xs mt-0.5">Datos protegidos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-3 bg-white/10 border border-white/20 rounded-2xl backdrop-blur-sm">
                    <Award className="size-5 text-[#f0c040] shrink-0" />
                    <div>
                      <p className="text-white font-bold text-sm leading-none">Confiable</p>
                      <p className="text-emerald-300 text-xs mt-0.5">2 años de trayectoria</p>
                    </div>
                  </div>
                </div>
                {/* Botón de registro prominente */}
                <button
                  onClick={() => onNavigateToLogin()}
                  className="group w-full flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-[#f0c040] hover:bg-[#ffd84d] text-[#032a1e] font-black text-base shadow-2xl shadow-[#f0c040]/40 hover:shadow-[#f0c040]/60 hover:-translate-y-1 hover:scale-105 transition-all duration-200"
                >
                  <UserPlus className="size-5 group-hover:rotate-12 transition-transform duration-200" />
                  Quiero ser asociado
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}