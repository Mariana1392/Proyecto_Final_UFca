import { useEffect, useRef } from 'react';
import {
  PiggyBank, CreditCard, TrendingUp, Calendar,
  CheckCircle, ArrowRight, Shield, Clock, Percent,
  Wallet, BadgeCheck, Users, Star, ChevronDown,
} from 'lucide-react';
import { Button } from './ui/button';

interface ServiciosProps {
  onNavigateToLogin: () => void;
  seccionInicial?: 'ahorros-permanentes' | 'ahorros-voluntarios' | 'creditos' | 'eventos';
}

const SECCIONES = [
  { id: 'ahorros-permanentes', label: 'Ahorros Permanentes' },
  { id: 'ahorros-voluntarios', label: 'Ahorros Voluntarios' },
  { id: 'creditos',            label: 'Créditos' },
  { id: 'eventos',             label: 'Eventos' },
];

export default function Servicios({ onNavigateToLogin, seccionInicial }: ServiciosProps) {
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Scroll automático a la sección si viene con seccionInicial
  useEffect(() => {
    if (seccionInicial) {
      setTimeout(() => {
        sectionRefs.current[seccionInicial]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [seccionInicial]);

  const scrollTo = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">

      {/* ── Hero de la página ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#021810] via-[#032a1e] to-[#054030]">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 max-w-5xl mx-auto px-8 py-20 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 text-sm font-semibold tracking-wide mb-6">
            <Shield className="size-3.5" /> Nuestros Servicios
          </span>
          <h1 className="text-4xl lg:text-6xl font-black text-white mb-4 leading-tight">
            Todo lo que UFCA<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f0c040] to-emerald-400">
              ofrece para ti
            </span>
          </h1>
          <p className="text-lg text-emerald-100 max-w-2xl mx-auto mb-10">
            Conoce en detalle cada uno de los servicios diseñados para el bienestar financiero de ti y tu familia.
          </p>

          {/* Navegación rápida entre secciones */}
          <div className="flex flex-wrap justify-center gap-3">
            {SECCIONES.map(s => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium transition-all hover:-translate-y-0.5 flex items-center gap-2"
              >
                {s.label} <ChevronDown className="size-3.5 opacity-70" />
              </button>
            ))}
          </div>
        </div>
        {/* Onda inferior */}
        <div className="absolute bottom-0 left-0 right-0 leading-none">
          <svg viewBox="0 0 1440 60" className="w-full block" preserveAspectRatio="none">
            <path d="M0,30 C480,60 960,0 1440,30 L1440,60 L0,60 Z" fill="rgb(248 250 252)" className="dark:fill-slate-900" />
          </svg>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-16 space-y-28">

        {/* ══ SECCIÓN 1: AHORROS PERMANENTES ══ */}
        <section
          id="ahorros-permanentes"
          ref={el => { sectionRefs.current['ahorros-permanentes'] = el; }}
          className="scroll-mt-20"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="size-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-emerald-900/40 shrink-0">
              <PiggyBank className="size-7 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5">Servicio 1</p>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">Ahorros Permanentes</h2>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div className="space-y-5">
              <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed">
                El <strong className="text-slate-900 dark:text-white">Ahorro Permanente</strong> es la base de tu membresía en UFCA.
                Una cuota mensual fija que construye tu patrimonio y te da acceso a todos los beneficios del fondo.
              </p>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Cada peso que ahorras permanece a tu nombre y puede ser consultado en tiempo real desde la plataforma.
                Al momento de retirarte del fondo, recibes la totalidad de tus ahorros acumulados.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                {[
                  { icon: <Clock className="size-4 text-emerald-600" />, title: 'Cuota mensual fija', desc: 'Misma cantidad cada mes, sin sorpresas' },
                  { icon: <BadgeCheck className="size-4 text-emerald-600" />, title: 'Cuenta activa', desc: 'Tu primer pago activa todos los módulos' },
                  { icon: <Wallet className="size-4 text-emerald-600" />, title: 'Capital propio', desc: 'El dinero siempre es tuyo' },
                  { icon: <TrendingUp className="size-4 text-emerald-600" />, title: 'Seguimiento real', desc: 'Consulta tu saldo en cualquier momento' },
                ].map(f => (
                  <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
                    <div className="p-1.5 bg-white dark:bg-slate-700 rounded-lg shadow-sm shrink-0">{f.icon}</div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">{f.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                <p className="text-white font-bold text-base">¿Cómo funciona?</p>
                <p className="text-emerald-100 text-xs mt-0.5">Proceso paso a paso</p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {[
                  { n: '1', t: 'Defines tu cuota', d: 'Al solicitar membresía propones cuánto deseas ahorrar mensualmente.' },
                  { n: '2', t: 'El admin la registra', d: 'El administrador configura tu cuota aprobada en el sistema.' },
                  { n: '3', t: 'Pagas cada mes', d: 'Realizas tu aporte mensual y queda registrado con comprobante.' },
                  { n: '4', t: 'Acumulas capital', d: 'Tu saldo crece mes a mes visible en tiempo real.' },
                ].map(p => (
                  <div key={p.n} className="flex items-start gap-4 px-6 py-4">
                    <span className="size-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-black flex items-center justify-center shrink-0">{p.n}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{p.t}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

        {/* ══ SECCIÓN 2: AHORROS VOLUNTARIOS ══ */}
        <section
          id="ahorros-voluntarios"
          ref={el => { sectionRefs.current['ahorros-voluntarios'] = el; }}
          className="scroll-mt-20"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="size-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-blue-900/40 shrink-0">
              <Wallet className="size-7 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-0.5">Servicio 2</p>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">Ahorros Voluntarios</h2>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden order-2 lg:order-1">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <p className="text-white font-bold text-base">Beneficios clave</p>
                <p className="text-blue-100 text-xs mt-0.5">Por qué elegir el ahorro voluntario</p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {[
                  { icon: <CheckCircle className="size-4 text-blue-500" />, t: 'Monto libre', d: 'Depositas lo que quieras, cuando quieras.' },
                  { icon: <CheckCircle className="size-4 text-blue-500" />, t: 'Sin penalización', d: 'Retiras tu dinero sin cargos adicionales.' },
                  { icon: <CheckCircle className="size-4 text-blue-500" />, t: 'Metas personales', d: 'Ideal para viajes, educación o imprevistos.' },
                  { icon: <CheckCircle className="size-4 text-blue-500" />, t: 'Historial completo', d: 'Cada depósito y retiro queda registrado.' },
                  { icon: <CheckCircle className="size-4 text-blue-500" />, t: 'Complementario', d: 'No reemplaza el permanente, lo complementa.' },
                ].map(b => (
                  <div key={b.t} className="flex items-start gap-4 px-6 py-3.5">
                    <div className="shrink-0 mt-0.5">{b.icon}</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{b.t}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{b.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-5 order-1 lg:order-2">
              <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed">
                El <strong className="text-slate-900 dark:text-white">Ahorro Voluntario</strong> es completamente flexible.
                Tú decides cuánto depositas y cuándo, sin compromisos fijos ni fechas obligatorias.
              </p>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                Es el instrumento perfecto para metas de corto y mediano plazo. Puedes hacer depósitos puntuales o
                establecer una rutina de ahorro adicional al permanente.
              </p>

              <div className="p-5 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                <p className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <Star className="size-4" /> Diferencia con el ahorro permanente
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: 'Permanente', items: ['Cuota fija mensual', 'Obligatorio para membresía', 'Capital acumulado a largo plazo'] },
                    { label: 'Voluntario',  items: ['Monto libre', 'Opcional y flexible', 'Para metas a corto plazo'] },
                  ].map(col => (
                    <div key={col.label}>
                      <p className="font-bold text-slate-700 dark:text-slate-200 mb-2">{col.label}</p>
                      {col.items.map(i => (
                        <p key={i} className="text-slate-500 dark:text-slate-400 flex items-start gap-1 mb-1">
                          <span className="text-blue-500 mt-0.5">·</span> {i}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

        {/* ══ SECCIÓN 3: CRÉDITOS ══ */}
        <section
          id="creditos"
          ref={el => { sectionRefs.current['creditos'] = el; }}
          className="scroll-mt-20"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="size-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/40 shrink-0">
              <CreditCard className="size-7 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest mb-0.5">Servicio 3</p>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">Créditos</h2>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-10 items-start">
            <div className="space-y-5">
              <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed">
                Accede a <strong className="text-slate-900 dark:text-white">créditos ágiles y transparentes</strong> con tasas
                preferenciales para asociados activos. Sin trámites bancarios complejos ni largas esperas.
              </p>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                El sistema calcula automáticamente tu cuota mensual, genera la tabla de amortización y
                lleva el seguimiento de cada pago. Todo queda registrado y visible para ti en tiempo real.
              </p>

              {/* Tipos de crédito */}
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Tipos de crédito disponibles:</p>
                {[
                  { t: 'Libre inversión',      d: 'Para cualquier necesidad personal o familiar.' },
                  { t: 'Educación',            d: 'Matrícula, cursos, posgrados y formación.' },
                  { t: 'Salud',                d: 'Gastos médicos, medicamentos o cirugías.' },
                  { t: 'Vivienda',             d: 'Mejoras, remodelaciones o arriendo.' },
                  { t: 'Emergencia',           d: 'Respuesta rápida ante imprevistos urgentes.' },
                ].map(tc => (
                  <div key={tc.t} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <ArrowRight className="size-3.5 text-violet-500 shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-slate-800 dark:text-white">{tc.t}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">— {tc.d}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {/* Condiciones */}
              <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4">
                  <p className="text-white font-bold text-base">Condiciones generales</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {[
                    { icon: <Percent className="size-4 text-violet-500" />, t: 'Tasa preferencial', d: 'Interés compuesto (Francés) o interés simple, según el acuerdo.' },
                    { icon: <Clock className="size-4 text-violet-500" />,   t: 'Plazos flexibles', d: 'De 1 hasta 60 meses según capacidad de pago.' },
                    { icon: <Shield className="size-4 text-violet-500" />,  t: 'Aprobación interna', d: 'El comité evalúa y decide en pocos días hábiles.' },
                    { icon: <TrendingUp className="size-4 text-violet-500" />, t: 'Tabla de amortización', d: 'Generada automáticamente y descargable en PDF.' },
                  ].map(c => (
                    <div key={c.t} className="flex items-start gap-4 px-6 py-4">
                      <div className="p-1.5 bg-violet-50 dark:bg-violet-900/30 rounded-lg shrink-0">{c.icon}</div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{c.t}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.d}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 text-sm text-violet-800 dark:text-violet-300">
                <strong>Requisito:</strong> Tener cuenta activa (al menos un pago de ahorro permanente registrado).
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />

        {/* ══ SECCIÓN 4: EVENTOS ══ */}
        <section
          id="eventos"
          ref={el => { sectionRefs.current['eventos'] = el; }}
          className="scroll-mt-20"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="size-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-200 dark:shadow-amber-900/40 shrink-0">
              <Calendar className="size-7 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-0.5">Servicio 4</p>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white">Eventos</h2>
            </div>
          </div>

          {/* Banner de construcción */}
          <div className="relative overflow-hidden rounded-3xl border-2 border-dashed border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-8 py-14 text-center">
            {/* Patrón de fondo */}
            <div className="absolute inset-0 opacity-5"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, #f59e0b 0, #f59e0b 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />

            <div className="relative z-10 flex flex-col items-center gap-5">
              {/* Ícono animado */}
              <div className="relative">
                <div className="size-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-xl shadow-amber-300/40 dark:shadow-amber-900/40">
                  <Calendar className="size-12 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 size-8 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-md border-2 border-amber-300 dark:border-amber-600">
                  <span className="text-base">🚧</span>
                </div>
              </div>

              <div>
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 text-xs font-bold uppercase tracking-widest mb-4">
                  Módulo en construcción
                </span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                  Estamos trabajando en esto
                </h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  El módulo de <strong className="text-slate-700 dark:text-slate-200">Eventos</strong> está actualmente
                  en desarrollo. Pronto podrás consultar, registrarte y recibir notificaciones de todos los eventos del fondo.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2 w-full max-w-lg">
                {[
                  { icon: '🗓️', t: 'Asambleas',          d: 'Próximamente' },
                  { icon: '🎉', t: 'Actividades sociales', d: 'Próximamente' },
                  { icon: '📚', t: 'Capacitaciones',       d: 'Próximamente' },
                ].map(item => (
                  <div key={item.t} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 opacity-60">
                    <p className="text-2xl mb-1">{item.icon}</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.t}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{item.d}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Cuando esté disponible, recibirás una notificación en la plataforma.
              </p>
            </div>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="rounded-3xl overflow-hidden bg-gradient-to-r from-[#054030] via-[#0a7050] to-[#0f8c62] p-10 text-center shadow-2xl shadow-emerald-900/20">
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
          <p className="text-[#f0c040] text-sm font-bold tracking-widest uppercase mb-3">¿Listo para empezar?</p>
          <h3 className="text-2xl lg:text-3xl font-black text-white mb-3">Accede a todos estos servicios</h3>
          <p className="text-emerald-200 mb-8 max-w-lg mx-auto">
            Inicia sesión con tu cuenta de asociado y empieza a usar la plataforma hoy mismo.
          </p>
          <Button
            onClick={onNavigateToLogin}
            className="bg-[#f0c040] hover:bg-[#ffd84d] text-[#032a1e] font-black px-10 py-6 text-base rounded-2xl shadow-xl hover:-translate-y-1 transition-all"
          >
            Ingresar a mi cuenta <ArrowRight className="size-5 ml-2" />
          </Button>
        </section>

      </div>
    </div>
  );
}
