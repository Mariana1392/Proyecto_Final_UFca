
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';
  import tailwindcss from '@tailwindcss/vite';
  import path from 'path';

  // A-08: aliases con versión específica eliminados — Vite resuelve los paquetes
  // directamente desde node_modules sin necesitar mapeos manuales.
  // Solo se mantiene el alias '@' para rutas internas del proyecto.
  export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'build',
      rollupOptions: {
        output: {
          manualChunks: {
            // Librerías de UI de Radix — se reusan en todos los módulos
            'vendor-radix': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-alert-dialog',
              '@radix-ui/react-checkbox',
              '@radix-ui/react-switch',
              '@radix-ui/react-label',
              '@radix-ui/react-slot',
            ],
            // Gráficas — solo se usan en Dashboard
            'vendor-charts': ['recharts'],
            // PDF — solo se usan al generar documentos
            'vendor-pdf': ['jspdf', 'jspdf-autotable'],
            // Supabase
            'vendor-supabase': ['@supabase/supabase-js'],
          },
        },
      },
    },
    server: {
      port: 3000,
      open: true,
    },
  });