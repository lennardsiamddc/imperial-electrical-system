import {operationalConfig} from './operational-pricing';
import {z} from 'zod';
import {transaction,type DB} from './db';
import {freshActor} from './masters';
import {allows,type Actor} from './permissions';
import {need,type Row} from './sales-common';
import {saleProductDefaults} from './sales';
function headerColumns(actor:Actor){return 's.vat_reference_mode,s.price_list,s.document_flow,s.id,s.number,s.status,s.version,s.channel,s.occurred_at,s.customer_id,s.customer_snapshot,s.platform_snapshot,s.online_reference,s.reference,s.salesperson_snapshot,s.notes,s.line_count,s.quantities,s.actor_name,s.created_at,s.posted_at'+
 (allows(actor,'sales.prices')?',s.subtotal,s.entered_total,s.net_total,s.vat_total,s.gross_total,s.tax_config':'')+
 (allows(actor,'sales.discounts')?',s.discount_total':'')+(allows(actor,'sales.payments')?',s.payment_status,s.payment_intent,s.terms,s.custom_terms,s.due_date':'')+
 (allows(actor,'sales.cogs')?',s.cogs':'')+(allows(actor,'sales.profit')?',s.profit':'')+(allows(actor,'sales.margin')?',s.gross_margin':'');}
const activity=`CASE WHEN EXISTS(SELECT 1 FROM sale_reversals rev WHERE rev.sale_id=s.id) THEN 'Cancelled / Reversed'
 WHEN s.status='Cancelled' THEN 'Cancelled'
 WHEN s.status='Posted' AND NOT EXISTS(SELECT 1 FROM sale_lines l WHERE l.sale_id=s.id AND l.active AND l.quantity>COALESCE((SELECT sum(r.quantity) FROM sale_return_lines r WHERE r.sale_line_id=l.id AND r.accepted),0)) THEN 'Fully Returned'
 WHEN EXISTS(SELECT 1 FROM sale_returns r JOIN sale_return_lines rl ON rl.return_id=r.id WHERE r.sale_id=s.id AND rl.accepted) THEN 'Partially Returned'
 WHEN EXISTS(SELECT 1 FROM sale_returns r WHERE r.sale_id=s.id AND r.status NOT IN ('Rejected','Cancelled','Completed')) THEN 'Return Pending'
 WHEN s.status='Posted' THEN 'Completed' ELSE s.status END`;
