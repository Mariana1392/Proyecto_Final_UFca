import { createContext, useContext, useState, ReactNode } from 'react';

export interface Usuario {
  id: string;
  identificacion: string;
  username: string;
  nombre: string;
  email: string;
  telefono: string;
  rol: string;
  ultimoAcceso: string;
  estado: boolean;
  fechaCreacion: string;
  password?: string;
}

interface UserManagementContextType {
  usuarios: Usuario[];
  setUsuarios: React.Dispatch<React.SetStateAction<Usuario[]>>;
  updateUsuario: (id: string, updates: Partial<Usuario>) => void;
  updatePassword: (userId: string, newPassword: string) => void;
  getUsuarioByEmail: (email: string) => Usuario | undefined;
}

const UserManagementContext = createContext<UserManagementContextType | undefined>(undefined);

const USUARIOS_INICIALES: Usuario[] = [
  { id: '1', identificacion: '1010123456', username: 'juan.perez', nombre: 'Juan Pérez', email: 'juan.perez@ufca.com', telefono: '+57 300 111 2222', rol: 'Administrador', ultimoAcceso: '2024-02-20 10:30', estado: true, fechaCreacion: '2024-01-15' },
  { id: '2', identificacion: '1020234567', username: 'maria.gonzalez', nombre: 'María González', email: 'maria.gonzalez@ufca.com', telefono: '+57 301 222 3333', rol: 'Asociado', ultimoAcceso: '2024-02-20 09:15', estado: true, fechaCreacion: '2024-01-18' },
  { id: '3', identificacion: '1030345678', username: 'carlos.rodriguez', nombre: 'Carlos Rodríguez', email: 'carlos.rodriguez@ufca.com', telefono: '+57 302 333 4444', rol: 'Asociado', ultimoAcceso: '2024-02-19 16:45', estado: true, fechaCreacion: '2024-01-20' },
  { id: '4', identificacion: '1040456789', username: 'ana.martinez', nombre: 'Ana Martínez', email: 'ana.martinez@ufca.com', telefono: '+57 303 444 5555', rol: 'Asociado', ultimoAcceso: '2024-02-20 08:20', estado: true, fechaCreacion: '2024-01-22' },
  { id: '5', identificacion: '1050567890', username: 'pedro.sanchez', nombre: 'Pedro Sánchez', email: 'pedro.sanchez@ufca.com', telefono: '+57 304 555 6666', rol: 'Asociado', ultimoAcceso: '2024-02-18 14:30', estado: false, fechaCreacion: '2024-01-25' },
  { id: '6', identificacion: '1060678901', username: 'laura.fernandez', nombre: 'Laura Fernández', email: 'laura.fernandez@ufca.com', telefono: '+57 305 666 7777', rol: 'Asociado', ultimoAcceso: '2024-02-20 11:10', estado: true, fechaCreacion: '2024-02-01' },
  { id: '7', identificacion: '1070789012', username: 'miguel.torres', nombre: 'Miguel Torres', email: 'miguel.torres@ufca.com', telefono: '+57 306 777 8888', rol: 'Asociado', ultimoAcceso: '2024-02-19 13:25', estado: true, fechaCreacion: '2024-02-05' },
  { id: '8', identificacion: '1080890123', username: 'sandra.ruiz', nombre: 'Sandra Ruiz', email: 'sandra.ruiz@ufca.com', telefono: '+57 307 888 9999', rol: 'Asociado', ultimoAcceso: '2024-02-20 15:40', estado: true, fechaCreacion: '2024-02-08' },
];

export function UserManagementProvider({ children }: { children: ReactNode }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>(USUARIOS_INICIALES);

  const updateUsuario = (id: string, updates: Partial<Usuario>) => {
    setUsuarios(prev => prev.map(u => 
      u.id === id ? { ...u, ...updates } : u
    ));
  };

  const updatePassword = (userId: string, newPassword: string) => {
    setUsuarios(prev => prev.map(u => 
      u.id === userId ? { ...u, password: newPassword } : u
    ));
  };

  const getUsuarioByEmail = (email: string): Usuario | undefined => {
    return usuarios.find(u => u.email.toLowerCase() === email.toLowerCase());
  };

  return (
    <UserManagementContext.Provider value={{
      usuarios,
      setUsuarios,
      updateUsuario,
      updatePassword,
      getUsuarioByEmail,
    }}>
      {children}
    </UserManagementContext.Provider>
  );
}

export function useUserManagement() {
  const context = useContext(UserManagementContext);
  if (context === undefined) {
    throw new Error('useUserManagement must be used within a UserManagementProvider');
  }
  return context;
}