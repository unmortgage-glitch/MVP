import { appendFile } from 'fs/promises';
import { createHash, createSign } from 'crypto';

export async function writeEntry(tenantId, entry) {
    console.log(`[auditWriter] Logging entry for Tenant: ${tenantId}`);
    return true;
}
