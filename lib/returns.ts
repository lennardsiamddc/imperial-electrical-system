import {offsetVatReference,referenceDate} from './vat-reference';
import {z} from 'zod';
import {transaction,type DB} from './db';
import {freshActor} from './masters';
import {allows,type Actor,type Permission} from './permissions';
import {need,stamp,digest,decimal,type Row} from './sales-common';
import {allocateReturn,returnConditions,returnStatuses} from './return-calculations';
import {Money} from './vat';
const createSchema=z.object({request_id:z.uuid(),sale_id:z.uuid(),kind:z.enum(['Return','Cancellation']).default('Return'),reason:z.string().trim().min(3).max(1000),requested_at:z.iso.datetime({offset:true}),platform_case_reference:z.string().trim().max(160).default(''),notes:z.string().trim().max(1000).default(''),lines:z.array(z.object({sale_line_id:z.uuid(),quantity:decimal}).strict()).min(1)}).strict();
async function lockedSale(db:DB,actor:Actor,id:string){
 const sale=(await db.query<Row>('SELECT * FROM sales WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(!sale||sale.status!=='Posted')throw new Error('Returns require a Posted Sale.');
 if(sale.customer_id)need(actor,'customers.read');
 return sale;
}
async function event(db:DB,actor:Actor,ret:string,request:string,hash:string,action:string,from:string|null,to:string,reason:string){
 await db.query('INSERT INTO sale_return_events(return_id,request_id,payload_hash,action,from_status,to_status,reason,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[ret,request,hash,action,from,to,reason,actor.id,actor.name]);
}
export async function createReturn(actor:Actor,input:unknown){
 const d=createSchema.parse(input),hash=digest(d);
 return transaction(async db=>{
  actor=await freshActor(db,actor.id);need(actor,'returns.create');
  const sale=await lockedSale(db,actor,d.sale_id);
  if(d.kind==='Cancellation')need(actor,'sales.cancel');
  const prior=(await db.query<Row>('SELECT id,actor_id,payload_hash FROM sale_returns WHERE request_id=$1',[d.request_id])).rows[0];
  if(prior){if(prior.actor_id!==actor.id||prior.payload_hash!==hash)throw new Error('This Return submission was already used for different details.');return String(prior.id);}
  if((await db.query('SELECT id FROM sale_reversals WHERE sale_id=$1',[sale.id])).rows.length)throw new Error('This Sale has already been reversed.');
  if(new Date(d.requested_at).getTime()>Date.now()+60000)throw new Error('Return request date cannot be in the future.');
  if(new Set(d.lines.map(l=>l.sale_line_id)).size!==d.lines.length)throw new Error('Combine quantities for the same Sale line.');
  const originals=(await db.query<Row>('SELECT id,quantity,uom,stock_quantity,stock_uom FROM sale_lines WHERE sale_id=$1 AND active',[sale.id])).rows;
  for(const line of d.lines){const original=originals.find(l=>l.id===line.sale_line_id);if(!original||new Money(line.quantity).lte(0)||new Money(line.quantity).gt(original.quantity)||(original.uom!=='METER'&&!new Money(line.quantity).isInteger()))throw new Error('Check the original Sale line and returned quantity.');const stockQty=new Money(original.stock_quantity).mul(line.quantity).div(original.quantity);if(stockQty.decimalPlaces()>6||(original.stock_uom!=='METER'&&!stockQty.isInteger()))throw new Error('Returned quantity must convert to valid stock units.');}
  if(d.kind==='Cancellation'){
   const remaining=(await db.query<Row>('SELECT l.id,l.quantity-COALESCE((SELECT sum(r.quantity) FROM sale_return_lines r WHERE r.sale_line_id=l.id AND r.accepted),0) AS remaining FROM sale_lines l WHERE l.sale_id=$1 AND l.active',[sale.id])).rows.filter(l=>new Money(l.remaining).gt(0));
   if(remaining.length!==d.lines.length||remaining.some(l=>!d.lines.some(v=>v.sale_line_id===l.id&&new Money(v.quantity).eq(l.remaining))))throw new Error('Cancellation must cover every remaining unreturned Sale quantity.');
  }
  const policy=sale.platform_id?(await db.query<Row>('SELECT version,window_days,starts_from,notes,effective_at FROM platform_return_policies WHERE platform_id=$1 AND effective_at<=$2 ORDER BY effective_at DESC,version DESC LIMIT 1',[sale.platform_id,d.requested_at])).rows[0]:null;
  await stamp(db,actor);
  const row=(await db.query<Row>('INSERT INTO sale_returns(request_id,payload_hash,sale_id,reason,requested_at,platform_snapshot,platform_order_reference,platform_case_reference,return_policy_snapshot,notes,actor_id,actor_name,kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id',[d.request_id,hash,sale.id,d.reason,d.requested_at,sale.platform_snapshot?JSON.stringify(sale.platform_snapshot):null,sale.online_reference,d.platform_case_reference,policy?JSON.stringify(policy):null,d.notes,actor.id,actor.name,d.kind])).rows[0];
  for(const line of d.lines)await db.query('INSERT INTO sale_return_lines(return_id,sale_line_id,quantity,uom) VALUES($1,$2,$3,$4)',[row.id,line.sale_line_id,line.quantity,originals.find(l=>l.id===line.sale_line_id)!.uom]);
  await event(db,actor,row.id,d.request_id,hash,'create',null,'Return Requested',d.reason);
  return String(row.id);
 });
}
const actions=['approve','transit','receive','inspect','restock','reject','complete','cancel'] as const;
const actionPermission:Record<typeof actions[number],Permission>={approve:'returns.approve',transit:'returns.receive',receive:'returns.receive',inspect:'returns.condition',restock:'returns.restock',reject:'returns.reject',complete:'returns.complete',cancel:'returns.reject'};
const sources:Record<typeof actions[number],string[]>={approve:['Return Requested'],transit:['Approved'],receive:['Approved','In Transit'],inspect:['Received','Inspected'],restock:['Inspected'],reject:['Return Requested','Approved','In Transit','Received','Inspected'],complete:['Inspected','Restocked'],cancel:['Return Requested','Approved','In Transit']};
const targets:Record<typeof actions[number],string>={approve:'Approved',transit:'In Transit',receive:'Received',inspect:'Inspected',restock:'Restocked',reject:'Rejected',complete:'Completed',cancel:'Cancelled'};
const actionSchema=z.object({request_id:z.uuid(),id:z.uuid(),version:z.number().int().positive(),action:z.enum(actions),reason:z.string().trim().max(1000).default(''),received_at:z.iso.datetime({offset:true}).optional(),conditions:z.array(z.object({line_id:z.uuid(),condition:z.enum(returnConditions),notes:z.string().trim().max(500).default('')}).strict()).optional()}).strict();
export async function changeReturn(actor:Actor,input:unknown){
 const d=actionSchema.parse(input),hash=digest(d);
 return transaction(async db=>{
  actor=await freshActor(db,actor.id);need(actor,actionPermission[d.action]);
  const identity=(await db.query<Row>('SELECT sale_id FROM sale_returns WHERE id=$1',[d.id])).rows[0];if(!identity)throw new Error('Return not found.');
  await lockedSale(db,actor,identity.sale_id);
  const ret=(await db.query<Row>('SELECT * FROM sale_returns WHERE id=$1 FOR UPDATE',[d.id])).rows[0];
  if(ret.kind==='Cancellation')need(actor,'sales.cancel');
  const replay=(await db.query<Row>('SELECT * FROM sale_return_events WHERE request_id=$1',[d.request_id])).rows[0];
  if(replay){if(replay.return_id!==ret.id||replay.actor_id!==actor.id||replay.payload_hash!==hash)throw new Error('This submission was already used for different details.');return String(ret.id);}
  if(ret.version!==d.version)throw new Error('Return changed. Reload and review before continuing.');
  if(!sources[d.action].includes(ret.status))throw new Error('This action is not available at the current Return status.');
  if(['reject','cancel'].includes(d.action)&&d.reason.length<3)throw new Error('Enter a reason.');
  if(d.action!=='inspect'&&d.conditions)throw new Error('Conditions may only be entered during inspection.');
  if(d.action!=='receive'&&d.received_at)throw new Error('Receipt date may only be entered when receiving goods.');
  const lines=(await db.query<Row>('SELECT * FROM sale_return_lines WHERE return_id=$1 ORDER BY sale_line_id FOR UPDATE',[ret.id])).rows;
  await stamp(db,actor);
  if(d.action==='receive'){
   if(!d.received_at||new Date(d.received_at).getTime()>Date.now()+60000||new Date(d.received_at)<new Date(ret.requested_at))throw new Error('Enter a valid received date on or after the request date.');
   for(const line of lines){
    const original=(await db.query<Row>('SELECT quantity FROM sale_lines WHERE id=$1',[line.sale_line_id])).rows[0];
    const previous=(await db.query<Row>("SELECT COALESCE(sum(l.quantity),0)::text AS quantity FROM sale_return_lines l JOIN sale_returns r ON r.id=l.return_id WHERE l.sale_line_id=$1 AND (l.accepted OR r.status IN ('Received','Inspected','Restocked'))",[line.sale_line_id])).rows[0];
    if(new Money(previous.quantity).plus(line.quantity).gt(original.quantity))throw new Error('Return quantity exceeds the remaining quantity sold.');
   }
  }
  if(d.action==='inspect'){
   if(!d.conditions||d.conditions.length!==lines.length||new Set(d.conditions.map(c=>c.line_id)).size!==lines.length||d.conditions.some(c=>!lines.some(l=>l.id===c.line_id)))throw new Error('Set a condition for every returned line.');
   for(const c of d.conditions)await db.query('UPDATE sale_return_lines SET condition=$1,condition_notes=$2,inspected_by=$3,inspected_at=now() WHERE id=$4',[c.condition,c.notes,actor.id,c.line_id]);
  }
  if(['restock','complete'].includes(d.action)){
   if(lines.some(l=>!l.inspected_by||l.condition==='For Inspection'))throw new Error('Finish inspection before accepting the Return.');
   // Receiving is custody, not final acceptance. Allocate only when restocking or completing.
   // An inspected Return can still be rejected before this point without rewriting history.
   for(const line of lines.filter(l=>!l.accepted)){
    const original=(await db.query<Row>('SELECT * FROM sale_lines WHERE id=$1',[line.sale_line_id])).rows[0];
    const previous=(await db.query<Row>('SELECT COALESCE(sum(quantity),0)::text AS quantity FROM sale_return_lines WHERE sale_line_id=$1 AND accepted',[line.sale_line_id])).rows[0];
    const allocation=allocateReturn(original as Parameters<typeof allocateReturn>[0],previous.quantity,String(line.quantity));
    await db.query('UPDATE sale_return_lines SET accepted=true,stock_quantity=$1,historical_cogs=$2,entered_amount=$3,discount_amount=$4,net_amount=$5,vat_amount=$6,gross_amount=$7,original_vat_snapshot=$8,original_cost_snapshot=$9 WHERE id=$10',[allocation.stock_quantity,allocation.historical_cogs,allocation.entered_amount,allocation.discount_amount,allocation.net_amount,allocation.vat_amount,allocation.gross_amount,JSON.stringify(original.vat_snapshot),JSON.stringify(original.cost_snapshot),line.id]);
    Object.assign(line,allocation,{accepted:true});
   }
  }
  if(d.action==='restock'){
   if(lines.some(l=>l.condition==='For Inspection'))throw new Error('Finish inspection of every line before restocking.');
   const sellable=lines.filter(l=>l.condition==='Sellable'&&!l.movement_id);
   if(!sellable.length)throw new Error('There are no sellable products ready for restocking.');
   const originals=(await db.query<Row>('SELECT l.* FROM sale_lines l JOIN sale_return_lines r ON r.sale_line_id=l.id WHERE r.return_id=$1 ORDER BY l.product_id,l.id',[ret.id])).rows;
   // Product locks use the same ordering as Sales posting. Costs come only from accepted historical allocations.
   await db.query('SELECT id FROM products WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set(originals.map(l=>l.product_id))]]);
   for(const line of sellable){
    const original=originals.find(l=>l.id===line.sale_line_id)!;
    if(!line.inspected_by||!line.accepted)throw new Error('Receive and inspect returned products first.');
    const movement=(await db.query<Row>(`INSERT INTO inventory_movements(request_id,product_id,kind,occurred_at,quantity,uom,stock_quantity,stock_uom,conversion,unit_cost,total_cost,reference,notes,product_name,sku,actor_id,actor_name)
     VALUES($1,$2,'IN',now(),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,[line.id,original.product_id,line.quantity,line.uom,line.stock_quantity,original.stock_uom,original.conversion,new Money(line.historical_cogs).div(line.quantity).toFixed(6),line.historical_cogs,ret.number,'Historical Sale return: '+ret.reason,original.product_name,original.sku,actor.id,actor.name])).rows[0];
    await db.query('UPDATE sale_return_lines SET movement_id=$1 WHERE id=$2',[movement.id,line.id]);
   }
  }
  if(d.action==='complete'&&lines.some(l=>!l.inspected_by||l.condition==='For Inspection'||(l.condition==='Sellable'&&!l.movement_id)))throw new Error('Finish inspection and restock all sellable products before completing.');
  if(d.action==='complete'&&ret.kind==='Cancellation'){
   const retained=(await db.query<Row>('SELECT l.id FROM sale_lines l WHERE l.sale_id=$1 AND l.active AND l.quantity<>COALESCE((SELECT sum(r.quantity) FROM sale_return_lines r WHERE r.sale_line_id=l.id AND r.accepted),0)',[ret.sale_id])).rows;
   if(retained.length)throw new Error('Receive all remaining Sale quantities before completing the cancellation.');
   await db.query('INSERT INTO sale_reversals(request_id,sale_id,reason,actor_id,actor_name,return_id) VALUES($1,$2,$3,$4,$5,$6)',[d.request_id,ret.sale_id,ret.reason,actor.id,actor.name,ret.id]);
  }
  if(d.action==='complete'&&ret.kind==='Cancellation'){const original=(await db.query<Row>('SELECT gross_total FROM sales WHERE id=$1',[ret.sale_id])).rows[0];await offsetVatReference(db,actor,'sale',ret.sale_id,'sale-cancellation:'+ret.id,original.gross_total,referenceDate(),ret.reason);}
  await db.query('UPDATE sale_returns SET status=$1,received_at=COALESCE($2,received_at),version=version+1,updated_at=now() WHERE id=$3',[targets[d.action],d.received_at||null,ret.id]);
  await event(db,actor,ret.id,d.request_id,hash,d.action,ret.status,targets[d.action],d.reason);
  return String(ret.id);
 });
}
export async function getReturn(actor:Actor,id:string){z.uuid().parse(id);return transaction(async db=>{
 actor=await freshActor(db,actor.id);need(actor,'returns.read');
 const row=(await db.query<Row>(`SELECT r.id,r.number,r.sale_id,r.kind,r.status,r.reason,r.requested_at,r.received_at,r.platform_snapshot,r.platform_order_reference,r.platform_case_reference,r.return_policy_snapshot,r.notes,r.refund_status,r.actor_name,r.created_at,r.version,s.number AS sale_number,s.customer_id,s.price_list,s.document_flow FROM sale_returns r JOIN sales s ON s.id=r.sale_id WHERE r.id=$1`,[id])).rows[0];
 if(!row)throw new Error('Return not found.');if(row.customer_id)need(actor,'customers.read');
 const financial=allows(actor,'returns.financial');
 row.lines=(await db.query(`SELECT r.id,r.sale_line_id,r.quantity,r.uom,r.condition,r.condition_notes,r.accepted,r.movement_id,r.inspected_at,l.product_name,l.sku${financial?',r.stock_quantity,r.historical_cogs,r.entered_amount,r.net_amount,r.vat_amount,r.gross_amount,r.original_vat_snapshot,r.original_cost_snapshot':''} FROM sale_return_lines r JOIN sale_lines l ON l.id=r.sale_line_id WHERE r.return_id=$1 ORDER BY l.position`,[id])).rows;
 if(financial&&!allows(actor,'sales.discounts'))for(const line of row.lines){if(line.original_vat_snapshot){const snapshot={...line.original_vat_snapshot};delete snapshot.discount_percent;delete snapshot.discount_rules;line.original_vat_snapshot=snapshot;}}
 row.events=(await db.query('SELECT action,from_status,to_status,reason,actor_name,created_at FROM sale_return_events WHERE return_id=$1 ORDER BY created_at,id',[id])).rows;
 return row;
});}
export async function listReturns(actor:Actor,filter:{q?:string;status?:string;page?:number;platform?:string;from?:string;to?:string}={}){return transaction(async db=>{
 actor=await freshActor(db,actor.id);need(actor,'returns.read');
 for(const date of [filter.from,filter.to])if(date)z.iso.date().parse(date);
 const q='%'+(filter.q||'').slice(0,160)+'%';const status=returnStatuses.includes(filter.status as typeof returnStatuses[number])?filter.status:'';
 return (await db.query(`SELECT r.id,r.number,r.sale_id,s.number AS sale_number,r.status,r.reason,r.requested_at,r.received_at,r.platform_snapshot,r.platform_order_reference,r.platform_case_reference,s.customer_snapshot->>'name' AS customer_name
 FROM sale_returns r JOIN sales s ON s.id=r.sale_id
 WHERE ($2='' OR r.status=$2) AND ($3 OR s.customer_id IS NULL) AND ($5='' OR r.platform_snapshot->>'id'=$5) AND ($6='' OR (r.requested_at AT TIME ZONE 'Asia/Manila')::date>=NULLIF($6,'')::date) AND ($7='' OR (r.requested_at AT TIME ZONE 'Asia/Manila')::date<=NULLIF($7,'')::date) AND
 (r.number ILIKE $1 OR s.number ILIKE $1 OR s.customer_snapshot->>'name' ILIKE $1 OR r.platform_snapshot->>'name' ILIKE $1 OR r.platform_order_reference ILIKE $1 OR r.platform_case_reference ILIKE $1 OR EXISTS(SELECT 1 FROM sale_return_lines rl JOIN sale_lines sl ON sl.id=rl.sale_line_id WHERE rl.return_id=r.id AND (sl.product_name ILIKE $1 OR sl.sku ILIKE $1)))
 ORDER BY r.requested_at DESC,r.id LIMIT 51 OFFSET $4`,[q,status||'',allows(actor,'customers.read'),(Math.max(1,Math.min(100000,Math.floor(filter.page||1)))-1)*50,filter.platform||'',filter.from||'',filter.to||''])).rows;
});}

export async function cancelDraftSale(actor:Actor,input:unknown){
 const d=z.object({id:z.uuid(),request_id:z.uuid(),version:z.number().int().positive(),reason:z.string().trim().min(3).max(1000)}).strict().parse(input),hash=digest(d);
 return transaction(async db=>{
  actor=await freshActor(db,actor.id);need(actor,'sales.cancel');
  const sale=(await db.query<Row>('SELECT id,status,version,customer_id FROM sales WHERE id=$1 FOR UPDATE',[d.id])).rows[0];
  if(!sale)throw new Error('Sale not found.');if(sale.customer_id)need(actor,'customers.read');
  const replay=(await db.query<Row>('SELECT * FROM sales_requests WHERE request_id=$1',[d.request_id])).rows[0];
  if(replay){if(replay.actor_id!==actor.id||replay.operation!=='cancel-draft'||replay.payload_hash!==hash||replay.sale_id!==sale.id)throw new Error('This submission was already used for different details.');return String(sale.id);}
  if(sale.status!=='Draft')throw new Error('Posted Sales require a controlled Return/cancellation workflow.');
  if(sale.version!==d.version)throw new Error('Sale changed. Reload before cancelling.');
  await stamp(db,actor);
  await db.query("UPDATE sales SET status='Cancelled',cancelled_reason=$1,version=version+1,updated_at=now() WHERE id=$2",[d.reason,sale.id]);
  await db.query('INSERT INTO sales_requests(request_id,actor_id,operation,payload_hash,sale_id) VALUES($1,$2,$3,$4,$5)',[d.request_id,actor.id,'cancel-draft',hash,sale.id]);
  return String(sale.id);
 });
}
