import {writeFile} from 'node:fs/promises';
import {query,closeDB} from '../lib/db';
import {legacyReport} from '../lib/finance';
import type {Actor} from '../lib/permissions';
async function main(){if(!process.env.LOCAL_DB_PATH?.includes('stage5-rehearsal'))throw new Error('Restored rehearsal database only');const owner=(await query<Actor>("SELECT id,name,email,roles FROM users WHERE active AND 'PRESIDENT_ADMIN'=ANY(roles) LIMIT 1")).rows[0];const report=await legacyReport(owner);await writeFile('test-results/stage5-legacy-classification.json',JSON.stringify(report,null,2));console.log(report);}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(closeDB);
