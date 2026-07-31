#!/usr/bin/env node
/**
 * SOS Coordina — interactive deployment assistant ("guía burros").
 *
 * Automates everything automatable:
 *   1. wrangler auth (offers `wrangler login` if needed)
 *   2. D1 database create + database_id written into wrangler.jsonc + migrations
 *   3. R2 bucket create
 *   4. AI provider secrets (AI Gateway / Anthropic / OpenAI)
 *   5. Generated secrets (gateway token, kanban secret, CDP secret)
 *   6. Optional Telegram bot token
 *   7. Deploy + WORKER_URL wiring
 * Prints the few remaining manual steps (Cloudflare Access) with direct links.
 *
 * Idempotent: existing resources are detected and reused.
 */
import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WRANGLER_CONFIG = join(ROOT, 'wrangler.jsonc');
const DB_NAME = 'KANBAN_DB';
const R2_BUCKET = 'moltbot-data';
const WORKER_NAME = 'moltbot-sandbox';

const es = (process.env.LC_ALL || process.env.LANG || '').toLowerCase().startsWith('es');

const t = {
  title: es
    ? '\n🆘 SOS Coordina — Asistente de despliegue\n   (responde con Enter para aceptar los valores por defecto)\n'
    : '\n🆘 SOS Coordina — Deployment assistant\n   (press Enter to accept defaults)\n',
  step: (n, total, msg) => `\n━━ Paso ${n}/${total}: ${msg} ━━`,
  stepEn: (n, total, msg) => `\n━━ Step ${n}/${total}: ${msg} ━━`,
  ok: es ? '✓' : '✓',
  authChecking: es ? 'Comprobando login de Cloudflare...' : 'Checking Cloudflare login...',
  authNeeded: es
    ? 'No hay sesión activa. Voy a lanzar `wrangler login` — se abrirá tu navegador, pulsa "Allow".'
    : 'Not logged in. Launching `wrangler login` — your browser will open, click "Allow".',
  authOk: (acct) => (es ? `Sesión activa (cuenta ${acct})` : `Logged in (account ${acct})`),
  authFail: es
    ? '✗ No se pudo iniciar sesión. Ejecuta `npx wrangler login` a mano y vuelve a intentarlo.'
    : '✗ Login failed. Run `npx wrangler login` manually and retry.',
  d1Found: es ? 'Base de datos D1 ya existe, la reutilizo' : 'D1 database already exists, reusing it',
  d1Creating: es ? 'Creando base de datos D1...' : 'Creating D1 database...',
  d1Writing: es ? 'Escribiendo database_id en wrangler.jsonc...' : 'Writing database_id into wrangler.jsonc...',
  d1Fail: es ? '✗ No pude obtener el database_id. Salida de wrangler:' : '✗ Could not get the database_id. Wrangler output:',
  migrations: es
    ? 'Aplicando migraciones (confirma con "y" si wrangler lo pide)...'
    : 'Applying migrations (confirm with "y" if wrangler asks)...',
  r2Found: es ? 'Bucket R2 ya existe' : 'R2 bucket already exists',
  r2Creating: es ? 'Creando bucket R2...' : 'Creating R2 bucket...',
  aiMenu: es
    ? '¿Cómo se alimenta el agente?\n  1) Cloudflare AI Gateway (recomendado: logs, caché, métricas)\n  2) Anthropic directo (API key)\n  3) OpenAI directo (API key)'
    : 'How should the agent call the LLM?\n  1) Cloudflare AI Gateway (recommended: logs, cache, metrics)\n  2) Direct Anthropic (API key)\n  3) Direct OpenAI (API key)',
  aiKeyHelp: es
    ? 'Crea la API key en el dashboard de AI Gateway (botón "Create API Key"):'
    : 'Create the API key in the AI Gateway dashboard ("Create API Key" button):',
  aiGatewayIdHelp: es
    ? 'ID del gateway (usa "default" si no has creado uno — se crea solo en la primera petición)'
    : 'Gateway ID (use "default" if you have not created one — it auto-creates on first request)',
  pasteKey: (what) => (es ? `Pega tu ${what}` : `Paste your ${what}`),
  secretsGen: es
    ? 'Generando secretos aleatorios (gateway token, kanban, CDP)...'
    : 'Generating random secrets (gateway token, kanban, CDP)...',
  secretSkip: (name) => (es ? `${name} ya existe, lo conservo` : `${name} already set, keeping it`),
  telegramAsk: es
    ? '¿Token del bot de Telegram? (Enter para saltar — se puede añadir luego)'
    : 'Telegram bot token? (Enter to skip — can be added later)',
  r2PersistAsk: es
    ? '¿Persistencia R2 del estado del agente (recomendado)? Requiere un API token de R2 (Object Read & Write). [Y/n]'
    : 'Enable R2 persistence for agent state (recommended)? Requires an R2 API token (Object Read & Write). [Y/n]',
  r2TokenHelp: es ? 'Crea el token en:' : 'Create the token at:',
  deployAsk: es ? '¿Desplegar ahora? (primera vez: 10-15 min por la build de Docker) [Y/n]' : 'Deploy now? (first time: 10-15 min for the Docker build) [Y/n]',
  deploying: es ? 'Desplegando... (paciencia, la build del contenedor es lenta la primera vez)' : 'Deploying... (first container build is slow, be patient)',
  deployFail: es ? '✗ El despliegue falló. Revisa la salida de arriba.' : '✗ Deploy failed. Check the output above.',
  workerUrlFound: (url) => (es ? `URL del worker: ${url}` : `Worker URL: ${url}`),
  workerUrlAsk: es
    ? 'No pude detectar la URL. Escribe tu subdominio workers.dev (p. ej. "moltbot-sandbox.tu-sub.workers.dev"):'
    : 'Could not detect the URL. Enter your workers.dev subdomain (e.g. "moltbot-sandbox.your-sub.workers.dev"):',
  redeployAsk: es
    ? 'WORKER_URL configurado. ¿Redespliego para activarlo? (rápido, la imagen ya está en caché) [Y/n]'
    : 'WORKER_URL set. Redeploy to activate it? (fast, image is cached) [Y/n]',
  manualTitle: es
    ? '\n═══ ÚLTIMOS PASOS MANUALES (dashboard, ~5 min) ═══'
    : '\n═══ FINAL MANUAL STEPS (dashboard, ~5 min) ═══',
  manualAccess: es
    ? [
        '1. Zero Trust → Access → Applications → Add → Self-hosted:',
        '   cubre moltbot-sandbox.<tu-sub>.workers.dev con tu email.',
        '2. En esa app, política adicional "Bypass" con Action=Bypass,',
        '   Selector=Everyone y rutas: /api/*, /cdp/*',
        '   (así el agente y Telegram llaman sin Access; el panel sigue protegido).',
        '3. Copia el Team domain y el AUD tag de la app y ejecuta:',
        '   npx wrangler secret put CF_ACCESS_TEAM_DOMAIN',
        '   npx wrangler secret put CF_ACCESS_AUD',
        '4. Workers → moltbot-sandbox → Settings → desactiva "Browser SSH".',
      ]
    : [
        '1. Zero Trust → Access → Applications → Add → Self-hosted:',
        '   cover moltbot-sandbox.<your-sub>.workers.dev with your email.',
        '2. In that app, add a "Bypass" policy: Action=Bypass,',
        '   Selector=Everyone, paths: /api/*, /cdp/*',
        '   (agent & Telegram call without Access; the panel stays protected).',
        '3. Copy the team domain and AUD tag from the app and run:',
        '   npx wrangler secret put CF_ACCESS_TEAM_DOMAIN',
        '   npx wrangler secret put CF_ACCESS_AUD',
        '4. Workers → moltbot-sandbox → Settings → disable "Browser SSH".',
      ],
  done: es
    ? '\n🎉 Despliegue completo. Abre https://moltbot-sandbox.<tu-sub>.workers.dev/_admin/\n'
    : '\n🎉 Deployment complete. Open https://moltbot-sandbox.<your-sub>.workers.dev/_admin/\n',
  cancelled: es ? '\nCancelado. Vuelve cuando quieras: npm run setup\n' : '\nCancelled. Come back anytime: npm run setup\n',
};

