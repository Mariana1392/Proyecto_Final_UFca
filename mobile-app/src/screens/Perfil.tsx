
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function PerfilScreen() {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      <Card>
        <CardHeader>
          <CardTitle>Perfil de Usuario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-2xl font-bold">
              {userData?.nombre?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h3 className="font-bold text-foreground text-lg">{userData?.nombre}</h3>
              <p className="text-muted-foreground text-sm">{userData?.email || userData?.correo}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={handleSignOut}
            >
              Cerrar Sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
