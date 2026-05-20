// ─────────────────────────────────────────────────────────────────────────────
// constants.ts — Constantes de UI compartidas en todo el sistema UFCA
//
// Regla: estas constantes son valores de PRESENTACIÓN fijos (labels, listas
// de opciones para formularios), NO parámetros de negocio.
//
// Los parámetros de negocio (aporteMinimo, diasMoraMaximo, etc.) vienen
// de la tabla `configuracion` en BD — ver businessRules.ts.
// ─────────────────────────────────────────────────────────────────────────────

// ── Frecuencias de ahorro voluntario ─────────────────────────────────────────
// Usadas en AhorroVoluntario.tsx y MisAhorros.tsx.
// El valor se guarda en la columna `frecuencia_ahorro` de la tabla `ahorros`.
export const FRECUENCIAS_AHORRO = [
  'Diaria',
  'Semanal',
  'Quincenal',
  'Mensual',
  'Bimestral',
  'Trimestral',
  'Semestral',
  'Anual',
] as const;

export type FrecuenciaAhorro = typeof FRECUENCIAS_AHORRO[number];

// ── Tipos de identificación colombiana ────────────────────────────────────────
// Usados en MiSolicitud.tsx y formularios de afiliación.
// Son tipos legales estándar — no cambian por configuración.
export const TIPOS_IDENTIFICACION = [
  { value: 'CC',  label: 'Cédula de Ciudadanía (CC)' },
  { value: 'TI',  label: 'Tarjeta de Identidad (TI)' },
  { value: 'CE',  label: 'Cédula de Extranjería (CE)' },
  { value: 'PP',  label: 'Pasaporte (PP)' },
  { value: 'NIT', label: 'NIT' },
] as const;

/** Reglas de validación por tipo de identificación */
export const REGLAS_ID: Record<string, { soloNumeros: boolean; min: number; max: number; hint: string }> = {
  CC:  { soloNumeros: true,  min: 6,  max: 10, hint: '6–10 dígitos numéricos' },
  TI:  { soloNumeros: true,  min: 8,  max: 11, hint: '8–11 dígitos numéricos' },
  CE:  { soloNumeros: false, min: 6,  max: 12, hint: '6–12 caracteres alfanuméricos' },
  PP:  { soloNumeros: false, min: 5,  max: 12, hint: '5–12 caracteres alfanuméricos' },
  NIT: { soloNumeros: true,  min: 9,  max: 10, hint: '9–10 dígitos (sin guion ni dígito de verificación)' },
};

// ── Tipos de crédito ──────────────────────────────────────────────────────────
// Usados en Creditos.tsx.
// El valor se guarda en la columna `tipo` de la tabla `creditos`.
// Nota: si se agrega un tipo nuevo en BD, también debe añadirse aquí.
export const TIPOS_CREDITO = [
  { value: 'libre_inversion', label: 'Libre inversión' },
  { value: 'educacion',       label: 'Educación' },
  { value: 'vivienda',        label: 'Vivienda' },
  { value: 'calamidad',       label: 'Calamidad' },
] as const;

// ── Estados de liquidación (etiquetas de UI) ──────────────────────────────────
// Guardados en el campo `detalle.estado` (jsonb) de la tabla `liquidaciones`.
// Solo dos estados activos:
//   • "En proceso" → estado inicial al crear la liquidación
//   • "Pagada"     → se asigna automáticamente al subir el comprobante de pago
export const ESTADOS_LIQUIDACION = [
  { value: 'En proceso', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'Pagada',     color: 'bg-green-100 text-green-700 border-green-200' },
] as const;

// ── Tipos de liquidación ──────────────────────────────────────────────────────
// Coinciden exactamente con el enum del campo `tipo` de la tabla `liquidaciones`.
// Nota: "cesantias" existe en la BD pero no aplica para natillera (es concepto laboral).
export const TIPOS_LIQUIDACION = [
  { value: 'retiro',        label: 'Retiro voluntario' },
  { value: 'expulsion',     label: 'Expulsión' },
  { value: 'fallecimiento', label: 'Fallecimiento' },
  { value: 'otro',          label: 'Otro' },
] as const;
