import { build } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let renderChunkCalled = 0;

await build({
  configFile: false,
  root: path.resolve(__dirname, 'client'),
  build: {
    outDir: path.resolve(__dirname, 'dist-test'),
    emptyOutDir: true,
    minify: false,
  },
  plugins: [
    {
      name: 'test-render-chunk',
      enforce: 'post',
      renderChunk(code) {
        renderChunkCalled++;
        if (code.includes('const __vite__mapDeps=')) {
          console.log('Found __vite__mapDeps in chunk!');
          return {
            code: code.replace(/const __vite__mapDeps=/g, 'var __vite__mapDeps='),
            map: null,
          };
        }
        return null;
      }
    }
  ]
});

console.log('renderChunk called:', renderChunkCalled, 'times');