export async function getSale(actor:Actor,id:string){z.uuid().parse(id);return transaction(async db=>{
 actor=await freshActor(db,actor.id);need(actor,'sales.read');
 const row=(await db.query<Row>(`SELECT ${headerColumns(actor)},${activity} AS activity FROM sales s WHERE s.id=$1`,[id])).rows[0];
 if(!row)throw new Error('Sale not found.');if(row.customer_id)need(actor,'customers.read');
 const cols='l.id,l.position,l.product_id,l.product_name,l.sku,l.brand,l.category,l.quantity,l.uom,l.stock_quantity,l.stock_uom,l.conversion,l.movement_id'+
 (allows(actor,'sales.prices')?',l.entered_price,l.vat_mode,l.tax_treatment,l.subtotal,l.entered_amount,l.net_amount,l.vat_amount,l.gross_amount':'')+
 (allows(actor,'sales.discounts')?',l.discount_percent,l.discount_rules,l.discount_amount':'')+(allows(actor,'sales.cogs')?',l.cogs,l.cost_snapshot':'')+(allows(actor,'sales.profit')?',l.profit':'');
 row.lines=(await db.query<Row>(`SELECT ${cols},COALESCE((SELECT sum(r.quantity) FROM sale_return_lines r WHERE r.sale_line_id=l.id AND r.accepted),0)::text AS returned_quantity FROM sale_lines l WHERE l.sale_id=$1 AND l.active ORDER BY l.position`,[id])).rows;
 if(allows(actor,'sales.prices')){
  const snapshots=(await db.query<Row>('SELECT id,vat_snapshot FROM sale_lines WHERE sale_id=$1 AND active',[id])).rows;
  for(const line of row.lines){const snapshot={...snapshots.find(s=>s.id===line.id)!.vat_snapshot};if(!allows(actor,'sales.discounts')){delete snapshot.discount_percent;delete snapshot.discount_rules;}line.vat_snapshot=snapshot;}
 }
 if(allows(actor,'sales.documents'))row.documents=(await db.query('SELECT id,kind,status,series_snapshot,number,reason,assigned_at,template_id,template_version FROM sale_documents WHERE sale_id=$1 ORDER BY kind,created_at',[id])).rows;
 if(allows(actor,'sales.payments'))row.payments=(await db.query('SELECT id,method_snapshot,amount,received_at,account_snapshot,reference,check_bank,check_number,check_date,actor_name FROM sale_payments WHERE sale_id=$1 ORDER BY received_at,id',[id])).rows;
 if(allows(actor,'returns.read'))row.returns=(await db.query('SELECT id,number,kind,status,requested_at,received_at,reason FROM sale_returns WHERE sale_id=$1 ORDER BY created_at DESC',[id])).rows;
 return row;
});}
export type SalesFilter={q?:string;channel?:string;platform?:string;status?:string;payment_status?:string;method?:string;terms?:string;agent?:string;agent_name?:string;from?:string;to?:string;customer?:string;page?:number};
export async function listSales(actor:Actor,f:SalesFilter={}){return transaction(async db=>{
 actor=await freshActor(db,actor.id);need(actor,'sales.read');
 if(f.payment_status||f.method||f.terms)need(actor,'sales.payments');
 const params:unknown[]=['%'+(f.q||'').slice(0,160)+'%',allows(actor,'customers.read')];
 let where=`($2 OR s.customer_id IS NULL) AND (s.number ILIKE $1 OR s.customer_snapshot->>'name' ILIKE $1 OR s.customer_snapshot->>'code' ILIKE $1 OR s.online_reference ILIKE $1 OR s.salesperson_snapshot->>'name' ILIKE $1 OR EXISTS(SELECT 1 FROM sale_lines l WHERE l.sale_id=s.id AND l.active AND (l.product_name ILIKE $1 OR l.sku ILIKE $1 OR l.brand ILIKE $1))${allows(actor,'sales.documents')?" OR EXISTS(SELECT 1 FROM sale_documents d WHERE d.sale_id=s.id AND d.number ILIKE $1)":''})`;
 for(const [field,column] of [['channel','channel'],['platform','platform_id::text'],['status','status'],['payment_status','payment_status'],['method',"payment_intent->>'method_id'"],['terms','terms'],['agent','salesperson_id::text'],['customer','customer_id::text']] as const){if(f[field]){params.push(f[field]);where+=` AND s.${column}=$${params.length}`;}}
 if(f.agent_name){params.push('%'+f.agent_name.slice(0,160)+'%');where+=` AND s.salesperson_snapshot->>'name' ILIKE $${params.length}`;}
 for(const [field,operator] of [['from','>='],['to','<=']] as const){if(f[field]){z.iso.date().parse(f[field]);params.push(f[field]);where+=` AND (s.occurred_at AT TIME ZONE 'Asia/Manila')::date${operator}$${params.length}::date`;}}
 params.push((Math.max(1,Math.min(100000,Math.floor(Number.isFinite(f.page)?f.page!:1)))-1)*50);
 return (await db.query(`SELECT ${headerColumns(actor)},${activity} AS activity,
 (SELECT jsonb_agg(x) FROM (SELECT l.product_name,l.quantity,l.uom FROM sale_lines l WHERE l.sale_id=s.id AND l.active ORDER BY l.position LIMIT 3) x) AS products
 FROM sales s WHERE ${where} ORDER BY s.occurred_at DESC,s.id LIMIT 51 OFFSET $${params.length}`,params)).rows;
});}
export async function salesLookup(actor:Actor,kind:string,q=''){return transaction(async db=>{
 actor=await freshActor(db,actor.id);need(actor,'sales.read');const search='%'+q.slice(0,120)+'%';
 if(kind==='products'){
  need(actor,'products.read');need(actor,'sales.prices');
  const rows=(await db.query<Row>(`SELECT p.id,p.name,p.sku,p.brand,p.primary_uom,p.secondary_uom,p.conversion,p.retail_price,p.contractor_price,p.selling_prices,p.meter_price,p.selling_entry_mode,p.selling_tax_treatment,p.vat_status,
  COALESCE((SELECT sum(CASE WHEN m.kind='IN' THEN m.stock_quantity ELSE -m.stock_quantity END) FROM inventory_movements m WHERE m.product_id=p.id),0)::text AS available
  FROM products p WHERE p.active AND (p.name ILIKE $1 OR p.sku ILIKE $1 OR p.brand ILIKE $1) ORDER BY p.name,p.id LIMIT 20`,[search])).rows;
  return rows.map(p=>({...p,unit_defaults:[p.primary_uom,p.secondary_uom].filter(Boolean).map(uom=>({uom,...saleProductDefaults(p,uom),prices:{Retail:saleProductDefaults(p,uom,'Retail').price,Contractor:saleProductDefaults(p,uom,'Contractor').price}}))}));
 }
 if(kind==='customers'){need(actor,'customers.read');return (await db.query(`SELECT id,code,name,default_price_list,contact_person,phone,email,tin,billing_address,delivery_addresses${allows(actor,'customers.credit')?',payment_terms,salesperson_id':''} FROM customers WHERE active AND (name ILIKE $1 OR code ILIKE $1 OR contact_person ILIKE $1 OR tin ILIKE $1) ORDER BY name,id LIMIT 20`,[search])).rows;}
 if(kind==='agents')return (await db.query('SELECT id,name FROM users WHERE active AND name ILIKE $1 ORDER BY name,id LIMIT 20',[search])).rows;
 if(kind==='tax'){need(actor,'sales.prices');return operationalConfig;}
 throw new Error('Unknown lookup.');
});}
export async function saleDocumentData(actor:Actor,id:string){z.uuid().parse(id);
 // Freshly check the specific document permission, then use the same protected Sale projection.
 const doc=await transaction(async db=>{actor=await freshActor(db,actor.id);const d=(await db.query<Row>('SELECT id,sale_id,kind,status,number,series_snapshot FROM sale_documents WHERE id=$1',[id])).rows[0];if(!d)throw new Error('Document not found.');need(actor,d.kind==='SI'?'sales.si.print':'sales.dr.print');if(!d.number||d.status==='Cancelled / Void')throw new Error('Assign a valid physical document number first.');return d;});
 const sale=await getSale(actor,doc.sale_id);if(sale.status!=='Posted')throw new Error('Post the Sale before preparing document data.');
 return {document:doc,sale_number:sale.number,customer:sale.customer_snapshot,occurred_at:sale.occurred_at,lines:sale.lines.map((l:Row)=>({product_name:l.product_name,quantity:l.quantity,uom:l.uom,...(doc.kind==='SI'?{entered_price:l.entered_price,vat_mode:l.vat_mode,net_amount:l.net_amount,vat_amount:l.vat_amount,gross_amount:l.gross_amount}:{})})),...(doc.kind==='SI'?{net_total:sale.net_total,vat_total:sale.vat_total,gross_total:sale.gross_total}:{}),calibration_status:'Physical form measurements and print alignment verification required'};
}
