import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AppRouterContext} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import DocumentWorkspace from '../components/document-workspace';
import {documentDate,documentTimestamp} from '../lib/document-date';
import {dueDate} from '../lib/sales-calculations';
import {migrate} from '../lib/migrations';
import {query,transaction,closeDB} from '../lib/db';
import {saveMaster} from '../lib/masters';
import {stamp,type Row} from '../lib/sales-common';
import {saveCommercial,actCommercial,createCommercialChild,assignCommercialNumber} from '../lib/commercial';
import {getCommercial,listCommercial} from '../lib/commercial-read';
import {postMovement,stockBalances} from '../lib/inventory';
import {vatReferenceSummary} from '../lib/vat-reference';
import type {Actor} from '../lib/permissions';

test('Document dates use Manila through early mornings, month/year and leap-day boundaries',()=>{
 for(const [instant,day] of [
  ['2025-12-31T15:59:59Z','2025-12-31'],
  ['2025-12-31T16:00:00Z','2026-01-01'],
  ['2026-01-01T00:00:00Z','2026-01-01'],
  ['2026-01-31T16:00:00Z','2026-02-01'],
  ['2024-02-28T16:00:00Z','2024-02-29'],
  ['2024-02-29T16:00:00Z','2024-03-01'],
 ]) assert.equal(documentDate(instant),day);
 for(const day of ['2026-01-01','2026-02-01','2024-02-29','2024-03-01']){
  let stored=documentTimestamp(day);
  for(let edit=0;edit<3;edit++){
   assert.equal(documentDate(stored),day);
   stored=documentTimestamp(documentDate(stored),stored);
  }
  assert.equal(stored,new Date(day+'T00:00:00+08:00').toISOString());
 }
 const original='2026-01-01T06:25:30.123Z';
 assert.equal(documentTimestamp('2026-01-01',original),original);
 assert.equal(documentTimestamp('2026-01-02',original),'2026-01-01T16:00:00.000Z');
 for(const invalid of ['', '2026-02-29','2026-04-31','2026-13-01'])assert.throws(()=>documentTimestamp(invalid),/valid document date/);
 assert.equal(dueDate(documentTimestamp('2025-12-31'),'30 Days'),'2026-01-30');
 assert.equal(dueDate(documentTimestamp('2024-02-29'),'7 Days'),'2024-03-07');
 assert.equal(dueDate(documentTimestamp('2026-01-01'),'Custom','2026-03-15'),'2026-03-15');
});

test('Actual DR/SI draft date inputs render the Manila issue date',()=>{
 for(const kind of ['DR','SI'] as const){
  const html=renderToStaticMarkup(createElement(AppRouterContext.Provider,{value:{} as any},
   createElement(DocumentWorkspace,{kind,sources:[],preparation:kind==='SI'?'Handwritten':'Computer',
    initial:{id:randomUUID(),occurred_at:'2025-12-31T16:00:00Z',lines:[]}})));
  assert.match(html,/<input[^>]*type="date"[^>]*value="2026-01-01"/);
 }
});

