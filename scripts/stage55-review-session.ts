import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {authenticate} from '../lib/sessions';
import {closeDB} from '../lib/db';
async function main(){assert.equal(process.cwd(),'/private/tmp/imperial-stage55-app');assert(!process.env.DATABASE_URL);const token=await authenticate('stage55.owner@example.test','TEST Stage55 acceptance 2026!');assert(token);await writeFile('/private/tmp/imperial-q55-review-token',token,{mode:0o600});console.log('Isolated Owner login verified.');}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(closeDB);
