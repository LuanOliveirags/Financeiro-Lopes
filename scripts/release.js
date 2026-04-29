// scripts/release.js
// Pipeline: web assets → cap sync → build APK → upload → atualiza URL
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const gradlew = path.join(root, 'android', 'gradlew.bat');

// Java incluído no Android Studio — evita depender de instalação separada
process.env.JAVA_HOME = 'C:\\Program Files\\Android\\Android Studio\\jbr';

const STEPS = [
  {
    label: '1/4  Copiando web assets',
    cmd: 'node', args: ['scripts/copy-web.js'], cwd: root,
  },
  {
    label: '2/4  Capacitor sync',
    cmd: 'npx', args: ['cap', 'sync', 'android'], cwd: root,
  },
  {
    label: '3/4  Build APK (Gradle)',
    cmd: gradlew, args: ['assembleDebug', '--daemon', '--quiet'], cwd: path.join(root, 'android'),
  },
  {
    label: '4/4  Upload APK + atualiza URL',
    cmd: 'node', args: ['scripts/upload-apk.js'], cwd: root,
  },
];

function hr(char = '─') { return char.repeat(52); }

function run({ label, cmd, args, cwd }) {
  process.stdout.write(`\n${hr()}\n▶  ${label}\n${hr()}\n`);
  const t0 = Date.now();
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true, cwd });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (result.status !== 0) {
    console.error(`\n❌  Falhou (${elapsed}s) — abortando pipeline`);
    process.exit(result.status || 1);
  }
  console.log(`✓  Concluído em ${elapsed}s`);
}

console.log(`\n${'═'.repeat(52)}`);
console.log('  WolfSource Release Pipeline');
console.log(`${'═'.repeat(52)}`);

const t0 = Date.now();
for (const step of STEPS) run(step);
const total = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`\n${'═'.repeat(52)}`);
console.log(`  ✅  Pipeline completo em ${total}s`);
console.log(`${'═'.repeat(52)}\n`);
