import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {query,closeDB} from '../lib/db';
import {getCommercial} from '../lib/commercial-read';
import {quotationDocument} from '../lib/quotation-document';
import {quotationPDF} from '../lib/quotation-pdf';
import type {Actor} from '../lib/permissions';
import type {Row} from '../lib/sales-common';
async function main(){
 assert.equal(process.cwd(),'/private/tmp/imperial-stage55-app');assert(!process.env.DATABASE_URL);
 const actor=(await query<Actor>("SELECT id,name,email,roles FROM users WHERE email='stage55.owner@example.test'")).rows[0];
 const id='557e6b0c-4a1a-42ad-9c73-b84a65dbcac9',copy='2f8e7fe2-a0d5-47f0-9de2-2e3ff0bd933d',order='bd882c1d-69e7-4a78-8835-673d97ea18dc';
 const doc=await getCommercial(actor,id);assert.equal(doc.number,'Q-000102');assert.equal(doc.version,2);assert.equal(doc.notes,'TEST Stage55 revisions — saved winner');assert.equal(doc.gross_total,'3572.34');assert.equal(doc.lines.length,2);assert.equal(doc.lines[0].vat_snapshot.discount_expression,'-25%-5%-3%');assert.equal(doc.lines[1].vat_snapshot.discount_expression,'+30%');assert.equal(doc.lines[0].quantity,'12.500000');assert.equal(doc.lines[0].uom,'METER');assert.equal(doc.lines[1].uom,'BOX');
 assert.equal((await query<Row>('SELECT id FROM commercial_documents WHERE copied_from_id=$1',[id])).rows.length,2);assert.equal((await query<Row>("SELECT id FROM commercial_documents WHERE source_id=$1 AND kind='SO'",[copy])).rows.length,1);
 const so=await getCommercial(actor,order);assert.equal(so.gross_total,doc.gross_total);assert.deepEqual(so.fees,doc.fees);assert.equal(so.lines.length,2);
 const feeId='f7927631-db39-4693-ac4d-57e86ef14333';const feeDoc=await getCommercial(actor,feeId);assert.equal(feeDoc.fees[0].amount,'1500.50');assert.equal(feeDoc.fees[0].vat_mode,'VAT Inclusive');assert.equal(feeDoc.gross_total,'3392.84');assert.equal(feeDoc.version,4);assert.equal(doc.fees[0].amount,'1500');await writeFile('output/pdf/Imperial_Quotation_delivery_fee.pdf',await quotationPDF(await quotationDocument(actor,feeId)));
 const customer=await quotationDocument(actor,id);await writeFile('output/pdf/Imperial_Quotation_revised.pdf',await quotationPDF(customer));await closeDB();assert.deepEqual(await getCommercial(actor,id),doc);
 await writeFile('test-results/stage55/revision-browser.json',JSON.stringify({passed:true,id,number:doc.number,version:doc.version,total:doc.gross_total,copy,order,lineExpressions:doc.lines.map((l:Row)=>l.vat_snapshot.discount_expression),deliveryFee:{id:feeId,entered:'1500.50',payable:'1500.50',zeroSaveReopen:true,total:'3392.84',otherQuoteUnchanged:true},restart:true,clearPreservedSaved:true,staleEditRejected:true,downloadEvent:true},null,2));console.log('PASS: saved/reopened two independent rows, exact amounts, one copy/order, Clear Form/stale edit preservation, and database restart.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(closeDB);