// ---------- helpers ----------

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q) => (await rl.question(`${q}\n> `)).trim();
const askYesNo = async (q, def = true) => {
  const a = (await ask(q)).toLowerCase();
  if (!a) return def;
  return a === 'y' || a === 's' || a === 'sí' || a === 'si';
};

function wrangler(args, { input } = {}) {
  return spawnSync('npx', ['wrangler', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    maxBuffer: 32 * 1024 * 1024,
  });
}

function wranglerInherit(args) {
  return spawnSync('npx', ['wrangler', ...args], { cwd: ROOT, stdio: 'inherit' });
}

/** Run a command, stream output live AND capture it. */
function runTee(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  return res;
}

function setSecret(name, value) {
  const res = wrangler(['secret', 'put', name], { input: `${value}\n` });
  if (res.status !== 0) throw new Error(`secret put ${name} failed: ${res.stderr || res.stdout}`);
  console.log(`  ${t.ok} ${name}`);
}

function existingSecrets() {
  const res = wrangler(['secret', 'list']);
  if (res.status !== 0) return new Set();
  try {
    return new Set(JSON.parse(res.stdout).map((s) => s.name));
  } catch {
    return new Set([...res.stdout.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map((m) => m[1]));
  }
}

function setSecretIfMissing(existing, name, value) {
  if (existing.has(name)) {
    console.log(`  · ${t.secretSkip(name)}`);
    return;
  }
  setSecret(name, value);
  existing.add(name);
}

function step(n, total, msg) {
  console.log((es ? t.step : t.stepEn)(n, total, msg));
}

// ---------- steps ----------

async function ensureAuth() {
  console.log(t.authChecking);
  const res = wrangler(['whoami']);
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  if (res.status === 0 && !out.includes('not authenticated')) {
    const acct = out.match(/([0-9a-f]{32})/)?.[1] ?? '?';
    console.log(`${t.ok} ${t.authOk(acct)}`);
    return acct;
  }
  console.log(t.authNeeded);
  wranglerInherit(['login']);
  const retry = wrangler(['whoami']);
  const out2 = `${retry.stdout || ''}${retry.stderr || ''}`;
  if (retry.status !== 0 || out2.includes('not authenticated')) {
    console.error(t.authFail);
    process.exit(1);
  }
  const acct = out2.match(/([0-9a-f]{32})/)?.[1] ?? '?';
  console.log(`${t.ok} ${t.authOk(acct)}`);
  return acct;
}

function ensureD1() {
  const list = wrangler(['d1', 'list']);
  const found = (list.stdout || '')
    .split('\n')
    .find((l) => l.includes(DB_NAME))
    ?.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)?.[1];

  let dbId = found;
  if (dbId) {
    console.log(`${t.ok} ${t.d1Found} (${dbId})`);
  } else {
    console.log(t.d1Creating);
    const created = wrangler(['d1', 'create', DB_NAME]);
    const out = `${created.stdout || ''}${created.stderr || ''}`;
    dbId = out.match(/database_id\s*=\s*"([0-9a-f-]{36})"/)?.[1];
    if (!dbId) {
      console.error(t.d1Fail);
      console.error(out);
      process.exit(1);
    }
    console.log(`${t.ok} ${DB_NAME} (${dbId})`);
  }

  const config = readFileSync(WRANGLER_CONFIG, 'utf8');
  const current = config.match(/"database_id":\s*"([^"]+)"/)?.[1];
  if (current !== dbId) {
    console.log(t.d1Writing);
    writeFileSync(WRANGLER_CONFIG, config.replace(/"database_id":\s*"[^"]+"/, `"database_id": "${dbId}"`));
    console.log(`${t.ok} wrangler.jsonc`);
  }
  return dbId;
}

