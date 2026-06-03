export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

export const getEstadoBadgeColor = (estado: string) => {
  switch (estado) {
    case 'Aprobado':   return 'bg-emerald-100 text-emerald-700';
    case 'En proceso': return 'bg-blue-100 text-blue-700';
    case 'Pendiente':  return 'bg-yellow-100 text-yellow-700';
    case 'Rechazado':  return 'bg-red-100 text-red-700';
    default:           return 'bg-slate-100 text-slate-700';
  }
};
