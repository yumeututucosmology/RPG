import { defineConfig } from 'vite';

export default defineConfig({
    base: '/paperrpg-website/', // Important for GitHub Pages deployment to subdirectories
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
