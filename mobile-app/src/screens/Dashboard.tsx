
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

export default function DashboardScreen() {
  const { userData } = useAuth();
  const isAdmin = userData?.rol === 'admin';

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">Hola, {userData?.nombre || 'Usuario'}</CardTitle>
          <CardDescription>
            {isAdmin ? 'Bienvenido al panel de administración.' : 'Bienvenido a tu portal de asociado.'}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4">
            <h3 className="font-semibold text-primary">Ahorros</h3>
            <p className="text-2xl font-bold text-primary mt-1">$0.00</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-4">
            <h3 className="font-semibold text-primary">Créditos</h3>
            <p className="text-2xl font-bold text-primary mt-1">Activo</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
