import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {query,closeDB} from '../lib/db';
import {saveMaster} from '../lib/masters';
import {saveCommercial} from '../lib/commercial';
import {getCommercial} from '../lib/commercial-read';
import {quotationDocument} from '../lib/quotation-document';
import {quotationRender} from '../lib/quotation-pdf';
import type {Actor} from '../lib/permissions';
async function main(){assert.equal(process.cwd(),'/private/tmp/imperial-stage55-app');assert(!process.env.DATABASE_URL);const owner=(await query<Actor>("SELECT id,name,email,roles FROM users WHERE email='stage55.owner@example.test'")).rows[0];
const description='TEST Heavy-duty stranded copper electrical conductor with flame-retardant insulation, 600V rated, for industrial distribution panels and underground conduit installations';assert(description.length>=150);
let pid=(await query<{id:string}>("SELECT id FROM products WHERE sku='TEST-Q55-LONG-DESCRIPTION'")).rows[0]?.id;
if(!pid)pid=await saveMaster(owner,'products',{sku:'TEST-Q55-LONG-DESCRIPTION',name:description,brand:'TEST',category:'Electrical',primary_uom:'ROLL',secondary_uom:'METER',conversion:'100',base_price:'1500',supplier_adjustment:'0',standard_cost:'100',vat_status:'VAT',vat_rate:'0.12',retail_price:'1500',contractor_price:'1500',wholesale_price:'1500',meter_price:'15',reorder_level:'1',supplier_id:'',notes:'TEST quotation wrapping',active:true,selling_entry_mode:'VAT Exclusive',selling_tax_treatment:'VATable',cost_entry_mode:'VAT Exclusive',cost_tax_treatment:'VATable',cost_input_vat_recoverable:false});
const source=await getCommercial(owner,'f7927631-db39-4693-ac4d-57e86ef14333');const contact='Engr. Reyes / 0917 555 0100 — call after 3pm';const lines=Array.from({length:45},(_,i)=>({id:randomUUID(),product_id:i%5===0?source.lines[0].product_id:pid,quantity:'12.5',uom:'METER',price:'15',discount:'-25-5-3',adjustment_version:2,vat_mode:'VAT Exclusive',tax_treatment:'VATable'}));
const id=await saveCommercial(owner,{request_id:randomUUID(),kind:'Q',channel:'Wholesale',customer_id:source.customer_id,occurred_at:new Date().toISOString(),terms:'30 Days',notes:'TEST long-description layout acceptance: normal rows and consecutive wrapped rows',tax_config_version:source.tax_config.version,customer_override:{billing_address:source.customer_snapshot.billing_address,contact_person:source.customer_snapshot.contact_person,phone:source.customer_snapshot.phone,email:source.customer_snapshot.email,quotation_contact:contact},lines,fees:source.fees.map((f:any)=>({id:randomUUID(),description:f.description,amount:f.amount,vat_mode:f.vat_mode,tax_treatment:f.tax_treatment}))});
await closeDB();const doc=await quotationDocument(owner,id);assert.equal(doc.contact,contact);assert.equal(doc.lines[1].description,description);const render=await quotationRender(doc);assert(render.pages.length>=3);for(let i=0;i<render.pages.length;i++)await writeFile('output/pdf/layout-page-'+(i+1)+'.svg',render.pages[i]);await writeFile('output/pdf/Imperial_Quotation_long_descriptions.pdf',render.bytes);await writeFile('test-results/stage55/layout-acceptance.json',JSON.stringify({id,number:doc.number,description,characters:description.length,contact,rows:45,pages:render.pages.length,saveReopen:true,originalDatabaseTouched:false},null,2));console.log({id,number:doc.number,characters:description.length,pages:render.pages.length});}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(closeDB);
