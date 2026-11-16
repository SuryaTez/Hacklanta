import { watch } from 'node:fs';
import { execSync } from 'node:child_process';

let timer;
let running = false;
function rebuild() {
  if (running) return;
  running = true;
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('[watch] frontend rebuilt');
  } catch {
    console.error('[watch] build failed; waiting for the next change');
  } finally {
    running = false;
  }
}
console.log('[watch] watching src/ — run `npm start` in another terminal');
rebuild();
watch('src', { recursive: true }, (_event, file) => {
  if (!file || !/\.(ts|css|html|svg)$/.test(file)) return;
  clearTimeout(timer);
  timer = setTimeout(rebuild, 180);
});
