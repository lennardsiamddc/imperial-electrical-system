import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {query,closeDB} from '../lib/db';
const target='backups/2026-09-16-stage3/baseline.json';
async function main(){
 const result:Record<string,unknown>={};
 for(const table of ['users','sessions','login_attempts','customers','suppliers','products','inventory_movements','tax_settings','audit_log']){
  const rows=(await query(`SELECT to_jsonb(t)::text AS data FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
  result[table]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
 }
 result.workbook=createHash('sha256').update(await readFile('IMPERIAL SYSTEM LIVE.xlsx')).digest('hex');
 if(process.argv.includes('--record')){await writeFile(target,JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});console.log('Preservation baseline recorded:',Object.fromEntries(Object.entries(result).map(([k,v])=>[k,typeof v==='object'?(v as {count:number}).count:v])));}
 else{assert.deepEqual(result,JSON.parse(await readFile(target,'utf8')));console.log('PASS: original users/auth/roles/permissions/sessions/products/customers/suppliers/inventory/VAT/audit and workbook match the pre-Stage-3 baseline exactly.');}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(closeDB);
