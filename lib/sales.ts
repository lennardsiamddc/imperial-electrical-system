import {operationalConfig,type PriceList} from './operational-pricing';
import {createARForSource} from './finance';
import {randomUUID} from 'node:crypto';
import {recordVatReference,referenceDate} from './vat-reference';
import {z} from 'zod';
import {transaction,type DB} from './db';
import {freshActor} from './masters';
import {allows,type Actor} from './permissions';
import {Money,type EntryMode,type TaxTreatment} from './vat';
import {postMovementInTransaction} from './inventory';
import {saleDraftSchema,type SaleDraftInput} from './sales-schema';
import {calculateSaleLine,saleTotals,dueDate} from './sales-calculations';
import {need,stamp,option,digest,requestReplay,remember,type Row} from './sales-common';
import {setDocumentRequirements} from './sales-documents';
export function saleProductDefaults(product:Row,uom:string,priceList:PriceList='Retail'){
 const explicit=product.selling_prices?.[uom]?.[priceList];
 let price=explicit;
 if(price===undefined){if(uom===product.primary_uom)price=product[priceList==='Contractor'?'contractor_price':'retail_price'];else if(priceList==='Retail'&&uom==='METER')price=product.meter_price;}
 return {price:price===undefined||price===null?'':String(price),vat_mode:'VAT Exclusive' as EntryMode,tax_treatment:'VATable' as TaxTreatment};
}

