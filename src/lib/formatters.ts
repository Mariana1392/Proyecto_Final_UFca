// ── formatters.ts ─────────────────────────────────────────────────────────────
// Funciones de formato monetario reutilizables en toda la aplicación.
// Idioma de referencia: es-CO (peso colombiano, COP).

/** Formatea un número como moneda COP sin decimales. Ej: 50000 → "$50.000" */
export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);

/**
 * Formatea una cadena de texto como número con 1 decimal en notación es-CO.
 * Útil para mostrar el valor mientras el usuario escribe en un Input.
 * Ej: "50000" → "50.000,0"
 */
export const formatCurrencyInput = (value: string): string => {
  const clean = value.replace(/[^\d.]/g, '');
  if (!clean) return '';
  const num = parseFloat(clean);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(num);
};

/**
 * Convierte una cadena formateada en es-CO a número flotante.
 * Ej: "50.000,5" → 50000.5
 */
export const parseCurrencyInput = (v: string): number =>
  parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
