import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Settings, Percent, DollarSign, Clock, Save, RotateCcw, AlertTriangle, Info, Loader2, CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Parametros {
  tasa_libre_inversion: string;
  tasa_educacion:       string;
  tasa_vivienda:        string;
  tasa_calamidad:       string;
  tasa_mora_creditos:   string;
  tasa_interes_ahorros: string;
  aporte_minimo:                    string;
  cuotas_maximas_incumplidas:       string;
  dias_mora_maximo:                 string;
}

const DEFAULTS: Parametros = {
  tasa_libre_inversion: '18',
  tasa_educacion:       '14',
  tasa_vivienda:        '12',
  tasa_calamidad:       '10',
  tasa_mora_creditos:   '27',
  tasa_interes_ahorros: '4',
  aporte_minimo:                 '100000',
  cuotas_maximas_incumplidas:    '3',
  dias_mora_maximo:              '90',
};

const CLAVES = Object.keys(DEFAULTS) as (keyof Parametros)[];

export default function ConfiguracionScreen() {
  const { userData } = useAuth();
  const [params,   setParams]   = useState<Parametros>(DEFAULTS);
  const [original, setOriginal] = useState<Parametros>(DEFAULTS);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [dirty,    setDirty]    = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('configuracion').select('clave,valor').in('clave', CLAVES);
      if (error) throw error;
      const mapa: Partial<Parametros> = {};
      (data ?? []).forEach((row: { clave: string; valor: string }) => {
        if (CLAVES.includes(row.clave as keyof Parametros)) mapa[row.clave as keyof Parametros] = row.valor;
      });
      const merged: Parametros = { ...DEFAULTS, ...mapa };
      setParams(merged);
      setOriginal(merged);
      setDirty(false);
    } catch (err: any) {
      toast.error('Error al cargar parámetros: ' + err.message);
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
    const tasaKeys: (keyof Parametros)[] = ['tasa_libre_inversion','tasa_educacion','tasa_vivienda','tasa_calamidad','tasa_mora_creditos','tasa_interes_ahorros'];
    for (const k of tasaKeys) {
      const v = parseFloat(params[k]);
      if (isNaN(v) || v < 0 || v > 200) { toast.error(`Tasa inválida en "${k.replace(/_/g, ' ')}"`); return; }
    }

    setSaving(true);
    try {
      const ahora  = new Date().toISOString();
      const rows   = CLAVES.map(clave => ({ clave, valor: params[clave], updated_at: ahora }));
      const { error } = await supabase.from('configuracion').upsert(rows, { onConflict: 'clave' });
      if (error) throw error;

      // Auditoría
      const cambios = CLAVES.filter(k => params[k] !== original[k]);
      if (cambios.length > 0) {
        await supabase.from('auditoria').insert({
          tabla:        'configuracion',
          accion:       'update',
          descripcion:  `Parámetros actualizados: ${cambios.map(k => `${k}: ${original[k]} → ${params[k]}`).join(', ')}`,
          usuario_id:   userData?.id ?? null,
          datos_nuevos: JSON.stringify(params),
          datos_viejos: JSON.stringify(original),
          created_at:   ahora,
        });
      }

      setOriginal({ ...params });
      setDirty(false);
      toast.success('Parámetros guardados', {
        description: `${cambios.length} campo${cambios.length !== 1 ? 's' : ''} actualizado${cambios.length !== 1 ? 's' : ''} · Vigentes de inmediato`,
      });
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRestaurar = () => { setParams({ ...original }); setDirty(false); toast.info('Cambios descartados'); };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 className="size-8 text-blue-600 animate-spin" />
    </div>
  );

  const TasaInput = ({
    clave, label, desc, color = 'text-slate-600',
  }: { clave: keyof Parametros; label: string; desc: string; color?: string }) => (
    <div className="space-y-1.5">
      <Label htmlFor={clave} className="text-sm">{label}</Label>
      <div className="relative">
        <Input
          id={clave}
          type="number"
          step="0.01"
          min="0"
          max="200"
          value={params[clave]}
          onChange={e => handleChange(clave, e.target.value)}
          className={`pr-12 ${params[clave] !== original[clave] ? 'border-amber-400 bg-amber-50' : ''}`}
        />
        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold ${color}`}>% EA</span>
      </div>
      <p className="text-[11px] text-muted-foreground">{desc}</p>
      {params[clave] !== original[clave] && (
        <p className="text-[11px] text-amber-600 font-medium">Anterior: {original[clave]}%</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-100 rounded-xl">
          <Settings className="size-6 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">Parámetros del sistema</h2>
          <p className="text-xs text-muted-foreground">Tasas de interés y límites operativos</p>
        </div>
      </div>

      {/* Banner cambios pendientes */}
      {dirty && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="size-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">
            Tienes cambios sin guardar. Los valores actuales siguen vigentes hasta que guardes.
          </p>
        </div>
      )}

      {/* Botones guardar */}
      <div className="flex gap-2">
        {dirty && (
          <Button variant="outline" className="flex-1 gap-2" onClick={handleRestaurar} disabled={saving}>
            <RotateCcw className="size-4" /> Descartar
          </Button>
        )}
        <Button
          className={`gap-2 bg-blue-600 hover:bg-blue-700 ${dirty ? 'flex-1' : 'w-full'}`}
          onClick={handleGuardar}
          disabled={saving || !dirty}
        >
          {saving ? <><Loader2 className="size-4 animate-spin" /> Guardando…</> : <><Save className="size-4" /> Guardar cambios</>}
        </Button>
      </div>

      {/* Tasas de créditos */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Percent className="size-4 text-orange-500" /> Tasas de interés — Créditos
          </CardTitle>
          <p className="text-xs text-muted-foreground">Tasa Efectiva Anual (EA) por tipo de crédito</p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <TasaInput clave="tasa_libre_inversion" label="Libre inversión" desc="Uso personal sin destinación específica" color="text-blue-600" />
          <TasaInput clave="tasa_educacion" label="Educación" desc="Matrícula, libros, estudios formales" color="text-indigo-600" />
          <TasaInput clave="tasa_vivienda" label="Vivienda" desc="Arriendo, mejoras o compra" color="text-emerald-600" />
          <TasaInput clave="tasa_calamidad" label="Calamidad" desc="Emergencia por calamidad familiar" color="text-red-600" />
        </CardContent>
      </Card>

      {/* Tasa de mora */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 text-red-500" /> Tasa de mora
          </CardTitle>
          <p className="text-xs text-muted-foreground">Se aplica desde el primer día de incumplimiento</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <TasaInput clave="tasa_mora_creditos" label="Tasa de mora (EA)" desc="Sobre el saldo en mora desde el día del vencimiento" color="text-red-600" />
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
            <Info className="size-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">Sin días de gracia. La mora se calcula desde el día del vencimiento.</p>
          </div>
        </CardContent>
      </Card>

      {/* Rendimiento ahorros */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CheckCircle className="size-4 text-emerald-500" /> Rendimiento — Ahorros voluntarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TasaInput clave="tasa_interes_ahorros" label="Tasa de interés sobre ahorros (EA)" desc="Lo que UFCA paga a los asociados sobre ahorros voluntarios" color="text-emerald-600" />
        </CardContent>
      </Card>

      {/* Parámetros operativos */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="size-4 text-slate-500" /> Parámetros operativos
          </CardTitle>
          <p className="text-xs text-muted-foreground">Límites y reglas de negocio del sistema</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Aporte mínimo */}
          <div className="space-y-1.5">
            <Label htmlFor="aporte_minimo" className="flex items-center gap-1.5 text-sm">
              <DollarSign className="size-3.5 text-blue-500" /> Aporte mínimo mensual
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">$</span>
              <Input
                id="aporte_minimo"
                type="number"
                min="0"
                step="1000"
                value={params.aporte_minimo}
                onChange={e => handleChange('aporte_minimo', e.target.value)}
                className={`pl-7 ${params.aporte_minimo !== original.aporte_minimo ? 'border-amber-400 bg-amber-50' : ''}`}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Valor mínimo en pesos (COP) del aporte mensual</p>
            {params.aporte_minimo !== original.aporte_minimo && (
              <p className="text-[11px] text-amber-600 font-medium">Anterior: ${original.aporte_minimo}</p>
            )}
          </div>

          {/* Cuotas máximas */}
          <div className="space-y-1.5">
            <Label htmlFor="cuotas_max" className="flex items-center gap-1.5 text-sm">
              <AlertTriangle className="size-3.5 text-amber-500" /> Cuotas incumplidas máx.
            </Label>
            <Input
              id="cuotas_max"
              type="number"
              min="1"
              max="24"
              value={params.cuotas_maximas_incumplidas}
              onChange={e => handleChange('cuotas_maximas_incumplidas', e.target.value)}
              className={params.cuotas_maximas_incumplidas !== original.cuotas_maximas_incumplidas ? 'border-amber-400 bg-amber-50' : ''}
            />
            <p className="text-[11px] text-muted-foreground">Cuotas sin pagar antes de escalar el caso</p>
            {params.cuotas_maximas_incumplidas !== original.cuotas_maximas_incumplidas && (
              <p className="text-[11px] text-amber-600 font-medium">Anterior: {original.cuotas_maximas_incumplidas}</p>
            )}
          </div>

          {/* Días mora máximo */}
          <div className="space-y-1.5">
            <Label htmlFor="dias_mora" className="flex items-center gap-1.5 text-sm">
              <Clock className="size-3.5 text-red-500" /> Días de mora máximo
            </Label>
            <div className="relative">
              <Input
                id="dias_mora"
                type="number"
                min="1"
                max="365"
                value={params.dias_mora_maximo}
                onChange={e => handleChange('dias_mora_maximo', e.target.value)}
                className={`pr-12 ${params.dias_mora_maximo !== original.dias_mora_maximo ? 'border-amber-400 bg-amber-50' : ''}`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">días</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Días en mora antes de acciones de cobro jurídico</p>
            {params.dias_mora_maximo !== original.dias_mora_maximo && (
              <p className="text-[11px] text-amber-600 font-medium">Anterior: {original.dias_mora_maximo} días</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Footer informativo */}
      <div className="flex items-start gap-2.5 px-4 py-3 bg-muted/50 border border-border rounded-xl">
        <Info className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Los cambios son efectivos de inmediato. Los créditos ya registrados conservan su tasa original.
          Cada modificación queda en el log de auditoría.
        </p>
      </div>
    </div>
  );
}
