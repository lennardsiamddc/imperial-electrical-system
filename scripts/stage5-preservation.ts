import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {query,closeDB} from '../lib/db';
const target='backups/2026-09-17-stage5/baseline.json';
async function main(){
 const record=process.argv.includes('--record');
 const prior=record?null:JSON.parse(await readFile(target,'utf8'));
 const tables=record?(await query<{table_name:string}>("SELECT table_name FROM information_schema.tables WHERE table_schema='imperial' AND table_type='BASE TABLE' AND table_name<>'schema_migrations' ORDER BY table_name")).rows.map(r=>r.table_name):Object.keys(prior.tables);
 const result:Record<string,unknown>={};
 for(const table of tables){if(!/^[a-z_]+$/.test(table))throw new Error('Invalid table');const rows=(await query(`SELECT to_jsonb(t)::text AS data FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;result[table]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};}
 const snapshot={tables:result,workbook:createHash('sha256').update(await readFile('IMPERIAL SYSTEM LIVE.xlsx')).digest('hex')};
 if(record)await writeFile(target,JSON.stringify(snapshot,null,2),{mode:0o600,flag:'wx'});else assert.deepEqual(snapshot,prior);
 console.log(record?'Baseline recorded':'PASS: every pre-existing table and Excel matches exactly',Object.keys(result).length,'tables');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(closeDB);
