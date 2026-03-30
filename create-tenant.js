// scripts/create-tenant.js — Kenward CMS v2
// CLI tenant provisioning script.
// Usage: node scripts/create-tenant.js --name "Brokerage Name" --email broker@email.com

import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

// VERIFY: adjust import path if tokenService lives elsewhere
import { generateSessionToken } from '../src/security/tokenService.js';

// VERIFY: adjust import path if auditWriter exports differently
import { writeEntry } from '../src/system/auditWriter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// ─── Arg parsing ──────────────────────────────────────────────────────────────
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    name:  { type: 'string' },
    email: { type: 'string' },
  },
});

if (!values.name || !values.email) {
  console.error('Usage: node scripts/create-tenant.js --name "Brokerage Name" --email broker@email.com');
  process.exit(1);
}

// ─── Provision ────────────────────────────────────────────────────────────────
const tenantId = randomUUID();
const brokerId = randomUUID();

const tenantRoot = path.join(ROOT, 'data', 'tenants', tenantId);

const dirs = [
  path.join(tenantRoot, 'leads'),
  path.join(tenantRoot, 'docs'),
  path.join(tenantRoot, 'audit'),
];

// Create directory structure
for (const dir of dirs) {
  await mkdir(dir, { recursive: true });
}

// Write tenant manifest
const manifest = {
  tenantId,
  brokerId,
  name: values.name,
  email: values.email,
  createdAt: new Date().toISOString(),
};

await writeFile(
  path.join(tenantRoot, 'tenant.json'),
  JSON.stringify(manifest, null, 2),
  'utf8'
);

// Write genesis audit entry
// VERIFY: writeEntry signature — expected: (tenantId, payload, keyPath)
await writeEntry(tenantId, {
  event: 'TENANT_CREATED',
  tenantId,
  brokerId,
  name: values.name,
  email: values.email,
}, process.env.RSA_PRIVATE_KEY_PATH);

// Generate session token for broker
// VERIFY: generateSessionToken signature — expected: ({ tenantId, brokerId }) => string
const sessionToken = generateSessionToken({ tenantId, brokerId });

// ─── Output ───────────────────────────────────────────────────────────────────
console.log('\n✓ Tenant provisioned\n');
console.log(`  Tenant ID : ${tenantId}`);
console.log(`  Broker ID : ${brokerId}`);
console.log(`  Name      : ${values.name}`);
console.log(`  Email     : ${values.email}`);
console.log(`\n  Session token (use this to log in):\n`);
console.log(`  ${sessionToken}`);
console.log(`\n  Dashboard URL:`);
console.log(`  https://kenward.ca/broker/dashboard?token=${sessionToken}\n`);
