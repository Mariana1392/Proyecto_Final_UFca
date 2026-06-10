import { PiggyBank } from 'lucide-react';

interface PiggyBankLoaderProps {
  title?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function PiggyBankLoader({
  title = 'Cargando...',
  subtitle,
  size = 'md',
}: PiggyBankLoaderProps) {
  const iconSizes = { sm: 'size-8',  md: 'size-12', lg: 'size-16' };
  const paddings  = { sm: 'p-3',     md: 'p-4',     lg: 'p-5'     };
  const shadows   = { sm: '',        md: 'shadow-lg shadow-emerald-200/50', lg: 'shadow-xl shadow-emerald-200/50' };
  const gaps      = { sm: 'mb-3',    md: 'mb-4',    lg: 'mb-6'    };
  const titles    = { sm: 'text-sm font-semibold', md: 'text-lg font-bold', lg: 'text-2xl font-bold' };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className={`${paddings[size]} bg-emerald-100 rounded-full animate-bounce ${gaps[size]} ${shadows[size]} border-2 border-white`}>
        <PiggyBank className={`${iconSizes[size]} text-emerald-600`} />
      </div>
      <p className={`${titles[size]} text-slate-800 text-center`}>{title}</p>
      {subtitle && (
        <p className="text-slate-500 text-center text-sm mt-1 max-w-xs leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}
