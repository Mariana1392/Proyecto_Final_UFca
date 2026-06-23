// ── Configuracion.tsx ──────────────────────────────────────────────────────────
// Pantalla de administración de parámetros operativos y financieros del sistema.
// Solo accesible con permiso 'configuracion'.

import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Percent, DollarSign, Clock, Save, RotateCcw,
  AlertTriangle, CheckCircle, Info, Loader2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { businessRules } from '../services/businessRules';

interface ConfiguracionProps {
  userData?: any;
}

// Todas las claves que gestiona esta pantalla
interface Parametros {
  // Financieros — tasas EA %
  tasa_libre_inversion: string;
  tasa_educacion:       string;
  tasa_vivienda:        string;
  tasa_calamidad:       string;
  tasa_mora_creditos:   string;
  // Operativos
  aporte_minimo:                    string;
  cuotas_maximas_incumplidas:       string;
  dias_mora_maximo:                 string;
  permitir_retiros_parciales_defecto: string;
  multa_mora_ahorro_diaria:         string;
}

const DEFAULTS: Parametros = {
  tasa_libre_inversion: '18',
  tasa_educacion:       '14',
  tasa_vivienda:        '12',
  tasa_calamidad:       '10',
  tasa_mora_creditos:   '27',
  aporte_minimo:                      '100000',
  cuotas_maximas_incumplidas:         '3',
  dias_mora_maximo:                   '90',
  permitir_retiros_parciales_defecto: 'false',
  multa_mora_ahorro_diaria:           '2000',
};

const CLAVES = Object.keys(DEFAULTS) as (keyof Parametros)[];