function applyMigrations() {
  console.log(t.migrations);
  const res = wranglerInherit(['d1', 'migrations', 'apply', DB_NAME, '--remote']);
  if (res.status !== 0) {
    console.error('✗ migrations apply failed');
    process.exit(1);
  }
  console.log(`${t.ok} migrations`);
}

function ensureR2() {
  const list = wrangler(['r2', 'bucket', 'list']);
  if ((list.stdout || '').includes(R2_BUCKET)) {
    console.log(`${t.ok} ${t.r2Found} (${R2_BUCKET})`);
    return;
  }
  console.log(t.r2Creating);
  const res = wrangler(['r2', 'bucket', 'create', R2_BUCKET]);
  if (res.status !== 0 && !(res.stderr || '').includes('already exists')) {
    console.error(`✗ r2 bucket create failed: ${res.stderr || res.stdout}`);
    process.exit(1);
  }
  console.log(`${t.ok} ${R2_BUCKET}`);
}

async function configureAI(existing, accountId) {
  console.log(t.aiMenu);
  const choice = (await ask(es ? 'Elige 1, 2 o 3' : 'Choose 1, 2 or 3')) || '1';
  if (choice === '2') {
    const key = await ask(t.pasteKey('ANTHROPIC_API_KEY (sk-ant-...)'));
    if (key) setSecret('ANTHROPIC_API_KEY', key);
  } else if (choice === '3') {
    const key = await ask(t.pasteKey('OPENAI_API_KEY (sk-...)'));
    if (key) setSecret('OPENAI_API_KEY', key);
  } else {
    console.log(t.aiKeyHelp);
    console.log(`  https://dash.cloudflare.com/${accountId}/ai/ai-gateway`);
    const key = await ask(t.pasteKey('CLOUDFLARE_AI_GATEWAY_API_KEY'));
    if (key) {
      setSecret('CLOUDFLARE_AI_GATEWAY_API_KEY', key);
      setSecretIfMissing(existing, 'CF_AI_GATEWAY_ACCOUNT_ID', accountId);
      const gw = (await ask(t.aiGatewayIdHelp)) || 'default';
      setSecret('CF_AI_GATEWAY_GATEWAY_ID', gw);
    }
  }
}

