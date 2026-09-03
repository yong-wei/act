#!/usr/bin/env tsx
// Refresh the capture identity of docs/architecture/tooling-cli-inventory.json
// after any change to package scripts, target scripts, documented invocations
// or inventory classification. Run: npx tsx scripts/tests/refresh-tooling-cli-inventory-identity.ts
import { readFileSync, writeFileSync } from 'node:fs';

import { refreshIdentity, type ToolingInventory } from '../lib/tooling-cli-inventory-identity';

const INVENTORY_PATH = 'docs/architecture/tooling-cli-inventory.json';

const inventory = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8')) as ToolingInventory;
const refreshed = refreshIdentity(inventory);
writeFileSync(INVENTORY_PATH, `${JSON.stringify(refreshed, null, 2)}\n`);
console.log('captureDenominatorSha256:', refreshed.sourceIdentity.captureDenominatorSha256);