export default function Configuracion({ userData }: ConfiguracionProps) {
  const [params, setParams]       = useState<Parametros>(DEFAULTS);
  const [original, setOriginal]   = useState<Parametros>(DEFAULTS);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [dirty, setDirty]         = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('configuracion')
        .select('clave, valor')
        .in('clave', CLAVES);
      if (error) throw error;

      const mapa: Partial<Parametros> = {};
      (data ?? []).forEach((row: { clave: string; valor: string }) => {
        if (CLAVES.includes(row.clave as keyof Parametros)) {
          mapa[row.clave as keyof Parametros] = row.valor;
        }
      });

      const merged: Parametros = { ...DEFAULTS, ...mapa };
      setParams(merged);
      setOriginal(merged);
      setDirty(false);
    } catch (err: any) {
      toast.error('Error al cargar los parámetros: ' + (err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleChange = (clave: keyof Parametros, valor: string) => {
    setParams(prev => {
      const updated = { ...prev, [clave]: valor };
      setDirty(JSON.stringify(updated) !== JSON.stringify(original));
      return updated;
    });
  };

  const handleGuardar = async () => {
    // Validaciones rápidas
    const tasaKeys: (keyof Parametros)[] = [
      'tasa_libre_inversion', 'tasa_educacion', 'tasa_vivienda',
      'tasa_calamidad', 'tasa_mora_creditos',
    ];
    for (const k of tasaKeys) {
      const v = parseFloat(params[k]);
      if (isNaN(v) || v < 0 || v > 200) {
        toast.error(`Tasa inválida en "${k.replace(/_/g, ' ')}" — debe estar entre 0% y 200%`);
        return;
      }
    }
    if (parseFloat(params.tasa_mora_creditos) < parseFloat(params.tasa_libre_inversion)) {
      toast.warning('Aviso: la tasa de mora es menor que la tasa de libre inversión. Verifica si es correcto.');
    }

    setSaving(true);
    try {
      const ahora = new Date().toISOString();
      const editor = userData?.nombre ?? userData?.email ?? 'Administrador';

      // Upsert de todos los parámetros
      const rows = CLAVES.map(clave => ({
        clave,
        valor:        params[clave],
        updated_at:   ahora,
      }));
      const { error } = await supabase
        .from('configuracion')
        .upsert(rows, { onConflict: 'clave' });
      if (error) throw error;

      // Registrar en auditoría los cambios
      const cambios = CLAVES.filter(k => params[k] !== original[k]);
      if (cambios.length > 0) {
        await supabase.from('auditoria').insert({
          tabla:       'configuracion',
          accion:      'update',
          descripcion: `Parámetros actualizados: ${cambios.map(k => `${k}: ${original[k]} → ${params[k]}`).join(', ')}`,
          usuario_id:  userData?.id ?? null,
          datos_nuevos: JSON.stringify(params),
          datos_viejos: JSON.stringify(original),
          created_at:  ahora,
        });
      }

      // Recargar el singleton de businessRules para que los nuevos valores se reflejen
      await businessRules.loadConfigFromDB();

      setOriginal({ ...params });
      setDirty(false);
      toast.success('Parámetros guardados correctamente', {
        description: `${cambios.length} campo${cambios.length !== 1 ? 's' : ''} actualizado${cambios.length !== 1 ? 's' : ''} · Vigentes de inmediato`,
      });
    } catch (err: any) {
      toast.error('Error al guardar: ' + (err?.message ?? err));
    } finally {
      setSaving(false);
    }
  };

  const handleRestaurar = () => {
    setParams({ ...original });
    setDirty(false);
    toast.info('Cambios descartados');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 text-blue-600 animate-spin" />
          <p className="text-sm text-slate-500">Cargando parámetros…</p>
        </div>
      </div>
    );
  }

  const TasaInput = ({
    clave, label, desc, icon, color,
  }: {
    clave: keyof Parametros;
    label: string;
    desc: string;
    icon?: React.ReactNode;
    color?: string;
  }) => (
    <div className="space-y-1.5">
      <Label htmlFor={clave} className="flex items-center gap-1.5 text-sm">
        {icon}
        {label}
      </Label>
      <div className="relative">
        <Input
          id={clave}
          type="number"
          step="0.01"
          min="0"
          max="200"
          value={params[clave]}
          onChange={(e) => handleChange(clave, e.target.value)}
          className={`pr-8 ${params[clave] !== original[clave] ? 'border-amber-400 bg-amber-50' : ''}`}
        />
        <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold ${color ?? 'text-slate-500'}`}>
          % EA
        </span>
      </div>
      <p className="text-[11px] text-slate-400 leading-tight">{desc}</p>
      {params[clave] !== original[clave] && (
        <p className="text-[11px] text-amber-600 font-medium">
          Valor anterior: {original[clave]}%
        </p>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 rounded-xl">
            <Settings className="size-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Parámetros del sistema</h1>
            <p className="text-sm text-slate-500">Configura las tasas de interés y los límites operativos de la cooperativa</p>
          </div>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="outline" onClick={handleRestaurar} disabled={saving} className="gap-2">
              <RotateCcw className="size-4" />
              Descartar
            </Button>
          )}
          <Button
            onClick={handleGuardar}
            disabled={saving || !dirty}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {saving
              ? <><Loader2 className="size-4 animate-spin" /> Guardando…</>
              : <><Save className="size-4" /> Guardar cambios</>}
          </Button>
        </div>
      </div>

      {/* Banner de cambios pendientes */}
      {dirty && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="size-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Tienes cambios sin guardar. Los parámetros actuales siguen vigentes hasta que hagas clic en <strong>Guardar cambios</strong>.
          </p>
        </div>
      )}

      {/* ── SECCIÓN: Tasas de créditos ──────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="size-4 text-orange-500" />
            Tasas de interés — Créditos
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Tasa Efectiva Anual (EA) que se carga a cada tipo de crédito. El administrador puede asignar interés simple o compuesto por crédito individual.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <TasaInput
            clave="tasa_libre_inversion"
            label="Libre inversión"
            desc="Créditos de uso personal sin destinación específica"
            icon={<DollarSign className="size-3.5 text-blue-500" />}
            color="text-blue-600"
          />
          <TasaInput
            clave="tasa_educacion"
            label="Educación"
            desc="Créditos para matrícula, libros o estudios formales"
            icon={<DollarSign className="size-3.5 text-indigo-500" />}
            color="text-indigo-600"
          />
          <TasaInput
            clave="tasa_vivienda"
            label="Vivienda"
            desc="Créditos para arriendo, mejoras o compra de vivienda"
            icon={<DollarSign className="size-3.5 text-emerald-500" />}
            color="text-emerald-600"
          />
          <TasaInput
            clave="tasa_calamidad"
            label="Calamidad doméstica"
            desc="Créditos de emergencia por calamidad familiar"
            icon={<DollarSign className="size-3.5 text-red-500" />}
            color="text-red-600"
          />
        </CardContent>
      </Card>

      {/* ── SECCIÓN: Tasa de mora ───────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-red-500" />
            Tasa de mora — Créditos
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Se aplica automáticamente desde el primer día de incumplimiento (sin días de gracia).
            Art. 884 C.Co.: la tasa de mora no puede superar 1.5× la tasa corriente certificada por la SFC.
          </p>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <TasaInput
              clave="tasa_mora_creditos"
              label="Tasa de mora (EA)"
              desc="Aplicada sobre el saldo en mora desde el día del vencimiento"
              icon={<Percent className="size-3.5 text-red-500" />}
              color="text-red-600"
            />
          </div>
          <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
            <Info className="size-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">
              El sistema no aplica días de gracia. Si el asociado no paga en la fecha de vencimiento,
              la mora se calcula desde ese mismo día con esta tasa.
            </p>
          </div>
        </CardContent>
      </Card>


      {/* ── SECCIÓN: Parámetros operativos ─────────────────────────────────── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4 text-slate-500" />
            Parámetros operativos
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Límites y reglas de negocio que controlan el comportamiento del sistema.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
          {/* Aporte mínimo */}
          <div className="space-y-1.5">
            <Label htmlFor="aporte_minimo" className="flex items-center gap-1.5 text-sm">
              <DollarSign className="size-3.5 text-blue-500" />
              Aporte mínimo mensual
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">$</span>
              <Input
                id="aporte_minimo"
                type="number"
                min="0"
                step="1000"
                value={params.aporte_minimo}
                onChange={(e) => handleChange('aporte_minimo', e.target.value)}
                className={`pl-7 ${params.aporte_minimo !== original.aporte_minimo ? 'border-amber-400 bg-amber-50' : ''}`}
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">Valor mínimo en pesos (COP) del aporte mensual obligatorio</p>
            {params.aporte_minimo !== original.aporte_minimo && (
              <p className="text-[11px] text-amber-600 font-medium">Anterior: ${original.aporte_minimo}</p>
            )}
          </div>

          {/* Cuotas máximas incumplidas */}
          <div className="space-y-1.5">
            <Label htmlFor="cuotas_maximas_incumplidas" className="flex items-center gap-1.5 text-sm">
              <AlertTriangle className="size-3.5 text-amber-500" />
              Cuotas incumplidas máx.
            </Label>
            <Input
              id="cuotas_maximas_incumplidas"
              type="number"
              min="1"
              max="24"
              value={params.cuotas_maximas_incumplidas}
              onChange={(e) => handleChange('cuotas_maximas_incumplidas', e.target.value)}
              className={params.cuotas_maximas_incumplidas !== original.cuotas_maximas_incumplidas ? 'border-amber-400 bg-amber-50' : ''}
            />
            <p className="text-[11px] text-slate-400 leading-tight">Cuotas sin pagar antes de mostrar alerta al administrador</p>
            {params.cuotas_maximas_incumplidas !== original.cuotas_maximas_incumplidas && (
              <p className="text-[11px] text-amber-600 font-medium">Anterior: {original.cuotas_maximas_incumplidas}</p>
            )}
          </div>

          {/* Días de mora máximos */}
          <div className="space-y-1.5">
            <Label htmlFor="dias_mora_maximo" className="flex items-center gap-1.5 text-sm">
              <Clock className="size-3.5 text-red-500" />
              Días de mora máximo
            </Label>
            <div className="relative">
              <Input
                id="dias_mora_maximo"
                type="number"
                min="1"
                max="365"
                value={params.dias_mora_maximo}
                onChange={(e) => handleChange('dias_mora_maximo', e.target.value)}
                className={`pr-10 ${params.dias_mora_maximo !== original.dias_mora_maximo ? 'border-amber-400 bg-amber-50' : ''}`}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">días</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">Días en mora permitidos antes de acciones de cobro jurídico</p>
            {params.dias_mora_maximo !== original.dias_mora_maximo && (
              <p className="text-[11px] text-amber-600 font-medium">Anterior: {original.dias_mora_maximo} días</p>
            )}
          </div>

          {/* Multa mora ahorro/día */}
          <div className="space-y-1.5">
            <Label htmlFor="multa_mora_ahorro_diaria" className="flex items-center gap-1.5 text-sm">
              <DollarSign className="size-3.5 text-red-500" />
              Multa mora ahorro/día
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">$</span>
              <Input
                id="multa_mora_ahorro_diaria"
                type="number"
                min="0"
                step="100"
                value={params.multa_mora_ahorro_diaria}
                onChange={(e) => handleChange('multa_mora_ahorro_diaria', e.target.value)}
                className={`pl-7 ${params.multa_mora_ahorro_diaria !== original.multa_mora_ahorro_diaria ? 'border-amber-400 bg-amber-50' : ''}`}
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">Multa diaria por mora en ahorro permanente (COP). Solo aplica a nuevas moras.</p>
            {params.multa_mora_ahorro_diaria !== original.multa_mora_ahorro_diaria && (
              <p className="text-[11px] text-amber-600 font-medium">Anterior: ${original.multa_mora_ahorro_diaria}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Footer informativo ──────────────────────────────────────────────── */}
      <div className="flex items-start gap-2.5 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
        <Info className="size-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          Los cambios son efectivos de inmediato en todo el sistema. Los créditos ya registrados
          conservan su tasa original — solo los nuevos créditos usarán las tasas actualizadas.
          De igual forma, los cambios en la multa diaria de mora en ahorro permanente solo aplican a nuevas moras (las cuentas que ya están en mora conservan su tarifa anterior).
          Cada modificación queda registrada en el log de auditoría con el usuario y la fecha.
        </p>
      </div>
    </div>
  );
}