async function configureSecrets(existing, accountId) {
  console.log(t.secretsGen);
  setSecretIfMissing(existing, 'MOLTBOT_GATEWAY_TOKEN', randomBytes(24).toString('hex'));
  setSecretIfMissing(existing, 'KANBAN_AGENT_SECRET', randomBytes(24).toString('hex'));
  setSecretIfMissing(existing, 'CDP_SECRET', randomBytes(24).toString('hex'));

  if (await askYesNo(t.r2PersistAsk)) {
    console.log(t.r2TokenHelp);
    console.log(`  https://dash.cloudflare.com/${accountId}/r2/api-tokens`);
    const keyId = await ask(t.pasteKey('R2_ACCESS_KEY_ID'));
    const keySecret = await ask(t.pasteKey('R2_SECRET_ACCESS_KEY'));
    if (keyId && keySecret) {
      setSecret('R2_ACCESS_KEY_ID', keyId);
      setSecret('R2_SECRET_ACCESS_KEY', keySecret);
      setSecretIfMissing(existing, 'CLOUDFLARE_ACCOUNT_ID', accountId);
      setSecretIfMissing(existing, 'BACKUP_BUCKET_NAME', R2_BUCKET);
    }
  }

  const tg = await ask(t.telegramAsk);
  if (tg) setSecret('TELEGRAM_BOT_TOKEN', tg);
}

async function deployAndWireUrl(existing) {
  if (!(await askYesNo(t.deployAsk))) return;
  console.log(t.deploying);
  const res = runTee('npm', ['run', 'deploy']);
  if (res.status !== 0) {
    console.error(t.deployFail);
    process.exit(1);
  }
  const url =
    (res.stdout || '').match(new RegExp(`https://${WORKER_NAME}\\.[a-z0-9-]+\\.workers\\.dev`))?.[0] ??
    (await ask(t.workerUrlAsk));
  console.log(`${t.ok} ${t.workerUrlFound(url)}`);
  if (!existing.has('WORKER_URL')) {
    setSecret('WORKER_URL', url);
    existing.add('WORKER_URL');
    if (await askYesNo(t.redeployAsk)) {
      const res2 = runTee('npm', ['run', 'deploy']);
      if (res2.status !== 0) {
        console.error(t.deployFail);
        process.exit(1);
      }
    }
  }
}

function printManualSteps(accountId) {
  console.log(t.manualTitle);
  console.log(`  Zero Trust:  https://one.dash.cloudflare.com/${accountId}/access/apps\n`);
  for (const line of t.manualAccess) console.log(`  ${line}`);
  console.log(t.done);
}

// ---------- main ----------

const TOTAL = 7;
try {
  console.log(t.title);
  step(1, TOTAL, es ? 'Autenticación' : 'Authentication');
  const accountId = await ensureAuth();

  step(2, TOTAL, es ? 'Base de datos D1 (kanban)' : 'D1 database (kanban)');
  ensureD1();
  applyMigrations();

  step(3, TOTAL, es ? 'Bucket R2 (persistencia)' : 'R2 bucket (persistence)');
  ensureR2();

  step(4, TOTAL, es ? 'Proveedor de IA' : 'AI provider');
  const existing = existingSecrets();
  await configureAI(existing, accountId);

  step(5, TOTAL, es ? 'Secretos y canales' : 'Secrets & channels');
  await configureSecrets(existing, accountId);

  step(6, TOTAL, es ? 'Despliegue' : 'Deploy');
  await deployAndWireUrl(existing);

  step(7, TOTAL, es ? 'Pasos manuales' : 'Manual steps');
  printManualSteps(accountId);
} catch (err) {
  if (err?.code === 'ERR_USE_AFTER_CLOSE') {
    console.log(t.cancelled);
  } else {
    console.error(`\n✗ ${err.message}`);
    process.exit(1);
  }
} finally {
  rl.close();
}