async function insertRow(db:DB,table:string,row:Row){const keys=Object.keys(row);return (await db.query<Row>(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(row))).rows[0];}
async function updateRow(db:DB,table:string,id:string,row:Row){const keys=Object.keys(row);await db.query(`UPDATE ${table} SET ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')} WHERE id=$${keys.length+1}`,[...Object.values(row),id]);}
async function paymentIntent(db:DB,actor:Actor,data:SaleDraftInput,old:Row|undefined,gross:string){
 if(!data.payment){if(old)return old.payment_intent;const unpaid=(await db.query<Row>("SELECT id,kind,code,name,behavior,version FROM sales_options WHERE kind='payment_method' AND code='unpaid' AND active")).rows[0];if(!unpaid)throw new Error('Owner must enable the unpaid payment method.');return {method_id:unpaid.id,method_snapshot:unpaid,amount_received:'0.00',status:'Unpaid',reference:'',account_id:'',check_bank:'',check_number:'',check_date:''};}
 need(actor,'sales.payment.edit');
 const p=data.payment,method=await option(db,p.method_id,'payment_method');
 const amount=new Money(p.amount_received).toDecimalPlaces(2);if(amount.gt(gross))throw new Error('Received payment cannot exceed customer payable.');
 const status=amount.isZero()?'Unpaid':amount.eq(gross)?'Paid':'Partially Paid';if(p.status!==status)throw new Error('Payment status must match the actual amount received.');
 if(method.behavior==='Unpaid'&&!amount.isZero())throw new Error('Choose the actual payment method for received money.');
 if(p.account_id&&method.behavior!=='Bank')throw new Error('Bank account labels only apply to Bank Transfer.');
 if((p.check_bank||p.check_number||p.check_date)&&method.behavior!=='Check')throw new Error('Check details only apply to Check payment.');
 if(method.behavior==='Check'&&(!p.check_bank||!p.check_number||!p.check_date||!/^\d{4}-\d{2}-\d{2}$/.test(p.check_date)||new Date(p.check_date).toISOString().slice(0,10)!==p.check_date))throw new Error('Enter the check bank, number and valid check date.');
 return {...p,amount_received:amount.toFixed(2),status,method_snapshot:method,account_snapshot:p.account_id?await option(db,p.account_id,'bank'):null};
}
export async function saveSale(actor:Actor,input:unknown){
 const d=saleDraftSchema.parse(input),hash=digest(d);
 return transaction(async db=>{
  actor=await freshActor(db,actor.id);need(actor,d.id?'sales.edit':'sales.create');need(actor,'sales.prices');need(actor,'products.read');
  // Transaction-scoped advisory lock makes retries on the same submission safe across connections.
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[d.request_id]);
  const replay=await requestReplay(db,actor,d.request_id,'save',hash);if(replay)return replay;
  const old=d.id?(await db.query<Row>('SELECT * FROM sales WHERE id=$1 FOR UPDATE',[d.id])).rows[0]:undefined;
  if(d.id&&(!old||old.status!=='Draft'))throw new Error('Only Draft Sales can be edited.');if(old&&old.version!==d.version)throw new Error('Sale changed. Reload and review before saving.');
  if(new Set(d.lines.map(l=>l.id)).size!==d.lines.length)throw new Error('Each Sale line must have a unique identifier.');
  if(new Date(d.occurred_at).getTime()>Date.now()+60000)throw new Error('Sale date cannot be in the future.');
  let customer:Row={name:'Walk-in',code:'',billing_address:'',delivery_addresses:[]};
  if(d.customer_id){need(actor,'customers.read');customer=(await db.query<Row>('SELECT id,code,name,contact_person,phone,email,tin,billing_address,delivery_addresses FROM customers WHERE id=$1 AND active FOR SHARE',[d.customer_id])).rows[0];if(!customer)throw new Error('Choose an active customer.');}
  else if(d.channel==='Wholesale')throw new Error('Wholesale Sales require a customer.');
  const platform=d.channel==='Online'?await option(db,d.platform_id,'platform'):null;
  if(d.channel!=='Online'&&(d.platform_id||d.online_reference))throw new Error('Platform details only apply to Online Sales.');
  let salesperson:Row|null=null;if(d.salesperson_id){salesperson=(await db.query<Row>('SELECT id,name FROM users WHERE id=$1 AND active FOR SHARE',[d.salesperson_id])).rows[0];if(!salesperson)throw new Error('Choose an active salesperson.');}
  const ids=[...new Set(d.lines.map(l=>l.product_id))].sort();
  const products=(await db.query<Row>('SELECT * FROM products WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',[ids])).rows;
  const config=operationalConfig;
  const oldLines=old?(await db.query<Row>('SELECT * FROM sale_lines WHERE sale_id=$1 AND active',[old.id])).rows:[];
  if(old&&!allows(actor,'sales.discounts')&&oldLines.some(l=>new Money(l.discount_percent).gt(0)))throw new Error('You do not have permission to edit a Sale containing protected discounts.');
  const quantities:Record<string,string>={};const lines:Row[]=[];
  for(const l of d.lines){
   const product=products.find(p=>p.id===l.product_id);if(!product||!product.active)throw new Error('Choose active products for every Sale line.');
   const qty=new Money(l.quantity);if(qty.lte(0)||(l.uom!=='METER'&&!qty.isInteger()))throw new Error(product.name+': enter a positive quantity; count units require whole numbers.');
   if(l.uom!==product.primary_uom&&l.uom!==product.secondary_uom)throw new Error(product.name+': UOM is not configured.');
   const factor=new Money(product.conversion||1),stockQty=qty.mul(l.uom===product.primary_uom?factor:1),stockUom=product.secondary_uom||product.primary_uom;
   if(stockQty.decimalPlaces()>6||stockQty.gte('1e24')||(stockUom!=='METER'&&!stockQty.isInteger()))throw new Error(product.name+': converted quantity is invalid.');
   const defaults=saleProductDefaults(product,l.uom,d.price_list),prior=oldLines.find(p=>p.id===l.id&&p.product_id===l.product_id&&p.uom===l.uom);
   const existingPrice=prior&&new Money(prior.entered_price).eq(l.price);
   if(!existingPrice&&(!defaults.price||!new Money(defaults.price).eq(l.price)))need(actor,'sales.override');
   if(!new Money(l.discount).eq(prior?.discount_percent||'0'))need(actor,'sales.discount.apply');
   const amounts=calculateSaleLine(l.price,l.quantity,l.discount,l.vat_mode,l.tax_treatment,config);
   quantities[l.uom]=new Money(quantities[l.uom]||0).plus(qty).toFixed(6);
   lines.push({id:l.id,position:lines.length+1,product_id:product.id,product_name:product.name,sku:product.sku,brand:product.brand,category:product.category,quantity:qty.toFixed(6),uom:l.uom,stock_quantity:stockQty.toFixed(6),stock_uom:stockUom,conversion:factor.toFixed(6),...amounts,vat_mode:l.vat_mode,tax_treatment:l.tax_treatment,discount_percent:new Money(l.discount).toFixed(6),discount_rules:JSON.stringify(amounts.vat_snapshot.discount_rules),vat_snapshot:JSON.stringify(amounts.vat_snapshot)});
  }
  const totals=saleTotals(lines as ReturnType<typeof calculateSaleLine>[]),payment=await paymentIntent(db,actor,d,old,totals.gross_total);
  if(new Money(payment.amount_received||0).gt(totals.gross_total))throw new Error('Payment exceeds the changed Sale total. Ask an authorized employee to update payment information.');
  const received=new Money(payment.amount_received||0),paymentStatus=received.isZero()?'Unpaid':received.eq(totals.gross_total)?'Paid':'Partially Paid';
  if(d.terms!==(old?.terms||'Cash')||d.custom_terms!==(old?.custom_terms||''))need(actor,'sales.payment.edit');
  if(old&&d.terms==='Custom'&&d.custom_due_date!==new Date(old.due_date).toISOString().slice(0,10))need(actor,'sales.payment.edit');
  if(d.terms==='Custom'&&!d.custom_terms.trim())throw new Error('Describe the custom terms.');
  const header={vat_reference_mode:d.vat_reference_mode,price_list:d.price_list,document_flow:d.document_flow,channel:d.channel,occurred_at:d.occurred_at,customer_id:d.customer_id||null,customer_snapshot:JSON.stringify(customer),platform_id:platform?.id||null,platform_snapshot:platform?JSON.stringify(platform):null,reference:d.reference,online_reference:d.online_reference,terms:d.terms,custom_terms:d.custom_terms,due_date:dueDate(d.occurred_at,d.terms,d.custom_due_date),salesperson_id:salesperson?.id||null,salesperson_snapshot:salesperson?JSON.stringify(salesperson):null,notes:d.notes,tax_config:JSON.stringify({standard_rate:config.standard_rate,version:config.version,effective_at:config.effective_at}),line_count:lines.length,quantities:JSON.stringify(quantities),...totals,payment_intent:JSON.stringify({...payment,status:paymentStatus}),payment_status:paymentStatus};
  await stamp(db,actor);let id:string;
  if(old){id=old.id;await updateRow(db,'sales',id,{...header,version:old.version+1,updated_at:new Date().toISOString()});await db.query('UPDATE sale_lines SET active=false WHERE sale_id=$1 AND active',[id]);}
  else id=(await insertRow(db,'sales',{...header,request_id:d.request_id,creation_hash:hash,created_by:actor.id,actor_name:actor.name})).id;
  for(const l of lines){const existing=(await db.query<Row>('SELECT sale_id FROM sale_lines WHERE id=$1',[l.id])).rows[0];if(existing&&existing.sale_id!==id)throw new Error('A Sale line belongs to another Sale.');if(existing)await updateRow(db,'sale_lines',l.id,{...l,sale_id:id,active:true});else await insertRow(db,'sale_lines',{...l,sale_id:id});}
  if(d.documents){need(actor,'sales.documents.require');await setDocumentRequirements(db,actor,id,d.documents);}else if(!old)await setDocumentRequirements(db,actor,id,{si:false,dr:false});
  await remember(db,actor,d.request_id,'save',hash,id);return id;
 });
}
export async function postSale(actor:Actor,input:unknown){return transaction(db=>postSaleInTransaction(actor,input,db));}
// Shared posting engine. Stage 4 invokes it inside the release transaction.
export async function postSaleInTransaction(actor:Actor,input:unknown,db:DB,preserveTaxSnapshot=false){
 const d=z.object({id:z.uuid(),version:z.number().int().positive(),request_id:z.uuid()}).strict().parse(input),hash=digest(d);

  actor=await freshActor(db,actor.id);need(actor,'sales.post');need(actor,'sales.prices');need(actor,'inventory.issue');
  const sale=(await db.query<Row>('SELECT * FROM sales WHERE id=$1 FOR UPDATE',[d.id])).rows[0];if(!sale)throw new Error('Sale not found.');if(sale.customer_id)need(actor,'customers.read');
  const replay=await requestReplay(db,actor,d.request_id,'post',hash);if(replay)return replay;
  if(sale.status==='Posted')return String(sale.id);
  if(sale.status!=='Draft')throw new Error('Only Draft Sales may be posted.');if(sale.version!==d.version)throw new Error('Sale changed. Review it again before posting.');
  const lines=(await db.query<Row>('SELECT * FROM sale_lines WHERE sale_id=$1 AND active ORDER BY product_id,id',[sale.id])).rows;if(!lines.length)throw new Error('Add products before posting.');
  const products=(await db.query<Row>('SELECT id,name,active FROM products WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',[[...new Set(lines.map(l=>l.product_id))]])).rows;
  if(products.some(p=>!p.active))throw new Error('An inactive product must be removed before posting.');
  if(sale.customer_id&&!(await db.query('SELECT id FROM customers WHERE id=$1 AND active FOR SHARE',[sale.customer_id])).rows.length)throw new Error('Customer is inactive.');
  if(preserveTaxSnapshot){
   if(!(await db.query("SELECT id FROM commercial_documents WHERE sale_id=$1 AND kind IN ('DR','RELEASE') AND status='Draft'",[sale.id])).rows.length)throw new Error('Historical posting requires a linked goods release.');
  }
  for(const p of products){const required=lines.filter(l=>l.product_id===p.id).reduce((s,l)=>s.plus(l.stock_quantity),new Money(0));const available=(await db.query<Row>("SELECT COALESCE(sum(CASE WHEN kind='IN' THEN stock_quantity ELSE -stock_quantity END),0)::text AS quantity FROM inventory_movements WHERE product_id=$1",[p.id])).rows[0].quantity;if(required.gt(available))throw new Error(p.name+': insufficient available stock ('+available+' '+lines.find(l=>l.product_id===p.id)!.stock_uom+').');}
  await stamp(db,actor);let cogs=new Money(0);
  for(const line of lines){
   const movement=await postMovementInTransaction(actor,{request_id:line.id,product_id:line.product_id,kind:'OUT',occurred_at:new Date(sale.occurred_at).toISOString(),quantity:String(line.quantity),uom:line.uom,reference:sale.number,notes:'Sale '+sale.number},db);
   const cost=(await db.query<Row>('SELECT total_cost,stock_quantity,unit_cost FROM inventory_movements WHERE id=$1',[movement])).rows[0];cogs=cogs.plus(cost.total_cost);
   await updateRow(db,'sale_lines',line.id,{movement_id:movement,cogs:cost.total_cost,profit:new Money(line.net_amount).minus(cost.total_cost).toFixed(6),cost_snapshot:JSON.stringify({method:'weighted-average',movement_id:movement,total_cost:cost.total_cost,stock_quantity:cost.stock_quantity,unit_cost:cost.unit_cost})});
  }
  const payment=sale.payment_intent;
  if(new Money(payment.amount_received||0).gt(0))await insertRow(db,'sale_payments',{sale_id:sale.id,request_id:randomUUID(),method_id:payment.method_id,method_snapshot:JSON.stringify(payment.method_snapshot),amount:payment.amount_received,received_at:new Date().toISOString(),account_id:payment.account_id||null,account_snapshot:payment.account_snapshot?JSON.stringify(payment.account_snapshot):null,reference:payment.reference||'',check_bank:payment.check_bank||'',check_number:payment.check_number||'',check_date:payment.check_date||null,actor_id:actor.id,actor_name:actor.name});
  await db.query('INSERT INTO sale_document_lines(document_id,sale_line_id,quantity) SELECT d.id,l.id,l.quantity FROM sale_documents d JOIN sale_lines l ON l.sale_id=d.sale_id WHERE d.sale_id=$1 AND d.status<>$2 AND d.status<>$3 AND l.active ON CONFLICT(document_id,sale_line_id) DO NOTHING',[sale.id,'Not Required','Cancelled / Void']);
  const profit=new Money(sale.net_total).minus(cogs);
  await updateRow(db,'sales',sale.id,{status:'Posted',version:sale.version+1,cogs:cogs.toFixed(6),profit:profit.toFixed(6),gross_margin:new Money(sale.net_total).isZero()?null:profit.div(sale.net_total).mul(100).toFixed(6),posted_by:actor.id,posted_at:new Date().toISOString(),updated_at:new Date().toISOString()});
  if(!preserveTaxSnapshot)await recordVatReference(db,actor,{direction:'Output',kind:'sale',id:sale.id,number:sale.number,date:referenceDate(sale.occurred_at),amount:sale.gross_total,included:sale.vat_reference_mode==='Included'});
  await createARForSource(db,actor,'sale',sale.id);
  await remember(db,actor,d.request_id,'post',hash,sale.id);return String(sale.id);

}