let directory='';
after(async()=>{await closeDB();if(directory)await rm(directory,{recursive:true,force:true});});
test('Isolated DR/SI edits retain issue dates, register membership, AR terms and VAT periods',async()=>{
 delete process.env.DATABASE_URL;
 directory=await mkdtemp(join(tmpdir(),'imperial-stage6-dates-'));
 process.env.LOCAL_DB_PATH=directory;
 await migrate(); // Only the new disposable fixture database.
 const owner:Actor={id:randomUUID(),name:'TEST Date Owner',email:'date-owner@example.test',roles:['PRESIDENT_ADMIN']};
 await transaction(async db=>{await stamp(db,owner);await db.query('INSERT INTO users(id,name,email,password_hash,roles) VALUES($1,$2,$3,$4,$5)',[owner.id,owner.name,owner.email,'TEST unusable credential',owner.roles]);});
 const pid=await saveMaster(owner,'products',{sku:'TEST-DATE',name:'TEST Date Product',brand:'TEST',category:'TEST',primary_uom:'PCS',secondary_uom:'',conversion:'',base_price:'100',supplier_adjustment:'0',standard_cost:'100',vat_status:'VAT',vat_rate:'0.12',retail_price:'112',contractor_price:'112',wholesale_price:'112',meter_price:'0',reorder_level:'0',supplier_id:'',notes:'Disposable fixture only',active:true});
 await postMovement(owner,{request_id:randomUUID(),product_id:pid,kind:'IN',occurred_at:'2023-01-01T00:00:00Z',quantity:'20',uom:'PCS',unit_cost:'100',reference:'TEST DATE STOCK',cost_entry_mode:'VAT Exclusive'});
 const action=async(id:string,action:string)=>actCommercial(owner,{id,version:(await getCommercial(owner,id)).version,request_id:randomUUID(),action});
 const dateText=(value:Date|string)=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
 let releases=0;
 for(const [day,terms,expectedDue,custom] of [
  ['2026-01-01','30 Days','2026-01-31',''],
  ['2024-03-01','7 Days','2024-03-08',''],
  ['2024-02-29','Custom','2024-04-15','2024-04-15'],
 ]){
  const so=await saveCommercial(owner,{kind:'SO',request_id:randomUUID(),channel:'Retail',occurred_at:'2023-01-01T00:00:00Z',terms,custom_terms:custom?'Agreed date':'',custom_due_date:custom,vat_reference_mode:'Included',lines:[{id:randomUUID(),product_id:pid,quantity:'1',uom:'PCS',price:'112',vat_mode:'VAT Exclusive',tax_treatment:'VATable',discount:'0'}]});
  await action(so,'confirm');
  const order=await getCommercial(owner,so);
  for(const kind of ['SI','DR'] as const){
   const input={order_id:so,kind,preparation_mode:kind==='SI'?'Handwritten':'Computer',occurred_at:documentTimestamp(day),lines:[{source_line_id:order.lines[0].id,quantity:'1'}]};
   const id=await createCommercialChild(owner,{...input,request_id:randomUUID()});
   for(let edit=0;edit<2;edit++){
    const saved=await getCommercial(owner,id);
    assert.equal(documentDate(saved.occurred_at),day);
    await createCommercialChild(owner,{...input,id,version:saved.version,request_id:randomUUID(),occurred_at:documentTimestamp(documentDate(saved.occurred_at),saved.occurred_at),notes:'TEST unrelated edit '+edit});
   }
   const matches=await listCommercial(owner,{kind,from:day,to:day});
   assert(matches.some(r=>r.id===id),'Manila midnight must belong to its visible register day');
   const previous=new Date(new Date(day+'T00:00:00Z').getTime()-86400000).toISOString().slice(0,10);
   assert(!(await listCommercial(owner,{kind,from:previous,to:previous})).some(r=>r.id===id));
   const series=(await query<Row>('SELECT id FROM sales_options WHERE kind=$1 LIMIT 1',[kind==='SI'?'si_series':'dr_series'])).rows[0].id;
   await assignCommercialNumber(owner,{id,version:(await getCommercial(owner,id)).version,request_id:randomUUID(),series_id:series,number:'TEST-DATE-'+kind+'-'+day});
   await action(id,'finalize');
   if(kind==='SI'){
    const ar=(await query<Row>('SELECT * FROM receivables WHERE invoice_id=$1',[id])).rows;
    assert.equal(ar.length,1);assert.equal(dateText(ar[0].invoice_date),day);assert.equal(dateText(ar[0].due_date),expectedDue);assert.equal(ar[0].original_amount,'112.00');
    const vat=await vatReferenceSummary(owner,day,day);
    assert.equal(vat.output,'12.00');assert.equal(vat.rows.filter(r=>r.source_id===id).length,1);
    assert.equal((await vatReferenceSummary(owner,previous,previous)).output,'0.00');
   }else releases++;
   assert.equal(Number((await stockBalances(owner,{product:pid}))[0].available),20-releases);
  }
 }
 assert.equal((await query<Row>('SELECT count(*)::int n FROM receivables')).rows[0].n,3);
 assert.equal((await query<Row>('SELECT count(*)::int n FROM vat_reference_events')).rows[0].n,3);
});
