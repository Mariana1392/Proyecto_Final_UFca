export const TIPOS_CREDITO = [
  { value: 'libre_inversion', label: 'Libre inversión' },
  { value: 'educacion',       label: 'Educación' },
  { value: 'vivienda',        label: 'Vivienda' },
  { value: 'calamidad',       label: 'Calamidad' },
] as const;

export const ESTADOS_LIQUIDACION = [
  { value: 'En proceso', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'Pagada',     color: 'bg-green-100 text-green-700 border-green-200' },
] as const;

export const TIPOS_LIQUIDACION = [
  { value: 'retiro',        label: 'Retiro voluntario' },
  { value: 'expulsion',     label: 'Expulsión' },
  { value: 'fallecimiento', label: 'Fallecimiento' },
  { value: 'otro',          label: 'Otro' },
] as const;
