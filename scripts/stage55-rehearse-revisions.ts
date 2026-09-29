import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {query,transaction,closeDB} from '../lib/db';
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
async function main(){
 assert.equal(process.env.LOCAL_DB_PATH,'/private/tmp/imperial-stage55-fee-rehearsal/.local-db');assert(!process.env.DATABASE_URL);
 const versions=(await query<{version:string}>('SELECT version FROM schema_migrations ORDER BY version')).rows.map(v=>v.version);assert.deepEqual(versions,['001','002','003','004','005','006','007']);
 await transaction(async db=>{await db.exec(await readFile('migrations/008_receivables.sql','utf8'));await db.query("INSERT INTO schema_migrations(version) VALUES('008')");});
 const tables=(await query<{table_name:string}>("SELECT table_name FROM information_schema.tables WHERE table_schema='imperial' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(r=>r.table_name);
 const columns:Record<string,string[]>={};for(const t of tables)columns[t]=(await query<{column_name:string}>("SELECT column_name FROM information_schema.columns WHERE table_schema='imperial' AND table_name=$1 ORDER BY ordinal_position",[t])).rows.map(r=>r.column_name);
 async function snapshot(){const result:Record<string,unknown>={};for(const t of tables){const rows=(await query(`SELECT row_to_json(x)::text data FROM (SELECT ${columns[t].map(c=>'"'+c+'"').join(',')} FROM "${t}" ${t==='schema_migrations'?"WHERE version NOT IN ('009','010')":''}) x ORDER BY row_to_json(x)::text`)).rows;result[t]={rows:rows.length,sha256:hash(JSON.stringify(rows))};}return result;}
 const before=await snapshot();await writeFile('test-results/stage55/revision-rehearsal-before.json',JSON.stringify(before,null,2));
 await transaction(async db=>{await db.exec(await readFile('migrations/009_quotation_documents.sql','utf8'));await db.query("INSERT INTO schema_migrations(version) VALUES('009')");await db.exec(await readFile('migrations/010_quotation_fee_access.sql','utf8'));await db.query("INSERT INTO schema_migrations(version) VALUES('010')");});
 const after=await snapshot();assert.deepEqual(after,before,'STOP: historical preservation mismatch');
 assert.equal((await query<{n:number}>('SELECT count(*)::int n FROM quotation_defaults')).rows[0].n,0);
 const result={passed:true,source:'Verified pre-008 backup restored in isolation; unchanged 008 applied to establish Stage 5 schema, then 009 and 010 rehearsed.',preexisting_tables:tables.length,comparison:'Every pre-existing column and row hashed identically, including 001–008 migration entries, audit and authentication.',before,after,migration009_sha256:hash(await readFile('migrations/009_quotation_documents.sql')),migration010_sha256:hash(await readFile('migrations/010_quotation_fee_access.sql')),excel_sha256:hash(await readFile('/Users/lennardsiamdelacruz/Desktop/IMPERIAL SYSTEM/IMPERIAL SYSTEM LIVE.xlsx'))};await writeFile('test-results/stage55/revision-rehearsal-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,preexisting_tables:tables.length,excel_sha256:result.excel_sha256}));
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(closeDB);
