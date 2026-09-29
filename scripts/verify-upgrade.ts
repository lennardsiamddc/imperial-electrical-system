import assert from 'node:assert/strict';
import {query,closeDB} from '../lib/db';
import {migrate} from '../lib/migrations';
async function snapshot(){const state:Record<string,unknown>={};for(const table of ['users','customers','products','suppliers','audit_log','sessions']){
 const order=table==='sessions'?'token_hash':'id';
 // Compare existing data without printing credentials or customer details.
 state[table]=(await query(`SELECT to_jsonb(t)${table==='products'?"-'notes'":''} AS data FROM ${table} t ORDER BY ${order}`)).rows;
 }return state;}
async function main(){const before=await snapshot();await migrate();const after=await snapshot();assert.deepEqual(after,before,'Existing records changed during upgrade');await migrate();assert.deepEqual(await snapshot(),before,'Migration replay changed existing records');
 console.log('Existing accounts, password hashes, sessions, masters and audit rows preserved; migration replay is safe.');
 for(const [name,rows] of Object.entries(after))console.log(name,(rows as unknown[]).length);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(closeDB);
