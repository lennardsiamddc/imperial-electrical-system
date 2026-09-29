import {taxSnapshot,taxTreatments,entryModes,Money} from './vat';
import {recordVatReference,referenceDate} from './vat-reference';
import {z} from 'zod';
import {transaction,type DB} from './db';
import {freshActor} from './masters';
import {allows,assertAllowed,type Actor} from './permissions';
const D=Money;
const decimal=z.string().regex(/^\d{1,12}(\.\d{1,6})?$/,'Use a non-negative number with at most six decimals.');
const inputSchema=z.object({request_id:z.uuid(),product_id:z.uuid(),kind:z.enum(['IN','OUT']),occurred_at:z.iso.datetime({offset:true}),quantity:decimal,uom:z.enum(['PCS','BOX','ROLL','METER']),unit_cost:decimal.optional(),supplier_id:z.union([z.literal(''),z.uuid()]).optional(),reference:z.string().trim().min(1).max(100),notes:z.string().trim().max(1000).default(''),cost_tax_treatment:z.enum(taxTreatments).optional(),cost_entry_mode:z.enum(entryModes).optional(),cost_input_vat_recoverable:z.boolean().optional(),tax_config_version:z.number().int().positive().optional()}).strict();
// Immutable postings serialize on the stable product row. Never persist a mutable quantity on products.
export async function postMovement(actor:Actor,input:unknown){
 return transaction(db=>postMovementInTransaction(actor,input,db));
}
// Future documents can post their stock movement inside the same database transaction.
export async function postMovementInTransaction(actor:Actor,input:unknown,db:DB){
 const data=inputSchema.parse(input);
  actor=await freshActor(db,actor.id);assertAllowed(allows(actor,data.kind==='IN'?'inventory.receive':'inventory.issue'));
  if(data.kind==='IN'&&data.unit_cost===undefined)throw new Error('Acquisition cost is required.');
  if(data.kind==='OUT'&&(data.unit_cost!==undefined||data.supplier_id||data.cost_tax_treatment!==undefined||data.cost_entry_mode!==undefined||data.cost_input_vat_recoverable!==undefined))throw new Error('Issue cost is calculated by the server.');
  const product=(await db.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[data.product_id])).rows[0];
  if(!product||!product.active)throw new Error('Choose an active product.');
  const existing=(await db.query('SELECT * FROM inventory_movements WHERE request_id=$1',[data.request_id])).rows[0];
  if(existing){
   const same=existing.actor_id===actor.id&&existing.product_id===data.product_id&&existing.kind===data.kind&&new D(String(existing.quantity)).eq(data.quantity)&&existing.uom===data.uom&&new Date(String(existing.occurred_at)).getTime()===new Date(data.occurred_at).getTime()&&existing.reference===data.reference&&existing.notes===data.notes&&(existing.supplier_id||'')===(data.supplier_id||'')&&(data.kind==='OUT'||new D(String(existing.unit_cost)).eq(data.unit_cost!));
   const tax=existing.cost_vat as {treatment:string;mode:string;recoverable:boolean;configuration_version:number}|null;
   const sameTax=data.kind==='OUT'||tax?.mode===(data.cost_entry_mode||product.cost_entry_mode||'VAT Exclusive');
   if(!same||!sameTax)throw new Error('This submission ID was already used for different details.');
   return String(existing.id);
  }
  if(new Date(data.occurred_at).getTime()>Date.now()+60000)throw new Error('Stock date cannot be in the future.');
  const qty=new D(data.quantity);if(qty.lte(0))throw new Error('Quantity must be greater than zero.');
  if(data.uom!=='METER'&&!qty.isInteger())throw new Error('PCS, BOX and ROLL require whole quantities; use METER for cut lengths.');
  if(data.uom!==product.primary_uom&&data.uom!==product.secondary_uom)throw new Error('This UOM is not configured for the product.');
  const factor=new D(String(product.conversion||1));
  const stockQty=qty.mul(data.uom===product.primary_uom?factor:1);
  if((product.secondary_uom||product.primary_uom)!=='METER'&&!stockQty.isInteger())throw new Error('Conversion must produce whole PCS, BOX or ROLL stock units.');
  if(stockQty.decimalPlaces()>6||stockQty.gte('1e24'))throw new Error('Converted quantity exceeds supported precision.');
  let costVat:ReturnType<typeof taxSnapshot>|null=null;
  if(data.kind==='IN'){
   const mode=data.cost_entry_mode||(product.cost_entry_mode as 'VAT Inclusive'|'VAT Exclusive')||'VAT Exclusive';
   const amount=new D(data.unit_cost!),lineAmount=amount.mul(qty);const unit={entered:amount.toFixed(6),net:amount.toFixed(6),vat:'0.000000',gross:amount.toFixed(6),rate:'0.000000',configured_rate:'0.000000',treatment:'VATable' as const,mode};
   costVat={...unit,recoverable:false,recoverable_vat:'0.000000',economic_cost:amount.toFixed(6),line:{...unit,entered:lineAmount.toFixed(6),net:lineAmount.toFixed(6),vat:'0.00',gross:lineAmount.toFixed(6),recoverable_vat:'0.00',economic_cost:lineAmount.toFixed(6)},quantity:data.quantity,rounding:'ENTERED_AMOUNTS_NO_VAT_V1',configuration_version:1,configuration_effective_at:'2026-01-01T00:00:00.000Z'};
  }
  const totals=(await db.query("SELECT COALESCE(sum(CASE WHEN kind='IN' THEN stock_quantity ELSE -stock_quantity END),0)::text AS quantity,COALESCE(sum(CASE WHEN kind='IN' THEN total_cost ELSE -total_cost END),0)::text AS value FROM inventory_movements WHERE product_id=$1",[data.product_id])).rows[0];
  const available=new D(String(totals.quantity));let total:DDecimal;
  let unitCost=data.unit_cost||'0';
  if(data.kind==='OUT'){
   if(stockQty.gt(available))throw new Error('Insufficient available stock.');
   total=stockQty.eq(available)?new D(String(totals.value)):new D(String(totals.value)).mul(stockQty).div(available).toDecimalPlaces(6);
   unitCost=total.div(qty).toFixed(6);
  }else total=costVat?new D(costVat.line.economic_cost):qty.mul(unitCost).toDecimalPlaces(6);
  let supplierName=null;
  if(data.supplier_id){const supplier=(await db.query('SELECT name FROM suppliers WHERE id=$1 AND active FOR SHARE',[data.supplier_id])).rows[0];if(!supplier)throw new Error('Choose an active supplier.');supplierName=supplier.name;}
  await db.query("SELECT set_config('imperial.actor_id',$1,true)",[actor.id]);
  const row=(await db.query(`INSERT INTO inventory_movements(request_id,product_id,kind,occurred_at,quantity,uom,stock_quantity,stock_uom,conversion,unit_cost,total_cost,supplier_id,supplier_name,reference,notes,product_name,sku,actor_id,actor_name,cost_vat)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,[data.request_id,data.product_id,data.kind,data.occurred_at,data.quantity,data.uom,stockQty.toFixed(6),product.secondary_uom||product.primary_uom,factor.toFixed(6),unitCost,total.toFixed(6),data.supplier_id||null,supplierName,data.reference,data.notes,product.name,product.sku,actor.id,actor.name,costVat?JSON.stringify(costVat):null])).rows[0];
  if(data.kind==='IN')await recordVatReference(db,actor,{direction:'Input',kind:'stock-in',id:String(row.id),number:data.reference,date:referenceDate(data.occurred_at),amount:total.toFixed(6),included:costVat?.mode==='VAT Inclusive'});
  return String(row.id);
}
type DDecimal=InstanceType<typeof D>;
export type InventoryFilter={q?:string;low?:string;status?:string;product?:string;page?:number};
const offset=(page=1)=>(Math.max(1,Math.min(100000,Number.isFinite(page)?Math.floor(page):1))-1)*50;
export async function stockBalances(actor:Actor,filter:InventoryFilter={}){
 if(filter.product)z.uuid().parse(filter.product);
 return transaction(async db=>{
  actor=await freshActor(db,actor.id);assertAllowed(allows(actor,'inventory.read'));
  const value=allows(actor,'inventory.value');
  return (await db.query(`WITH balances AS (
   SELECT product_id,sum(CASE WHEN kind='IN' THEN stock_quantity ELSE -stock_quantity END) AS available,
   sum(CASE WHEN kind='IN' THEN stock_quantity ELSE 0 END) AS stock_in,
   sum(CASE WHEN kind='OUT' THEN stock_quantity ELSE 0 END) AS stock_out
   ${value?",sum(CASE WHEN kind='IN' THEN total_cost ELSE -total_cost END) AS inventory_value":''}
   FROM inventory_movements GROUP BY product_id)
   SELECT p.id,p.name,p.sku,p.brand,p.category,p.active,p.primary_uom,p.secondary_uom,p.conversion,p.reorder_level,
   COALESCE(p.secondary_uom,p.primary_uom) AS stock_uom,
   COALESCE(b.available,0)::text AS available,COALESCE(b.stock_in,0)::text AS stock_in,COALESCE(b.stock_out,0)::text AS stock_out,
   (COALESCE(b.available,0)<=p.reorder_level*COALESCE(p.conversion,1)) AS low_stock
   ${value?',COALESCE(b.inventory_value,0)::text AS inventory_value':''}
   FROM products p LEFT JOIN balances b ON b.product_id=p.id
   WHERE (p.name ILIKE $1 OR p.sku ILIKE $1 OR p.brand ILIKE $1 OR p.category ILIKE $1)
   AND ($2='' OR p.id::text=$2) AND ($3='' OR p.active::text=$3)
   AND ($4<>'true' OR (p.active AND COALESCE(b.available,0)<=p.reorder_level*COALESCE(p.conversion,1)))
   ORDER BY p.name,p.id LIMIT 51 OFFSET $5`,[`%${(filter.q||'').slice(0,100)}%`,filter.product||'',['true','false'].includes(filter.status||'')?filter.status:'',filter.low||'',offset(filter.page)])).rows;
 });
}
export async function movementHistory(actor:Actor,filter:InventoryFilter={}){
 if(filter.product)z.uuid().parse(filter.product);
 return transaction(async db=>{
  actor=await freshActor(db,actor.id);assertAllowed(allows(actor,'inventory.read'));
  const value=allows(actor,'inventory.value');
  return (await db.query(`SELECT id,product_id,product_name,sku,kind,occurred_at,created_at,quantity,uom,stock_quantity,stock_uom,conversion,reference,notes,actor_id,actor_name
   ${value?',unit_cost,total_cost,supplier_id,supplier_name,cost_vat':''}
   FROM inventory_movements WHERE ($1='' OR product_id::text=$1)
   AND (product_name ILIKE $2 OR sku ILIKE $2 OR reference ILIKE $2)
   ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET $3`,[filter.product||'',`%${(filter.q||'').slice(0,100)}%`,offset(filter.page)])).rows;
 });
}
