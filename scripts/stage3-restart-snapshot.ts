import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {query,closeDB} from '../lib/db';
const target='/private/tmp/imperial-stage3-restart-baseline.json';
async function main(){
 if(process.env.DATABASE_URL||!process.env.LOCAL_DB_PATH?.startsWith('/private/tmp/imperial-stage3-browser-'))throw new Error('Use the isolated browser verification database only, with its server stopped.');
 const result:Record<string,unknown>={};
 for(const table of ['users','sessions','customers','products','inventory_movements','tax_settings','audit_log','sales','sale_lines','sale_payments','sale_documents','sale_document_lines','sale_returns','sale_return_lines','sale_return_events','sales_options']){
  const rows=(await query(`SELECT to_jsonb(t)::text AS data FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
  result[table]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
 }
 if(process.argv.includes('--record')){await writeFile(target,JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});console.log('Restart baseline:',Object.fromEntries(Object.entries(result).map(([k,v])=>[k,(v as {count:number}).count])));}
 else{assert.deepEqual(result,JSON.parse(await readFile(target,'utf8')));console.log('PASS: browser-created Sales, lines, documents, VAT/COGS, payments, Returns, stock, audit, configuration and sessions persisted exactly across server restart.');}
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(closeDB);
