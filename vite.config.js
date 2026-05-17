import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' makes the build portable — works on GitHub Pages user.github.io/repo
// paths, custom domains, or anywhere else, without needing the repo name baked in.
export default defineConfig({
  plugins: [react()],
  base: './',
});
