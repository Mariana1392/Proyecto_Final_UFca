import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

const db = supabase; // Standard supabase client (no RLS bypass)
import { CheckCircle, Sparkles, Target, Trophy, UserPlus, Users, X, Shield, UserCircle2, Award, Calendar, MapPin, Clock, PiggyBank, CreditCard, TrendingUp, Upload, FileText, Briefcase, Trash2, AlertCircle, Mail, Smartphone, Download } from 'lucide-react';
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
  key: 'cedula' | 'cartaLaboral';
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
];

// ─── Componente de zona de carga (FUERA del padre para evitar remount) ───────
interface FileZoneProps {
  config: DocumentoConfig;
  file: File | null;
  onSelect: (key: 'cedula' | 'cartaLaboral', file: File | null) => void;
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
        <span className="text-sm font-medium text-slate-800">{config.label} <span className="text-slate-400 font-normal text-xs">(opcional)</span></span>
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
  autoOpenForm?: boolean;
}

export default function Hero({ onNavigateToDashboard, onNavigateToLogin, autoOpenForm }: HeroProps) {
  // 'closed' | 'intro' | 'form' | 'success'
  const [modalStep, setModalStep] = useState<'closed' | 'intro' | 'form' | 'success'>('closed');
  const [solicitudEnviada, setSolicitudEnviada] = useState<{ nombre: string; email: string; cedula: string } | null>(null);

  // Compatibilidad: showSolicitudModal ahora es derivado
  const showSolicitudModal = modalStep !== 'closed';

  // Si viene desde Dashboard con "Soy nuevo", saltamos directo al form
  useEffect(() => {
    if (autoOpenForm) setModalStep('intro');
  }, [autoOpenForm]);

  const [submitting, setSubmitting] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [formData, setFormData] = useState({
    nombres: '', apellidos: '', cedula: '', telefono: '',
    email: '', direccion: '', ocupacion: '', ingresoMensual: '',
    cuotaAhorroMensual: '', motivacion: '',
  });
  const [documentos, setDocumentos] = useState<{
    cedula: File | null;
    cartaLaboral: File | null;
  }>({ cedula: null, cartaLaboral: null });

  // Errores inline por campo — se muestran al perder el foco o al intentar enviar
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Verificación de existencia en tiempo real (cédula y email) ─────────────
  type ExistenciaInfo = { tipo: 'asociado' | 'en_proceso' | 'rechazada'; mensaje: string; bloquea: boolean } | null;
  const [existenciaCedula,  setExistenciaCedula]  = useState<ExistenciaInfo>(null);
  const [existenciaEmail,   setExistenciaEmail]   = useState<ExistenciaInfo>(null);
  const [checkingCedula,    setCheckingCedula]    = useState(false);
  const [checkingEmail,     setCheckingEmail]     = useState(false);
  const debCedula = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debEmail  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const verificarExistencia = async (tipo: 'cedula' | 'email', valor: string) => {
    const setInfo  = tipo === 'cedula' ? setExistenciaCedula : setExistenciaEmail;
    const setCheck = tipo === 'cedula' ? setCheckingCedula   : setCheckingEmail;
    if (!valor.trim()) { setInfo(null); return; }
    setCheck(true);
    try {
      const { data, error } = await db.rpc('verificar_disponibilidad_solicitud', {
        p_campo: tipo,
        p_valor: valor.trim()
      });
      if (error) throw error;
      
      if (data && data.tipo !== 'disponible') {
        setInfo(data);
      } else {
        setInfo(null);
      }
    } catch { setInfo(null); } finally { setCheck(false); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Limpiar error del campo al escribir
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Valida un campo individual y actualiza formErrors
  const validarCampo = (name: string, value: string) => {
    let error = '';
    switch (name) {
      case 'nombres':
      case 'apellidos': {
        const label = name === 'nombres' ? 'Nombres' : 'Apellidos';
        if (!value.trim()) error = `${label} es obligatorio.`;
        else if (!/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s]+$/.test(value.trim()))
          error = `${label} solo puede contener letras y espacios.`;
        break;
      }
      case 'cedula':
        if (!value.trim()) error = 'La cédula es obligatoria.';
        else if (value.trim().length !== 10)
          error = 'La cédula debe tener exactamente 10 dígitos.';
        else if (!/^\d{10}$/.test(value.trim()))
          error = 'La cédula solo puede contener números.';
        break;
      case 'telefono':
        if (!value.trim()) error = 'El teléfono es obligatorio.';
        else if (value.trim().length !== 10)
          error = 'El teléfono debe tener exactamente 10 dígitos.';
        else if (!/^\d{10}$/.test(value.trim()))
          error = 'El teléfono solo puede contener números.';
        break;
      case 'email':
        if (!value.trim()) error = 'El correo electrónico es obligatorio.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
          error = 'Formato de correo no válido. Ej: nombre@correo.com';
        break;
    }
    setFormErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };

  const handleDocumentoSelect = (key: 'cedula' | 'cartaLaboral', file: File | null) => {
    setDocumentos(prev => ({ ...prev, [key]: file }));
  };

  // Sube un archivo a Supabase Storage y retorna la URL pública
  // Ruta: solicitudes/{cedula}/{tipo}.{ext}  → ComiteEvaluador lista la carpeta por cédula
  const subirDocumento = async (file: File, cedula: string, tipo: string): Promise<string> => {
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `solicitudes/${cedula}/${tipo}.${ext}`;
    const { error } = await supabase.storage
      .from('solicitudes-documentos')
      .upload(path, file, { upsert: true });
    if (error) throw new Error(`Error subiendo ${tipo}: ${error.message}`);
    const { data: { publicUrl } } = supabase.storage
      .from('solicitudes-documentos')
      .getPublicUrl(path);
    return publicUrl;
  };

  const handleSubmitSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();

    // ── Validaciones de campos (inline + toast resumen) ──────────────────────
    // Validar ingreso mensual obligatorio
    if (!formData.ingresoMensual || formData.ingresoMensual.trim() === '' || formData.ingresoMensual === '0') {
      setFormErrors(prev => ({ ...prev, ingresoMensual: 'El ingreso mensual es obligatorio' }));
      toast.error('El ingreso mensual aproximado es obligatorio.');
      return;
    }

    const camposRequeridos = ['nombres', 'apellidos', 'cedula', 'telefono', 'email'] as const;
    const nuevosErrores: Record<string, string> = {};
    let hayErrores = false;
    for (const campo of camposRequeridos) {
      const err = validarCampo(campo, formData[campo]);
      if (err) { nuevosErrores[campo] = err; hayErrores = true; }
    }
    if (hayErrores) {
      setFormErrors(prev => ({ ...prev, ...nuevosErrores }));
      toast.error('Revisa los campos marcados en rojo antes de continuar.');
      return;
    }

    // ── Verificación definitiva en BD antes de enviar (no depende del estado) ──
    const [{ data: usrCed }, { data: usrEmail }, { data: solCed }, { data: solEmail }] =
      await Promise.all([
        db.from('usuarios').select('id, roles(nombre)').eq('cedula', formData.cedula.trim()).maybeSingle(),
        db.from('usuarios').select('id, roles(nombre)').eq('email',  formData.email.trim()).maybeSingle(),
        db.from('solicitudes_asociados').select('id, estado').eq('cedula', formData.cedula.trim())
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        db.from('solicitudes_asociados').select('id, estado').eq('email', formData.email.trim())
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

    if ((usrCed as any)?.roles?.nombre === 'asociado' || (usrEmail as any)?.roles?.nombre === 'asociado') {
      toast.error('Ya eres asociado UFCA — inicia sesión con tu cuenta.');
      return;
    }
    const estadoSol = solCed?.estado ?? solEmail?.estado;
    if (estadoSol && estadoSol !== 'rechazada') {
      toast.error('Ya tienes una solicitud en proceso. No puedes enviar otra.');
      return;
    }

    // Validar tamaño máximo 5 MB por archivo (solo los que se hayan adjuntado)
    const MAX_SIZE = 5 * 1024 * 1024;
    for (const [tipo, file] of Object.entries(documentos)) {
      if (file && file.size > MAX_SIZE) {
        const nombre = tipo === 'cedula' ? 'Documento de identidad' : 'Carta laboral';
        toast.error(`"${nombre}" supera el límite de 5 MB. Reduce el tamaño del archivo e inténtalo de nuevo.`);
        return;
      }
    }

    setSubmitting(true);
    setUploadingDocs(true);

    try {
      // ── 0. Verificar cédula/email duplicados ANTES de subir documentos ─────
      const cedula = formData.cedula.trim();
      const email  = formData.email.trim();

      // a) ¿Ya existe una solicitud con esta cédula?
      const { data: existente } = await supabase
        .from('solicitudes_asociados')
        .select('id, estado')
        .eq('cedula', cedula)
        .maybeSingle();

      if (existente) {
        const estadoMsg =
          existente.estado === 'pendiente'            ? 'está pendiente de revisión' :
          existente.estado === 'aprobada'             ? 'ya fue aprobada' :
          existente.estado === 'pendiente_activacion' ? 'está pendiente de activación' :
          existente.estado === 'rechazada'            ? 'fue rechazada anteriormente' :
          'ya fue registrada';
        toast.error('Ya existe una solicitud con esta cédula', {
          description: `La solicitud con cédula ${cedula} ${estadoMsg}. Si tienes dudas, comunícate con la cooperativa.`,
          duration: 6000,
        });
        setSubmitting(false);
        setUploadingDocs(false);
        return;
      }

      // b) ¿La cédula o el email ya están registrados como usuario activo?
      const { data: usuarioExistente } = await supabase
        .from('usuarios')
        .select('id, cedula, email')
        .or(`cedula.eq.${cedula},email.eq.${email}`)
        .maybeSingle();

      if (usuarioExistente) {
        toast.error('Esta cédula o correo ya está registrado en el sistema', {
          description: 'Si eres miembro activo, inicia sesión. Si olvidaste tu acceso, comunícate con la cooperativa.',
          duration: 7000,
        });
        setSubmitting(false);
        setUploadingDocs(false);
        return;
      }

      // ── 1. Subir documentos a Supabase Storage (solo los adjuntados) ────────
      const docUrls: string[] = [];
      if (documentos.cedula) {
        const url = await subirDocumento(documentos.cedula, formData.cedula, 'cedula');
        docUrls.push(url);
      }
      if (documentos.cartaLaboral) {
        const url = await subirDocumento(documentos.cartaLaboral, formData.cedula, 'carta_laboral');
        docUrls.push(url);
      }
      setUploadingDocs(false);

      // ── 2. Guardar solicitud en solicitudes_asociados ────────────────────────
      const { error } = await supabase.from('solicitudes_asociados').insert({
        nombres:         formData.nombres.trim(),
        apellidos:       formData.apellidos.trim(),
        cedula:          cedula,
        telefono:        formData.telefono.trim()  || null,
        email:           formData.email.trim()     || null,
        direccion:       formData.direccion.trim() || null,
        ocupacion:       formData.ocupacion.trim() || null,
        ingreso_mensual:        formData.ingresoMensual     ? parseFloat(formData.ingresoMensual)     : null,
        monto_ahorro_propuesto: formData.cuotaAhorroMensual ? parseFloat(formData.cuotaAhorroMensual) : null,
        motivacion:             formData.motivacion.trim() || null,
        estado:                 'pendiente',
        documentos:             docUrls,
      });
      if (error) throw error;

      // ── 3. Notificar al admin ─────────────────────────────────────────────
      // La notificación se crea server-side vía trigger en solicitudes_asociados
      // (el aspirante no está autenticado → el insert directo fallaría por RLS).

      setSolicitudEnviada({
        nombre: `${formData.nombres.trim()} ${formData.apellidos.trim()}`,
        email:  formData.email.trim(),
        cedula: formData.cedula.trim(),
      });
      setFormData({ nombres:'', apellidos:'', cedula:'', telefono:'', email:'', direccion:'', ocupacion:'', ingresoMensual:'', cuotaAhorroMensual:'', motivacion:'' });
      setDocumentos({ cedula: null, cartaLaboral: null });
      setFormErrors({});
      setModalStep('success');

    } catch (err: any) {
      setUploadingDocs(false);
      console.error('[UFCA] Error al enviar solicitud — detalle completo:', err);
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

            {/* ── PASO 1: Pantalla informativa ────────────────────────────── */}
            {modalStep === 'intro' && (
              <>
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserPlus className="size-8" />
                    <div>
                      <h2 className="text-2xl font-bold">Únete a UFCA</h2>
                      <p className="text-emerald-100 text-sm">Conoce el proceso antes de comenzar</p>
                    </div>
                  </div>
                  <button onClick={() => setModalStep('closed')} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                    <X className="size-6" />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  {/* Pasos del proceso */}
                  <div>
                    <h3 className="text-base font-semibold text-slate-700 mb-4">¿Cómo funciona el proceso?</h3>
                    <div className="space-y-3">
                      {[
                        { n: '1', icon: <UserPlus className="size-5 text-emerald-600" />, title: 'Completa tu solicitud', desc: 'Llena el formulario con tus datos personales, laborales y adjunta los documentos requeridos. Toma aproximadamente 10 minutos.', color: 'emerald' },
                        { n: '2', icon: <Clock className="size-5 text-amber-600" />,    title: 'El comité evalúa tu caso', desc: 'Nuestro comité revisará tu información y documentos. Este proceso toma entre 2 y 5 días hábiles.', color: 'amber' },
                        { n: '3', icon: <Mail className="size-5 text-blue-600" />,      title: 'Recibes respuesta por correo', desc: 'Te notificaremos la decisión al correo que registres. Si es aprobada, recibirás un enlace para crear tu contraseña y acceder al sistema.', color: 'blue' },
                        { n: '4', icon: <Trophy className="size-5 text-purple-600" />, title: '¡Bienvenido a UFCA!', desc: 'Una vez activa tu cuenta tendrás acceso a ahorros, créditos y todos los beneficios del fondo.', color: 'purple' },
                      ].map(({ n, icon, title, desc, color }) => (
                        <div key={n} className={`flex gap-4 p-4 rounded-xl border ${
                          color === 'emerald' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-600' :
                          color === 'amber'   ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/40 dark:border-amber-600' :
                          color === 'blue'    ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/40 dark:border-blue-600' :
                                               'bg-purple-50 border-purple-200 dark:bg-purple-900/40 dark:border-purple-600'
                        }`}>
                          <div className={`size-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                            color === 'emerald' ? 'bg-emerald-600 text-white' :
                            color === 'amber'   ? 'bg-amber-500 text-white' :
                            color === 'blue'    ? 'bg-blue-600 text-white' :
                                                 'bg-purple-600 text-white'
                          }`}>{n}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">{icon}<p className="font-bold text-slate-900 dark:text-white text-sm">{title}</p></div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Documentos que necesitas */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                      <FileText className="size-4 text-slate-500" /> Ten listos estos documentos:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { icon: <FileText className="size-4 text-blue-500" />,   label: 'Copia de cédula',          sub: 'Frente y respaldo (opcional)' },
                        { icon: <Briefcase className="size-4 text-purple-500" />, label: 'Carta laboral',            sub: 'O certificado de ingresos (opcional)' },
                      ].map(({ icon, label, sub }) => (
                        <div key={label} className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200">
                          {icon}
                          <div><p className="text-xs font-medium text-slate-700">{label}</p><p className="text-[11px] text-slate-400">{sub}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Botones */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setModalStep('closed')} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                      Cancelar
                    </button>
                    <button onClick={() => setModalStep('form')} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2">
                      <UserPlus className="size-4" /> Comenzar solicitud
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── PASO 3: Confirmación de envío ───────────────────────────── */}
            {modalStep === 'success' && solicitudEnviada && (
              <>
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="size-8" />
                    <div>
                      <h2 className="text-2xl font-bold">¡Solicitud enviada!</h2>
                      <p className="text-emerald-100 text-sm">Tu solicitud fue recibida correctamente</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
                    <CheckCircle className="size-12 text-emerald-500 mx-auto mb-2" />
                    <p className="font-bold text-slate-800 text-lg">{solicitudEnviada.nombre}</p>
                    <p className="text-slate-500 text-sm">Tu solicitud fue registrada exitosamente</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-sm text-slate-500">Cédula registrada</span>
                      <span className="text-sm font-bold text-slate-800">{solicitudEnviada.cedula}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-sm text-slate-500">Notificación al correo</span>
                      <span className="text-sm font-bold text-slate-800">{solicitudEnviada.email}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-sm text-amber-700">Tiempo estimado de respuesta</span>
                      <span className="text-sm font-bold text-amber-800">2 a 5 días hábiles</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-800 mb-1">¿Qué sigue?</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      El comité evaluará tu solicitud y tus documentos. Si es aprobada, recibirás un correo en
                      <strong> {solicitudEnviada.email}</strong> con un enlace para crear tu contraseña e ingresar al sistema.
                    </p>
                  </div>

                  <button
                    onClick={() => { setModalStep('closed'); setSolicitudEnviada(null); }}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors"
                  >
                    Entendido, cerrar
                  </button>
                </div>
              </>
            )}

            {/* ── PASO 2: Formulario ───────────────────────────────────────── */}
            {modalStep === 'form' && (<>
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserPlus className="size-8" />
                <div>
                  <h2 className="text-2xl font-bold">Solicitud de Asociación</h2>
                  <p className="text-emerald-100 text-sm">Completa el formulario para unirte a UFCA</p>
                </div>
              </div>
              <button
                onClick={() => setModalStep('closed')}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="size-6" />
              </button>
            </div>

            {submitting && (
              <div className="p-12 flex flex-col items-center justify-center min-h-[50vh]">
                <div className="p-5 bg-emerald-100 rounded-full animate-bounce mb-6 shadow-xl shadow-emerald-200/50 border-4 border-white">
                  <PiggyBank className="size-16 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2 text-center">
                  {uploadingDocs ? 'Subiendo documentos...' : 'Procesando solicitud...'}
                </h3>
                <p className="text-slate-500 text-center max-w-sm leading-relaxed">
                  Estamos procesando tu información de forma segura. Por favor, no cierres esta ventana.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmitSolicitud} className={`p-6 space-y-6 ${submitting ? 'hidden' : ''}`}>
              {/* Datos Personales */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <div className="size-6 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 text-sm">1</span>
                  </div>
                  Datos Personales
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nombres">Nombres *</Label>
                    <Input
                      id="nombres"
                      name="nombres"
                      value={formData.nombres}
                      onChange={handleInputChange}
                      onBlur={e => validarCampo('nombres', e.target.value)}
                      placeholder="Ingresa tus nombres"
                      maxLength={50}
                      required
                      className={formErrors.nombres ? 'border-red-400 focus:border-red-500' : ''}
                    />
                    {formErrors.nombres && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="size-3 shrink-0" />{formErrors.nombres}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="apellidos">Apellidos *</Label>
                    <Input
                      id="apellidos"
                      name="apellidos"
                      value={formData.apellidos}
                      onChange={handleInputChange}
                      onBlur={e => validarCampo('apellidos', e.target.value)}
                      placeholder="Ingresa tus apellidos"
                      maxLength={50}
                      required
                      className={formErrors.apellidos ? 'border-red-400 focus:border-red-500' : ''}
                    />
                    {formErrors.apellidos && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="size-3 shrink-0" />{formErrors.apellidos}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cedula">Cédula *</Label>
                    <Input
                      id="cedula"
                      name="cedula"
                      value={formData.cedula}
                      onChange={e => {
                        const soloDigitos = e.target.value.replace(/\D/g, '').slice(0, 12);
                        setFormData(prev => ({ ...prev, cedula: soloDigitos }));
                        if (soloDigitos.length > 10) {
                          setFormErrors(prev => ({ ...prev, cedula: 'La cédula no debe exceder los 10 dígitos.' }));
                        } else {
                          if (formErrors.cedula) setFormErrors(prev => ({ ...prev, cedula: '' }));
                        }
                        setExistenciaCedula(null);
                        if (debCedula.current) clearTimeout(debCedula.current);
                        if (soloDigitos.length >= 5)
                          debCedula.current = setTimeout(() => verificarExistencia('cedula', soloDigitos), 800);
                      }}
                      onBlur={e => validarCampo('cedula', e.target.value)}
                      placeholder="123456789"
                      maxLength={12}
                      inputMode="numeric"
                      required
                      className={formErrors.cedula ? 'border-red-400 focus:border-red-500' : ''}
                    />
                    {formErrors.cedula && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="size-3 shrink-0" />{formErrors.cedula}
                      </p>
                    )}
                    {checkingCedula && (
                      <p className="text-xs text-slate-400 mt-1">Verificando...</p>
                    )}
                    {!checkingCedula && existenciaCedula && (
                      <p className={`text-xs mt-1 flex items-center gap-1 font-medium ${
                        existenciaCedula.tipo === 'rechazada' ? 'text-blue-600'
                        : 'text-red-600'
                      }`}>
                        <AlertCircle className="size-3 shrink-0" />
                        {existenciaCedula.mensaje}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="telefono">Teléfono *</Label>
                    <Input
                      id="telefono"
                      name="telefono"
                      type="tel"
                      value={formData.telefono}
                      onChange={e => {
                        const soloDigitos = e.target.value.replace(/\D/g, '').slice(0, 15);
                        setFormData(prev => ({ ...prev, telefono: soloDigitos }));
                        if (soloDigitos.length > 10) {
                          setFormErrors(prev => ({ ...prev, telefono: 'El teléfono no debe exceder los 10 dígitos.' }));
                        } else {
                          if (formErrors.telefono) setFormErrors(prev => ({ ...prev, telefono: '' }));
                        }
                      }}
                      onBlur={e => validarCampo('telefono', e.target.value)}
                      placeholder="0987654321"
                      maxLength={15}
                      inputMode="numeric"
                      required
                      className={formErrors.telefono ? 'border-red-400 focus:border-red-500' : ''}
                    />
                    {formErrors.telefono && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="size-3 shrink-0" />{formErrors.telefono}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Correo Electrónico *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={e => {
                        handleInputChange(e);
                        const val = e.target.value;
                        if (val.trim() !== '') {
                           if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                             setFormErrors(prev => ({ ...prev, email: 'Formato de correo no válido.' }));
                           } else {
                             setFormErrors(prev => ({ ...prev, email: '' }));
                           }
                        } else {
                           setFormErrors(prev => ({ ...prev, email: '' }));
                        }
                        setExistenciaEmail(null);
                        if (debEmail.current) clearTimeout(debEmail.current);
                        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))
                          debEmail.current = setTimeout(() => verificarExistencia('email', val), 800);
                      }}
                      onBlur={e => validarCampo('email', e.target.value)}
                      placeholder="correo@ejemplo.com"
                      required
                      className={formErrors.email ? 'border-red-400 focus:border-red-500' : ''}
                    />
                    {formErrors.email && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="size-3 shrink-0" />{formErrors.email}
                      </p>
                    )}
                    {checkingEmail && (
                      <p className="text-xs text-slate-400 mt-1">Verificando...</p>
                    )}
                    {!checkingEmail && existenciaEmail && (
                      <p className={`text-xs mt-1 flex items-center gap-1 font-medium ${
                        existenciaEmail.tipo === 'rechazada' ? 'text-blue-600'
                        : 'text-red-600'
                      }`}>
                        <AlertCircle className="size-3 shrink-0" />
                        {existenciaEmail.mensaje}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="direccion">Dirección <span className="text-slate-400 font-normal text-xs">(opcional)</span></Label>
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
                  <div className="space-y-1.5">
                    <Label htmlFor="ocupacion">Ocupación <span className="text-slate-400 font-normal text-xs">(opcional)</span></Label>
                    <Input
                      id="ocupacion"
                      name="ocupacion"
                      value={formData.ocupacion}
                      onChange={handleInputChange}
                      placeholder="Ingeniero, Profesor, etc."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ingresoMensual">Ingreso Mensual Aproximado <span className="text-red-500">*</span></Label>
                    <Input
                      id="ingresoMensual"
                      name="ingresoMensual"
                      type="text"
                      inputMode="numeric"
                      value={formData.ingresoMensual
                        ? Number(formData.ingresoMensual).toLocaleString('es-CO')
                        : ''}
                      onChange={e => {
                        const soloDigitos = e.target.value.replace(/\D/g, '');
                        setFormData(prev => ({ ...prev, ingresoMensual: soloDigitos }));
                        if (formErrors['ingresoMensual']) setFormErrors(prev => ({ ...prev, ingresoMensual: '' }));
                      }}
                      placeholder="Ej: 2.000.000"
                      className={formErrors['ingresoMensual'] ? 'border-red-400 focus-visible:ring-red-400/20' : ''}
                    />
                    {formErrors['ingresoMensual'] && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="size-3 shrink-0" />
                        {formErrors['ingresoMensual']}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Propuesta de Ahorro Permanente */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <div className="size-6 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 text-sm">3</span>
                  </div>
                  Propuesta de Ahorro
                </h3>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <PiggyBank className="size-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">
                        Ahorro Permanente Mensual
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="cuotaAhorroMensual" className="text-emerald-900">
                      ¿Cuánto deseas ahorrar mensualmente? <span className="text-slate-400 font-normal">(opcional)</span>
                    </Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700 font-semibold text-sm pointer-events-none select-none">$</span>
                      <Input
                        id="cuotaAhorroMensual"
                        name="cuotaAhorroMensual"
                        type="text"
                        inputMode="numeric"
                        value={formData.cuotaAhorroMensual
                          ? Number(formData.cuotaAhorroMensual).toLocaleString('es-CO')
                          : ''}
                        onChange={e => {
                          const soloDigitos = e.target.value.replace(/\D/g, '');
                          setFormData(prev => ({ ...prev, cuotaAhorroMensual: soloDigitos }));
                        }}
                        placeholder="150.000"
                        className="pl-7 bg-white border-emerald-300 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Motivación */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <div className="size-6 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 text-sm">4</span>
                  </div>
                  Motivación <span className="text-emerald-600/60 font-normal text-sm">(opcional)</span>
                </h3>
                <div className="space-y-1.5">
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
                    <span className="text-emerald-700 text-sm">5</span>
                  </div>
                  Documentos para el Comité Evaluador
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Los documentos son <strong>opcionales</strong>, pero adjuntarlos ayuda al comité a evaluar tu solicitud más rápido.
                </p>

                {(documentos.cedula || documentos.cartaLaboral) && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
                    <CheckCircle className="size-4 text-emerald-600 shrink-0" />
                    <p className="text-xs text-emerald-700 font-medium">
                      {[documentos.cedula && 'Cédula', documentos.cartaLaboral && 'Carta laboral'].filter(Boolean).join(' y ')} cargado{documentos.cedula && documentos.cartaLaboral ? 's' : ''} correctamente.
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
              <div className="rounded-xl border border-emerald-200 overflow-hidden">
                <div className="bg-emerald-600 px-4 py-2.5">
                  <p className="text-sm font-semibold text-white tracking-wide">Al ser aceptado tendrás acceso a:</p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-emerald-100 bg-white">
                  <div className="flex flex-col items-center gap-1.5 px-3 py-4 text-center">
                    <div className="size-9 rounded-full bg-emerald-100 flex items-center justify-center">
                      <PiggyBank className="size-4 text-emerald-600" />
                    </div>
                    <span className="text-xs font-semibold text-emerald-800">Ahorro Permanente</span>
                    <span className="text-[10px] text-slate-400">Mensual y constante</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 px-3 py-4 text-center">
                    <div className="size-9 rounded-full bg-teal-100 flex items-center justify-center">
                      <CheckCircle className="size-4 text-teal-600" />
                    </div>
                    <span className="text-xs font-semibold text-teal-800">Ahorro Voluntario</span>
                    <span className="text-[10px] text-slate-400">Flexible, cuando quieras</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 px-3 py-4 text-center">
                    <div className="size-9 rounded-full bg-blue-100 flex items-center justify-center">
                      <CreditCard className="size-4 text-blue-600" />
                    </div>
                    <span className="text-xs font-semibold text-blue-800">Créditos</span>
                    <span className="text-[10px] text-slate-400">Libre inversión y más</span>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalStep('closed')}
                  className="flex-1"
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 transition-all"
                >
                  <UserPlus className="size-4" />
                  Enviar Solicitud
                </Button>
              </div>
            </form>
            </>)}
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
              </div>

              {/* App Download Banner */}
              <div className="flex items-start gap-4 p-4 bg-white/10 border border-white/20 rounded-2xl backdrop-blur-md max-w-lg">
                <div className="p-2 bg-emerald-500/20 rounded-xl mt-0.5">
                  <Smartphone className="size-5 text-emerald-300" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">Lleva UFCA en tu bolsillo</p>
                  <p className="text-emerald-100/90 text-xs mt-0.5 mb-3 leading-relaxed">
                    Descarga nuestra aplicación móvil oficial. <strong>Recuerda:</strong> El acceso a la app es exclusivo para asociados aprobados en la cooperativa.
                  </p>
                  <a 
                    href="/ufca-app.apk" 
                    download="UFCA_Mobile.apk"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors shadow-lg shadow-emerald-900/50"
                  >
                    <Download className="size-3.5" />
                    Descargar APK (Android)
                  </a>
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

            {/* ── Derecha: imagen ── */}
            <div className="relative animate-scale-in" style={{animationDelay:'0.15s'}}>
              <div className="absolute -inset-6 bg-gradient-to-tr from-[#f0c040]/15 to-emerald-300/15 rounded-3xl blur-2xl" />
              <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-2 ring-white/15">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=700&q=60&fm=webp&auto=format"
                  alt="Gestión Financiera Familiar"
                  className="w-full object-cover aspect-[4/3]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#054030]/50 to-transparent" />
              </div>

              {/* Badge seguro */}
              <div className="absolute -bottom-5 -left-5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-emerald-100 dark:border-emerald-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/30">
                    <Shield className="size-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">100% Seguro</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">Tus datos protegidos</p>
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
          {/* LIGHT MODE */}
          <svg viewBox="0 0 1440 90" className="w-full block dark:hidden" preserveAspectRatio="none">
            <path d="M0,45 C480,90 960,0 1440,45 L1440,90 L0,90 Z" fill="rgba(5,64,48,0.18)"/>
            <path d="M0,55 C360,90 1080,20 1440,55 L1440,90 L0,90 Z" fill="#e2e8f0"/>
          </svg>
          {/* DARK MODE — mismo degradado horizontal del hero */}
          <svg viewBox="0 0 1440 90" className="w-full hidden dark:block" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="waveDark" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#021810"/>
                <stop offset="50%"  stopColor="#032a1e"/>
                <stop offset="100%" stopColor="#054030"/>
              </linearGradient>
            </defs>
            <path d="M0,45 C480,90 960,0 1440,45 L1440,90 L0,90 Z" fill="rgba(5,64,48,0.18)"/>
            <path d="M0,55 C360,90 1080,20 1440,55 L1440,90 L0,90 Z" fill="url(#waveDark)"/>
          </svg>
        </div>
      </section>

      {/* ══ SECCIÓN SOBRE UFCA ══ */}
      <section className="relative bg-[#e2e8f0] dark:bg-[#054030] overflow-hidden -mt-1">
        {/* Orbe decorativo sutil */}
        <div className="absolute top-0 right-0 w-[600px] h-[500px] rounded-full bg-emerald-100/50 blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-teal-100/30 blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-8 py-24">

          {/* Encabezado centrado */}
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#054030]/8 dark:bg-emerald-400/15 border border-[#054030]/15 dark:border-emerald-400/40 text-[#054030] dark:text-emerald-300 text-sm font-semibold tracking-wide mb-4">
              <Shield className="size-3.5" />
              Acerca de UFCA
            </span>
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white leading-tight mb-4">
              Fondo de <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#054030] to-[#0f8c62] dark:from-emerald-400 dark:to-teal-400">Beneficio</span> Familiar
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
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
                  src="https://images.unsplash.com/photo-1551836022-4c4c79ecde51?w=700&q=60&fm=webp&auto=format"
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

              {/* Badge flotante: Años — abajo derecha */}
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
                  { icon: <Users className="size-5 text-emerald-600"/>, label: 'Tipo de organización', val: 'Fondo familiar', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-700' },
                  { icon: <Award className="size-5 text-amber-600"/>, label: 'Valor central', val: 'Confianza y cercanía', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-700' },
                  { icon: <Target className="size-5 text-blue-600"/>, label: 'Enfoque', val: 'Crecer juntos como familia', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-700' },
                  { icon: <Calendar className="size-5 text-purple-600"/>, label: 'Fundación', val: '2023 · Medellín', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-700' },
                ].map((item) => (
                  <div key={item.label} className={`flex items-start gap-3 p-4 rounded-2xl border ${item.bg} ${item.border}`}>
                    <div className="p-2 bg-white dark:bg-slate-700 rounded-xl shadow-sm shrink-0">{item.icon}</div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-none mb-1">{item.label}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{item.val}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Servicios */}
              <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                <div className="bg-gradient-to-r from-[#054030] to-[#0a7050] px-6 py-4 flex items-center gap-3">
                  <div className="p-2 bg-white/15 rounded-xl">
                    <CheckCircle className="size-5 text-[#f0c040]" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-base">Nuestros Servicios</p>
                    <p className="text-emerald-200 text-xs">Lo que ofrecemos a nuestros asociados</p>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {[
                    { icon: <CreditCard className="size-4 text-blue-600"/>, text: 'Préstamos', tag: 'Crédito' },
                    { icon: <PiggyBank className="size-4 text-purple-600"/>, text: 'Ahorro permanente para metas a corto plazo', tag: 'Ahorro' },
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
      <section className="relative overflow-hidden bg-white dark:bg-slate-900 -mt-1">
        {/* Fondo sutil */}
        <div className="absolute inset-0"
          style={{backgroundImage:'radial-gradient(circle at 20% 50%, #f0fdf4 0%, transparent 60%), radial-gradient(circle at 80% 50%, #f0f9ff 0%, transparent 60%)'}} />

        <div className="relative max-w-7xl mx-auto px-8 py-24">
          {/* Encabezado */}
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#054030]/20 dark:border-emerald-400/40 bg-[#054030]/6 dark:bg-emerald-400/15 text-[#054030] dark:text-emerald-300 text-sm font-semibold mb-5">
              <Sparkles className="size-3.5 text-[#0f8c62] dark:text-emerald-400" />
              Descubre nuestros servicios
            </span>
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white mb-4">
              Todo lo que <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#054030] to-[#0f8c62] dark:from-emerald-400 dark:to-teal-400">necesitas</span>
            </h2>
            <p className="text-lg text-slate-500 dark:text-white dark:font-bold dark:drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] max-w-xl mx-auto">
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
                className={`group relative bg-white dark:bg-slate-800 rounded-3xl p-7 ring-2 ${s.ring} hover:shadow-2xl ${s.shadow} hover:-translate-y-2 transition-all duration-300 cursor-default`}>
                {/* Icono */}
                <div className={`size-16 bg-gradient-to-br ${s.gradient} rounded-2xl flex items-center justify-center mb-5 shadow-lg ${s.shadow} group-hover:scale-110 transition-transform duration-300`}>
                  {s.icon}
                </div>
                {/* Contenido */}
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{s.title}</h3>
                <p className="text-slate-500 dark:text-slate-300 text-sm leading-relaxed mb-4">{s.desc}</p>
                {/* Tag */}
                <span className={`inline-flex text-[10px] font-bold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 ${s.accent}`}>
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
                  <div className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-slate-700 border border-white dark:border-slate-600 rounded-2xl">
                    <Shield className="size-5 text-[#032a1e] dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[#032a1e] dark:text-white font-bold text-sm leading-none">100% Seguro</p>
                      <p className="text-[#065f46] dark:text-slate-300 text-xs mt-0.5">Datos protegidos</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-slate-700 border border-white dark:border-slate-600 rounded-2xl">
                    <Award className="size-5 text-[#032a1e] dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-[#032a1e] dark:text-white font-bold text-sm leading-none">Confiable</p>
                      <p className="text-[#065f46] dark:text-slate-300 text-xs mt-0.5">2 años de trayectoria</p>
                    </div>
                  </div>
                </div>
                {/* Botones CTA */}
                <button
                  onClick={() => setModalStep('intro')}
                  className="group w-full flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-[#f0c040] hover:bg-[#ffd84d] text-[#032a1e] font-black text-base shadow-2xl shadow-[#f0c040]/40 hover:shadow-[#f0c040]/60 hover:-translate-y-1 hover:scale-105 transition-all duration-200"
                >
                  <UserPlus className="size-5 group-hover:rotate-12 transition-transform duration-200" />
                  Quiero ser asociado
                </button>
                <button
                  onClick={() => onNavigateToLogin()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border-2 border-white dark:border-slate-500 text-[#032a1e] dark:text-white text-sm font-bold transition-all duration-200"
                >
                  <UserCircle2 className="size-4" />
                  Ya soy asociado — Ingresar
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}