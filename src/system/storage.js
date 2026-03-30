import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import path from 'path';

/**
 * Kenward CMS v2 - Flattened Storage Gateway
 * Providing named exports for leadRoutes and uploadRoutes.
 */

export async function saveLead(tenantId, leadId, data) {
    console.log(`[storage] Saving Lead: ${leadId}`);
    return { success: true };
}

export async function readLead(tenantId, leadId) {
    console.log(`[storage] Reading Lead: ${leadId}`);
    return { id: leadId, status: 'mock' };
}

export async function readLeads(tenantId) {
    console.log(`[storage] Reading all leads for Tenant: ${tenantId}`);
    return [];
}

// Keep the object export as well for uploadRoutes
export const storage = {
    saveDocument: async (tenantId, leadId, file) => {
        return { path: `data/tenants/${tenantId}/docs/${file.filename}` };
    },
    saveLead,
    readLead,
    readLeads
};
