import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    base: '/RPG/', // GitHub Pages repository name
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                game: resolve(__dirname, 'game.html'),
            },
        },
    },
    server: {
        open: false,
    },
});
