import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from './components/ui/sonner';

import MobileLayout from './components/MobileLayout';
import LoginScreen from './screens/Login';
import DashboardScreen from './screens/Dashboard';
import AhorrosScreen from './screens/Ahorros';
import LiquidacionesScreen from './screens/Liquidaciones';
import CreditosScreen from './screens/Creditos';
import PerfilScreen from './screens/Perfil';
import ConfiguracionScreen from './screens/Configuracion';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />

            <Route element={<MobileLayout />}>
              <Route path="/" element={<DashboardScreen />} />
              <Route path="/ahorros" element={<AhorrosScreen />} />
              <Route path="/liquidaciones" element={<LiquidacionesScreen />} />
              <Route path="/creditos" element={<CreditosScreen />} />
              <Route path="/perfil" element={<PerfilScreen />} />
              <Route path="/configuracion" element={<ConfiguracionScreen />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
