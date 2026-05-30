import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Поднимаем порог предупреждения до 1000 КБ — главный бандл всё равно
    // делим на vendor-чанки ниже, но иногда recharts/firebase превышают 500.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Vendor splitting: тяжёлые внешние библиотеки в отдельных чанках.
        // Преимущества:
        //   • кеш-хит на повторных визитах (хеш чанка не меняется при правках нашего кода)
        //   • параллельная загрузка
        //   • меньше main bundle для первой отрисовки
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
