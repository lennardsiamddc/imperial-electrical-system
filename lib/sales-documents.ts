import {z} from 'zod';
import {transaction,type DB} from './db';
import {freshActor} from './masters';
import {need,stamp,option,type Row} from './sales-common';
import type {Actor} from './permissions';
export async function setDocumentRequirements(db:DB,actor:Actor,sale:string,required:{si:boolean;dr:boolean}){
 for(const kind of ['SI','DR'] as const){const rows=(await db.query<Row>('SELECT * FROM sale_documents WHERE sale_id=$1 AND kind=$2 FOR UPDATE',[sale,kind])).rows;
 const enabled=required[kind.toLowerCase() as 'si'|'dr'];const current=rows.find(r=>r.status!=='Cancelled / Void');
 if(!enabled&&rows.some(r=>r.number&&r.status!=='Cancelled / Void'))throw new Error('Void the assigned '+kind+' before removing its requirement.');
 if(!current)await db.query('INSERT INTO sale_documents(sale_id,kind,status) VALUES($1,$2,$3)',[sale,kind,enabled?'Required / Pending':'Not Required']);
 else if(!current.number)await db.query('UPDATE sale_documents SET status=$1,updated_at=now() WHERE id=$2 AND status<>$1',[enabled?'Required / Pending':'Not Required',current.id]);
 }
}
export async function changeSaleDocument(actor:Actor,input:unknown){const d=z.object({sale_id:z.uuid(),document_id:z.uuid().optional(),kind:z.enum(['SI','DR']),action:z.enum(['assign','printed','void','require']),series_id:z.uuid().optional(),number:z.string().trim().min(1).max(80).optional(),reason:z.string().trim().max(500).default('')}).strict().parse(input);
 return transaction(async db=>{actor=await freshActor(db,actor.id);need(actor,d.action==='require'?'sales.documents.require':d.action==='void'?'sales.documents.void':d.kind==='SI'?(d.action==='assign'?'sales.si.assign':'sales.si.print'):(d.action==='assign'?'sales.dr.assign':'sales.dr.print'));
 const sale=(await db.query<Row>('SELECT * FROM sales WHERE id=$1 FOR UPDATE',[d.sale_id])).rows[0];if(!sale)throw new Error('Sale not found.');
 const commercialReady=(await db.query("SELECT to_regclass('imperial.commercial_documents') AS t")).rows[0].t;
 if(commercialReady&&(await db.query('SELECT id FROM commercial_documents WHERE sale_id=$1',[sale.id])).rows.length)throw new Error('Manage SI/DR through the linked Sales Order workflow. This goods-release Sale cannot create separate documents.');
if(sale.customer_id)need(actor,'customers.read');if(sale.status==='Cancelled'||(await db.query('SELECT id FROM sale_reversals WHERE sale_id=$1',[sale.id])).rows.length)throw new Error('This sale is cancelled or reversed.');await stamp(db,actor);
 const docs=(await db.query<Row>('SELECT * FROM sale_documents WHERE sale_id=$1 AND kind=$2 ORDER BY created_at FOR UPDATE',[sale.id,d.kind])).rows;
 if(d.action==='require'){
  const current=docs.find(r=>r.status!=='Cancelled / Void');
  if(current){if(current.status==='Not Required')await db.query("UPDATE sale_documents SET status='Required / Pending',updated_at=now() WHERE id=$1",[current.id]);return current.id;}
  return (await db.query<Row>("INSERT INTO sale_documents(sale_id,kind,status,replaces_id) VALUES($1,$2,'Required / Pending',$3) RETURNING id",[sale.id,d.kind,docs.findLast(r=>r.status==='Cancelled / Void')?.id||null])).rows[0].id;
 }
 let doc=d.document_id?docs.find(r=>r.id===d.document_id):docs.find(r=>r.status==='Required / Pending');
 if(d.action==='assign'){
  if(!d.series_id||!d.number)throw new Error('Enter the actual physical document number and select its series.');
  const series=await option(db,d.series_id,d.kind==='SI'?'si_series':'dr_series');
  const used=(await db.query<Row>('SELECT * FROM sale_documents WHERE series_id=$1 AND lower(btrim(number))=lower($2)',[d.series_id,d.number])).rows[0];
  if(used){if(used.sale_id===sale.id&&used.kind===d.kind&&used.status!=='Cancelled / Void')return used.id;throw new Error(`${d.kind==='SI'?'Sales Invoice':'Delivery Receipt'} ${d.number} has already been used in this series.`);}
  if(doc?.number)throw new Error('Void the existing document and assign a replacement.');
  if(!doc){const previous=docs.findLast(r=>r.status==='Cancelled / Void');if(!previous)throw new Error('Mark this document as required on the Draft first.');doc=(await db.query<Row>("INSERT INTO sale_documents(sale_id,kind,status,replaces_id) VALUES($1,$2,'Required / Pending',$3) RETURNING *",[sale.id,d.kind,previous.id])).rows[0];}
  if(doc.status==='Not Required')throw new Error('Mark this document as required on the Draft first.');
  await db.query("UPDATE sale_documents SET status='Assigned',series_id=$1,series_snapshot=$2,number=$3,assigned_by=$4,assigned_at=now(),updated_at=now() WHERE id=$5",[series.id,JSON.stringify(series),d.number,actor.id,doc.id]);
  if(sale.status==='Posted')await db.query('INSERT INTO sale_document_lines(document_id,sale_line_id,quantity) SELECT $1,id,quantity FROM sale_lines WHERE sale_id=$2 AND active ON CONFLICT(document_id,sale_line_id) DO NOTHING',[doc.id,sale.id]);
  return doc.id;
 }
 if(!doc)throw new Error('Choose the document to update.');
 if(d.action==='printed'){
  if(sale.status!=='Posted'||!doc.number||doc.status==='Cancelled / Void')throw new Error('Only an assigned document on a posted sale can be marked printed.');
  if(doc.status==='Printed')return doc.id;
  await db.query("UPDATE sale_documents SET status='Printed',updated_at=now(),reason=$1 WHERE id=$2",[d.reason||'Physical document marked printed',doc.id]);
 }else{
  if(d.reason.length<3)throw new Error('Enter a reason for voiding this document.');if(doc.status==='Cancelled / Void')return doc.id;
  await db.query("UPDATE sale_documents SET status='Cancelled / Void',reason=$1,updated_at=now() WHERE id=$2",[d.reason,doc.id]);
 }
 return doc.id;
 });
}
