import { defineConfig } from 'vite';
import { nbaDataPlugin } from './server/api.js';

// Serve the local API during both development and production-build preview.
export default defineConfig({ plugins: [nbaDataPlugin()], server: { host: '127.0.0.1', strictPort: true } });
