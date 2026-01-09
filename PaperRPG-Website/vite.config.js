import { defineConfig } from 'vite';

export default defineConfig({
    base: '/RPG/', // Correct base path for https://yumeututucosmology.github.io/RPG/
    server: {
        port: 5174, // Keeping our development port
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: 'index.html',
                game: 'game.html'
            }
        }
    }
});
