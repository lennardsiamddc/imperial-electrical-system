import {readFile,writeFile} from 'node:fs/promises';
import {query,closeDB} from '../lib/db';
import {quotationDocument} from '../lib/quotation-document';
import {quotationPDF} from '../lib/quotation-pdf';
import {stockBalances} from '../lib/inventory';
import type {Actor} from '../lib/permissions';
import type {Row} from '../lib/sales-common';
import assert from 'node:assert/strict';
async function main(){assert.equal(process.cwd(),'/private/tmp/imperial-stage55-app');assert(!process.env.DATABASE_URL);const a=JSON.parse(await readFile('test-results/stage55/acceptance.json','utf8'));const actor=(await query<Actor>('SELECT id,name,email,roles FROM users WHERE id=$1',[a.owner])).rows[0];const id='0173dbde-e174-4e67-9c1f-041ce63cf30d';const doc=await quotationDocument(actor,id);assert.equal(doc.total,'4737.14');assert.equal(doc.address,'TEST Project delivery site, Quezon City');assert.equal((await query<Row>("SELECT count(*)::int n FROM commercial_documents WHERE kind='Q' AND notes LIKE 'TEST browser acceptance%' AND copied_from_id IS NULL")).rows[0].n,1);assert.equal((await query<Row>('SELECT billing_address FROM customers WHERE id=$1',[a.customer])).rows[0].billing_address,'TEST 125 Industrial Avenue, Quezon City');assert.equal((await query<Row>("SELECT count(*)::int n FROM commercial_documents WHERE kind='SO' AND source_id='9257bfc8-4cbb-47cd-a7e9-03d3bac25f5d'")).rows[0].n,1);const stock=await stockBalances(actor,{});for(const p of a.products)assert.equal(stock.find(r=>r.id===p.id||r.product_id===p.id)?.available,p.uom==='ROLL'?'10000.000000':p.uom==='BOX'?'1000.000000':'100.000000');
 for(const [qid,name] of [[id,'browser'],[a.quotation,'acceptance'],[a.longQuotation,'multipage']])await writeFile('output/pdf/Imperial_Quotation_'+name+'.pdf',await quotationPDF(await quotationDocument(actor,qid)));
 await writeFile('test-results/stage55/browser-snapshot.json',JSON.stringify({id,document:doc,stock},null,2));await closeDB();const after=await quotationDocument(actor,id);assert.deepEqual(after,doc);console.log('PASS: browser Draft saved once, totals exact, contact master unchanged, stock unchanged and database reopen preserved document.');}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(closeDB);
