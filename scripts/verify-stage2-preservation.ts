import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import {query,closeDB} from '../lib/db';
async function main(){
 if(!process.env.BEFORE_DB)throw new Error('Set BEFORE_DB to a separately extracted Stage 1 backup. Stop the live local server first.');
 const before=new PGlite(process.env.BEFORE_DB);
 try{for(const table of ['users','customers','products','suppliers','audit_log','sessions','login_attempts']){
  const columns=(await before.query<{column_name:string}>('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position',['imperial',table])).rows.map(r=>r.column_name);
  const order=table==='sessions'?'token_hash':table==='login_attempts'?'key':'id';
  const sql=`SELECT ${columns.map(c=>'"'+c+'"').join(',')} FROM imperial.${table} ORDER BY "${order}"`;
  const old=(await before.query(sql)).rows,current=(await query(sql)).rows;
  assert.deepEqual(current,old,`${table} preservation failed`);console.log(`${table}: ${old.length} rows preserved, all original columns identical`);
 }
 assert.equal((await query('SELECT count(*) AS n FROM inventory_movements')).rows[0].n,0);console.log('No opening stock was invented.');
 }finally{await before.close();await closeDB();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
