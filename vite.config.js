import { resolve } from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const tokenFromEnv =
    env.VITE_TMDB_API_ACCESS_TOKEN ||
    env.TMBD_API_ACCESS_TOKEN ||
    env.TMDB_API_ACCESS_TOKEN ||
    process.env.VITE_TMDB_API_ACCESS_TOKEN ||
    process.env.TMBD_API_ACCESS_TOKEN ||
    process.env.TMDB_API_ACCESS_TOKEN ||
    '';

  const watchmodeFromEnv =
    env.VITE_WATCHMODE_API_KEY ||
    env.WATCHMODE_API_KEY ||
    process.env.VITE_WATCHMODE_API_KEY ||
    process.env.WATCHMODE_API_KEY ||
    '';

  return {
    root: 'src/',
    define: {
      __TMDB_ACCESS_TOKEN__: JSON.stringify(tokenFromEnv),
      __WATCHMODE_API_KEY__: JSON.stringify(watchmodeFromEnv),
    },
    build: {
      outDir: '../dist',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/index.html'),
          movie: resolve(__dirname, 'src/movie.html'),
          library: resolve(__dirname, 'src/library.html'),
        },
      },
    },
  };
});
