import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Поднимаем порог предупреждения до 1500 КБ.
    // Раньше пытались разделить vendor вручную (manualChunks), но это сломало
    // порядок инициализации (recharts грузился до react → "Cannot read properties of undefined: PureComponent").
    // Безопаснее отдать chunk-splitting на откуп Rollup — он сам разрулит зависимости.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 3000,
    host: true,
  },
});
