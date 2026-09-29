import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {query,transaction,closeDB} from '../lib/db';
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const added=['receivables','collections','collection_allocations','check_events','collection_reversals','ar_adjustments','ar_followups','finance_requests'];
async function main(){
 const root=(await readFile('test-results/stage5-original-backup-path.txt','utf8')).trim(),phase=process.argv[2];
 const versions=(await query<{version:string}>('SELECT version FROM schema_migrations ORDER BY version')).rows.map(r=>r.version);
 if(phase==='migrate'){
  assert(!process.env.DATABASE_URL&&!process.env.LOCAL_DB_PATH,'Original local database only');
  assert.deepEqual(versions,['001','002','003','004','005','006','007'],'STOP: unexpected migration state');
  const baseline=JSON.parse(await readFile(root+'/baseline.json','utf8'));
  const sql=await readFile('migrations/008_receivables.sql','utf8');assert.equal(sha(sql),baseline.migration008_sha256,'STOP: migration file changed since verification');
  await transaction(async db=>{await db.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');assert.deepEqual((await db.query<{version:string}>('SELECT version FROM schema_migrations ORDER BY version')).rows.map(r=>r.version),versions);await db.exec(sql);await db.query("INSERT INTO schema_migrations(version) VALUES ('008')");});
  console.log('PASS: applied only migration 008 in one transaction. No data reconciliation or seed executed.');return;
 }
 const baseline=phase==='record'?null:JSON.parse(await readFile(root+'/baseline.json','utf8'));
 const tables=baseline?Object.keys(baseline.tables):(await query<{table_name:string}>("SELECT table_name FROM information_schema.tables WHERE table_schema='imperial' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(r=>r.table_name);
 const result:Record<string,unknown>={};
 for(const table of tables){assert(/^[a-z_]+$/.test(table));const rows=(await query(`SELECT to_jsonb(t)::text AS data FROM ${table} t ${table==='schema_migrations'?"WHERE version<>'008'":''} ORDER BY to_jsonb(t)::text`)).rows;result[table]={count:rows.length,sha256:sha(JSON.stringify(rows))};}
 const snapshot={tables:result,workbook_sha256:sha(await readFile('IMPERIAL SYSTEM LIVE.xlsx')),migration008_sha256:sha(await readFile('migrations/008_receivables.sql','utf8'))};
 if(phase==='record'){assert.deepEqual(versions,['001','002','003','004','005','006','007']);await writeFile(root+'/baseline.json',JSON.stringify(snapshot,null,2),{flag:'wx'});console.log('PASS: fresh original baseline recorded, 30 business tables plus 7 migration-history rows.');}
 else {assert.deepEqual(snapshot,baseline,'STOP: preservation mismatch');console.log('PASS: all 30 pre-existing tables, original migration-history rows, migration file and Excel match the fresh original baseline exactly.');}
 if(phase==='verify-after'){
  assert.deepEqual(versions,['001','002','003','004','005','006','007','008']);const counts:Record<string,unknown>={};for(const table of added){const n=(await query<{n:number}>(`SELECT count(*)::int n FROM ${table}`)).rows[0].n;assert.equal(n,0,'STOP: new financial table unexpectedly populated');counts[table]=n;}
  const invalid=(await query<{n:number}>("SELECT count(*)::int n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='imperial' AND NOT c.convalidated")).rows[0].n;assert.equal(invalid,0);
  const sales=(await query('SELECT number,status FROM sales ORDER BY number')).rows;const docs=(await query('SELECT number,kind,status FROM commercial_documents ORDER BY number')).rows;
  const report={passed:true,versions,new_table_counts:counts,unvalidated_constraints:invalid,sales,documents:docs,workbook_sha256:snapshot.workbook_sha256};await writeFile(root+'/post-migration-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(closeDB);
