// 🆘 DASHBOARD SIMPLE DE EMERGENCIA
// Si tu Dashboard no funciona, reemplaza el contenido de src/components/Dashboard.tsx con este código

interface DashboardProps {
  userRole: 'admin' | 'asociado' | null;
  userData: any;
  onNavigate: (view: string) => void;
}

export default function Dashboard({ userRole, userData, onNavigate }: DashboardProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Bienvenido al Sistema UFCA
          </h1>
          <p className="text-gray-600">
            Unión Familiar de Crédito y Ahorro
          </p>
        </div>

        {/* Información del Usuario */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">
            Información del Usuario
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Rol</p>
              <p className="text-lg font-semibold text-gray-900">
                {userRole === 'admin' ? '👑 Administrador' : '👤 Asociado'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Nombre</p>
              <p className="text-lg font-semibold text-gray-900">
                {userData?.nombre || 'Usuario'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-lg font-semibold text-gray-900">
                {userData?.email || 'No disponible'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <p className="text-lg font-semibold text-green-600">
                ✅ Activo
              </p>
            </div>
          </div>
        </div>

        {/* Estadísticas Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card Ahorros */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-green-100 text-sm">Total Ahorros</p>
                <p className="text-3xl font-bold">$0.00</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                💰
              </div>
            </div>
            <p className="text-green-100 text-sm">
              +0% vs mes anterior
            </p>
          </div>

          {/* Card Créditos */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-blue-100 text-sm">Créditos Activos</p>
                <p className="text-3xl font-bold">$0.00</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                💳
              </div>
            </div>
            <p className="text-blue-100 text-sm">
              0 créditos en proceso
            </p>
          </div>

          {/* Card Asociados */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-purple-100 text-sm">Total Asociados</p>
                <p className="text-3xl font-bold">0</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                👥
              </div>
            </div>
            <p className="text-purple-100 text-sm">
              0 nuevos este mes
            </p>
          </div>

          {/* Card Eventos */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-orange-100 text-sm">Próximos Eventos</p>
                <p className="text-3xl font-bold">0</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-3">
                📅
              </div>
            </div>
            <p className="text-orange-100 text-sm">
              Sin eventos programados
            </p>
          </div>
        </div>

        {/* Accesos Rápidos */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">
            Accesos Rápidos
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {userRole === 'admin' && (
              <>
                <button
                  onClick={() => onNavigate('asociados')}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 hover:border-green-500"
                >
                  <span className="text-3xl mb-2">👥</span>
                  <span className="text-sm font-semibold text-gray-700">Asociados</span>
                </button>

                <button
                  onClick={() => onNavigate('creditos')}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 hover:border-green-500"
                >
                  <span className="text-3xl mb-2">💳</span>
                  <span className="text-sm font-semibold text-gray-700">Créditos</span>
                </button>

                <button
                  onClick={() => onNavigate('ahorro-permanente')}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 hover:border-green-500"
                >
                  <span className="text-3xl mb-2">💰</span>
                  <span className="text-sm font-semibold text-gray-700">Ahorros</span>
                </button>

                <button
                  onClick={() => onNavigate('eventos')}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 hover:border-green-500"
                >
                  <span className="text-3xl mb-2">📅</span>
                  <span className="text-sm font-semibold text-gray-700">Eventos</span>
                </button>

                <button
                  onClick={() => onNavigate('ventas')}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 hover:border-green-500"
                >
                  <span className="text-3xl mb-2">🛒</span>
                  <span className="text-sm font-semibold text-gray-700">Ventas</span>
                </button>

                <button
                  onClick={() => onNavigate('compras')}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 hover:border-green-500"
                >
                  <span className="text-3xl mb-2">📦</span>
                  <span className="text-sm font-semibold text-gray-700">Compras</span>
                </button>

                <button
                  onClick={() => onNavigate('productos')}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 hover:border-green-500"
                >
                  <span className="text-3xl mb-2">📦</span>
                  <span className="text-sm font-semibold text-gray-700">Productos</span>
                </button>

                <button
                  onClick={() => onNavigate('usuarios')}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 hover:border-green-500"
                >
                  <span className="text-3xl mb-2">⚙️</span>
                  <span className="text-sm font-semibold text-gray-700">Usuarios</span>
                </button>
              </>
            )}

            {userRole === 'asociado' && (
              <>
                <button
                  onClick={() => onNavigate('ahorro-permanente')}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 hover:border-green-500"
                >
                  <span className="text-3xl mb-2">💰</span>
                  <span className="text-sm font-semibold text-gray-700">Mis Ahorros</span>
                </button>

                <button
                  onClick={() => onNavigate('creditos')}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 hover:border-green-500"
                >
                  <span className="text-3xl mb-2">💳</span>
                  <span className="text-sm font-semibold text-gray-700">Mis Créditos</span>
                </button>

                <button
                  onClick={() => onNavigate('pedidos')}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 hover:border-green-500"
                >
                  <span className="text-3xl mb-2">🛍️</span>
                  <span className="text-sm font-semibold text-gray-700">Mis Pedidos</span>
                </button>

                <button
                  onClick={() => onNavigate('eventos')}
                  className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-colors border-2 border-gray-200 hover:border-green-500"
                >
                  <span className="text-3xl mb-2">📅</span>
                  <span className="text-sm font-semibold text-gray-700">Eventos</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mensaje Informativo */}
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="font-semibold text-yellow-800 mb-2">
                Dashboard en Modo Demo
              </h3>
              <p className="text-yellow-700 text-sm mb-3">
                Este es un dashboard simplificado. Los datos mostrados son de ejemplo.
              </p>
              <ul className="list-disc list-inside text-yellow-700 text-sm space-y-1">
                <li>Para ver datos reales, conecta la base de datos MySQL</li>
                <li>Sigue las instrucciones en <code className="bg-yellow-100 px-2 py-1 rounded">database-connection-examples.md</code></li>
                <li>O usa Supabase para un backend automático</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Sistema UFCA - Unión Familiar de Crédito y Ahorro</p>
          <p className="mt-1">Versión 1.0.0 | {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
