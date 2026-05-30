import { PiggyBank, Phone, Mail, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface Props {
  userData: any;
}

export default function CuentaPendienteActivacion({ userData }: Props) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-amber-50 via-white to-emerald-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">

        {/* Ícono y título */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center size-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl shadow-lg shadow-amber-200">
            <PiggyBank className="size-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            ¡Bienvenido/a a UFCA, {userData?.nombre?.split(' ')[0]}!
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed">
            Tu solicitud fue aprobada. Solo falta un paso para activar tu cuenta completa.
          </p>
        </div>

        {/* Card principal */}
        <Card className="border-amber-200 shadow-xl">
          <CardContent className="pt-6 space-y-5">

            {/* Paso pendiente */}
            <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="shrink-0 size-10 bg-amber-500 rounded-full flex items-center justify-center">
                <Clock className="size-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-amber-900 text-sm">Pago pendiente</p>
                <p className="text-amber-800 text-xs leading-relaxed mt-1">
                  Para activar tu cuenta debes realizar tu <strong>primera cuota de ahorro permanente</strong>.
                  El administrador de UFCA registrará el pago una vez lo efectúes.
                </p>
              </div>
            </div>

            {/* Lo que desbloquea */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Al activar tu cuenta tendrás acceso a:
              </p>
              {[
                'Ahorro voluntario',
                'Solicitud de créditos',
                'Referidos',
                'Liquidaciones',
                'Dashboard completo',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle className="size-4 text-emerald-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            {/* Contacto */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <p className="text-xs font-semibold text-emerald-800">
                ¿Cómo realizar el pago? Contáctanos:
              </p>
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <Phone className="size-4 shrink-0" />
                +57 314 758 7250
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <Mail className="size-4 shrink-0" />
                marboledalondono@gmail.com
              </div>
            </div>

          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          Esta pantalla desaparecerá automáticamente cuando el administrador registre tu primer aporte.
        </p>

      </div>
    </div>
  );
}
