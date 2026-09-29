import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {query,closeDB} from '../lib/db';
import {migrate} from '../lib/migrations';
async function main(){
 if(!process.env.BEFORE_DB)throw new Error('Set BEFORE_DB to a separately extracted Stage 2 backup. Stop the local server before running.');
 const before=new PGlite(process.env.BEFORE_DB);
 try{
  await migrate();await migrate();
  for(const table of ['users','customers','products','suppliers','inventory_movements','audit_log','sessions','login_attempts']){
   const columns=(await before.query<{column_name:string}>('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',['imperial',table])).rows.map(r=>r.column_name);
   const order=table==='sessions'?'token_hash':table==='login_attempts'?'key':'id';
   const sql=`SELECT ${columns.map(c=>'"'+c+'"').join(',')} FROM imperial.${table} ORDER BY "${order}"`;
   const old=(await before.query(sql)).rows,current=(await query(sql)).rows;
   assert.deepEqual(current,old,`${table}: preservation failed`);console.log(`${table}: all ${old.length} original rows and columns identical`);
  }
  assert.equal((await query('SELECT standard_rate FROM tax_settings')).rows[0].standard_rate,'0.120000');
  console.log('VAT migration/replay passed. Existing VAT bases were not inferred or rewritten.');
 }finally{await before.close();await closeDB();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
