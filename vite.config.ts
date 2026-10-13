import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port 8000 on purpose: the Mapbox public token is URL-restricted and already
// allows http://localhost:8000 (the old Phase 0 page used it). When you add
// chollamaps.com to the token's allowed URLs, add http://localhost:8000 too if
// it's gone.
export default defineConfig({
  plugins: [react()],
  server: { port: 8000, strictPort: true },
  build: { sourcemap: false, chunkSizeWarningLimit: 2000 }
});
