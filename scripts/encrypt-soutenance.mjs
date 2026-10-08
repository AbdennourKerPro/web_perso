// Packs the private `soutenance/` folder (never committed) into one encrypted
// file served at abdennour.tech/soutenance. The repository is public, so only
// the ciphertext may be committed; the password never leaves this machine.
//
// Usage:  node scripts/encrypt-soutenance.mjs
//         (asks for the password; or set SOUTENANCE_PASSWORD in the environment)
//
// Format of web/soutenance/deck.bin:
//   "SOUT1" | salt (16 B) | iv (12 B) | AES-256-GCM ciphertext
// Key: PBKDF2-SHA256, 600 000 iterations. Plaintext:
//   manifest length (uint32 BE) | manifest JSON [{name, type, size}] | file bytes

import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'soutenance');
const OUT = join(ROOT, 'web', 'soutenance', 'deck.bin');
const ITERATIONS = 600000;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png',
  '.gif': 'image/gif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.css': 'text/css', '.mp4': 'video/mp4', '.webm': 'video/webm' };

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function askPassword(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(prompt, answer => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    rl._writeToOutput = s => { if (s.includes(prompt)) rl.output.write(prompt); };
  });
}

let password = process.env.SOUTENANCE_PASSWORD;
if (!password) {
  password = await askPassword('Mot de passe : ');
  if (password !== await askPassword('Confirmer : ')) { console.error('Les mots de passe diffèrent.'); process.exit(1); }
}
if (!password || password.length < 10) { console.error('Mot de passe trop court (10 caractères minimum).'); process.exit(1); }

const files = walk(SRC).map(p => ({ name: relative(SRC, p).split('\\').join('/'), data: readFileSync(p) }));
const manifest = Buffer.from(JSON.stringify(files.map(f => ({
  name: f.name, type: TYPES[extname(f.name).toLowerCase()] || 'application/octet-stream', size: f.data.length,
}))));
const len = Buffer.alloc(4); len.writeUInt32BE(manifest.length);
const plain = Buffer.concat([len, manifest, ...files.map(f => f.data)]);

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
  base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const cipher = Buffer.from(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat([Buffer.from('SOUT1'), salt, iv, cipher]));
console.log(`${files.length} fichiers chiffrés -> ${relative(ROOT, OUT)} (${(cipher.length / 1e6).toFixed(1)} Mo)`);
