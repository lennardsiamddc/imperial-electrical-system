import {taxTreatments,entryModes,taxSnapshot,sellingSnapshot,type TaxTreatment,type EntryMode} from './vat';
import {pricingRulesSchema,productPricing} from './product-pricing';
import {Money} from './vat';
import {pricingIndicators} from './pricing';
import {z} from 'zod';
import {transaction, type DB} from './db';
import {assertAllowed,allows,canRead,canWrite,permittedFields,type Actor,type Entity} from './permissions';
const text=z.string().trim().max(1000);
const required=text.min(1,'This field is required.');
const money=z.string().regex(/^\d{1,16}(\.\d{1,2})?$/,'Use a positive amount with up to 2 decimal places.');
const quantity=z.string().regex(/^\d{1,12}(\.\d{1,6})?$/,'Use a positive number with up to 6 decimal places.');
const rate=z.string().regex(/^-?\d{1,3}(\.\d{1,6})?$/,'Use a decimal rate, for example 0.12.');
const optionalId=z.union([z.literal(''),z.uuid()]).transform(v=>v||null);
const contact={contact_person:text,phone:text,email:z.union([z.literal(''),z.email()]),tin:text,notes:text};
export const schemas={
 customers:z.object({default_price_list:z.enum(['Retail','Contractor']).nullable().optional(),code:required.max(60),name:required.max(200),customer_type:required,...contact,billing_address:text,delivery_addresses:text.transform(v=>v.split('\n').map(s=>s.trim()).filter(Boolean)),salesperson_id:optionalId,payment_terms:required,credit_limit:money,credit_notes:text,account_status:z.enum(['Active','On hold','Closed']),active:z.boolean()}),
 suppliers:z.object({code:required.max(60),name:required.max(200),...contact,address:text,payment_terms:required,active:z.boolean()}),
 products:z.object({pricing_rules:pricingRulesSchema.optional(),selling_prices:z.partialRecord(z.enum(['PCS','BOX','ROLL','METER']),z.object({Retail:quantity,Contractor:quantity}).strict()).optional(),sku:required.max(60),name:required.max(200),brand:text,category:text,primary_uom:z.enum(['PCS','ROLL','BOX','METER']),secondary_uom:z.enum(['','PCS','ROLL','BOX','METER']).transform(v=>v||null),conversion:z.union([z.literal(''),quantity]).transform(v=>v||null),base_price:money,supplier_adjustment:rate,standard_cost:money,vat_status:z.enum(['VAT','Exempt','Zero rated']),vat_rate:rate,retail_price:quantity,contractor_price:quantity,wholesale_price:money,meter_price:z.union([z.literal(''),money]).transform(v=>v||null),reorder_level:quantity,supplier_id:optionalId,notes:text.optional(),selling_tax_treatment:z.enum(taxTreatments).optional(),selling_entry_mode:z.enum(entryModes).optional(),cost_tax_treatment:z.enum(taxTreatments).optional(),cost_entry_mode:z.enum(entryModes).optional(),cost_input_vat_recoverable:z.boolean().optional(),active:z.boolean()})
};
export const fields=(entity:Entity)=>Object.keys(schemas[entity].shape);
const readFields=(entity:Entity)=>entity==='products'?[...fields(entity),'cost_vat','selling_vat']:fields(entity);
export function entityFrom(value:string):Entity{if(!['customers','products','suppliers'].includes(value))throw new Error('Unknown module.');return value as Entity;}
export async function freshActor(db:DB,id:string){const row=(await db.query<Actor>('SELECT id,name,email,roles,permission_overrides FROM users WHERE id=$1 AND active=true FOR SHARE',[id])).rows[0];assertAllowed(!!row);return row;}
export async function listMaster(actor:Actor,entity:Entity,search='',status='',page=1){
 return transaction(async db=>{actor=await freshActor(db,actor.id);
 assertAllowed(canRead(actor,entity));const columns=['id','version','created_at','updated_at',...permittedFields(actor,entity,readFields(entity))];
 const code=entity==='products'?'sku':'code';
 const result=await db.query(`SELECT ${columns.join(',')} FROM ${entity} WHERE (name ILIKE $1 OR ${code} ILIKE $1${entity==='products'?' OR brand ILIKE $1':entity==='customers'?' OR contact_person ILIKE $1 OR tin ILIKE $1':''}) AND ($2='' OR active::text=$2) ORDER BY name,id LIMIT 51 OFFSET $3`,[`%${search.slice(0,100)}%`,['true','false'].includes(status)?status:'',(Math.max(1,Math.min(page,100000))-1)*50]);return entity==='products'?result.rows.map(row=>({...row,...pricingIndicators(row)})):result.rows;});
}
export async function getMaster(actor:Actor,entity:Entity,id:string){z.uuid().parse(id);return transaction(async db=>{actor=await freshActor(db,actor.id);assertAllowed(canRead(actor,entity));const row=(await db.query(`SELECT id,version,created_at,updated_at,${permittedFields(actor,entity,readFields(entity)).join(',')} FROM ${entity} WHERE id=$1`,[id])).rows[0];return row&&entity==='products'?{...row,...pricingIndicators(row)}:row;});}
export async function saveMaster(actor:Actor,entity:Entity,input:Record<string,unknown>,id?:string,version?:number){
 if(id)z.uuid().parse(id);
 return transaction(async db=>{
 const current=await freshActor(db,actor.id);assertAllowed(canWrite(current,entity));if(entity==='customers')assertAllowed(allows(current,id?'customers.edit':'customers.create'));
 const expectedTaxVersion=input.tax_config_version;
 input={...input};delete input.tax_config_version;
 if(expectedTaxVersion!==undefined)z.number().int().positive().parse(expectedTaxVersion);
 const allowed=permittedFields(current,entity,fields(entity)).filter(k=>!(entity==='customers'&&k==='credit_limit'&&current.permission_overrides?.['ar.credit.edit']==='deny'&&!current.roles.includes('PRESIDENT_ADMIN')));
 for(const key of Object.keys(input))assertAllowed(allowed.includes(key));
 // A restricted field is never accepted from a client, including hidden inputs.
 const shape=schemas[entity].shape as Record<string,z.ZodType>;
 const selected=Object.fromEntries(allowed.map(k=>[k,shape[k]]));
 const data=z.object(selected).strict().parse(input);
 if(entity==='products'){
  if(Boolean(data.secondary_uom)!==Boolean(data.conversion)||data.secondary_uom===data.primary_uom||(data.conversion&&/^0(?:\.0+)?$/.test(String(data.conversion))))throw new Error('Secondary UOM requires a different unit and a conversion greater than zero.');
 }
 await db.query("SELECT set_config('imperial.actor_id',$1,true)",[current.id]);
 if(entity==='customers'&&data.salesperson_id){const seller=(await db.query("SELECT id FROM users WHERE id=$1 AND active AND roles && ARRAY['SALES','PRESIDENT_ADMIN']::text[]",[data.salesperson_id])).rows[0];if(!seller)throw new Error('Choose an active salesperson.');}
 if(entity==='products'&&data.supplier_id){if(!(await db.query('SELECT id FROM suppliers WHERE id=$1 AND active',[data.supplier_id])).rows[0])throw new Error('Choose an active supplier.');}
 if(entity==='products'){
  if(id&&!data.pricing_rules){const previous=(await db.query<Record<string,any>>('SELECT * FROM products WHERE id=$1 FOR UPDATE',[id])).rows[0];if(previous?.pricing_rules){for(const key of ['base_price','standard_cost','retail_price','contractor_price','meter_price','supplier_adjustment'])if(data[key]!==undefined&&data[key]!==null&&!new Money(String(data[key])).eq(String(previous[key]??0)))throw new Error('This product uses pricing rules. Update its price calculations and manual overrides together.');if(data.selling_prices&&JSON.stringify(data.selling_prices)!==JSON.stringify(previous.selling_prices))throw new Error('This product uses pricing rules. Update its price calculations and manual overrides together.');}}
  // Obsolete fields remain in the database; no new VAT snapshot is computed.
  for(const key of ['selling_tax_treatment','selling_entry_mode','cost_tax_treatment','cost_input_vat_recoverable'])delete data[key];
  if(data.pricing_rules){const units=[data.primary_uom,data.secondary_uom].filter(Boolean).map(String);const rules=data.pricing_rules as import('./sales-common').Row;assertAllowed(allowed.includes('selling_prices')&&allowed.includes('standard_cost'));if(Object.keys(rules).some(u=>!units.includes(u))||units.some(u=>!rules[u]))throw new Error('Enter pricing rules for every configured UOM.');for(const u of units)rules[u].selling_basis='Base';const prices=Object.fromEntries(units.map(u=>{const v=productPricing(rules[u]);return [u,{Retail:new Money(v.retail).toFixed(6),Contractor:new Money(v.contractor).toFixed(6)}];}));const main=productPricing(rules[String(data.primary_uom)]);data.selling_prices=prices;data.base_price=new Money(rules[String(data.primary_uom)].base).toFixed(2);data.standard_cost=new Money(main.net).toFixed(2);data.retail_price=prices[String(data.primary_uom)].Retail;data.contractor_price=prices[String(data.primary_uom)].Contractor;}
  if(data.selling_prices){const units=[data.primary_uom,data.secondary_uom].filter(Boolean);if(Object.keys(data.selling_prices as object).some(u=>!units.includes(u)))throw new Error('Price lists must use a configured product UOM.');for(const u of units)if(!(data.selling_prices as Record<string,unknown>)[String(u)])throw new Error('Enter Retail and Contractor prices for every supported UOM.');}
 }

 const keys=Object.keys(data),values=keys.map(k=>(k==='delivery_addresses'||k==='cost_vat'||k==='selling_vat'||k==='selling_prices'||k==='pricing_rules')?JSON.stringify(data[k]):data[k]);
 try{
 if(id){const result=await db.query(`UPDATE ${entity} SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')}, version=version+1,updated_at=now() WHERE id=$${keys.length+1} AND version=$${keys.length+2} RETURNING id`,[...values,id,version]);if(!result.rows.length)throw new Error('This record changed or is unavailable. Reload before editing.');return String(result.rows[0].id);}
 return String((await db.query(`INSERT INTO ${entity}(${keys.join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')}) RETURNING id`,values)).rows[0].id);
 }catch(e){if((e as {code?:string}).code==='23505')throw new Error('That code or SKU already exists, including inactive records.');if((e as {code?:string}).code==='23514')throw new Error('Check numeric rates, amounts, and UOM conversion.');throw e;}
 });
}
export async function options(actor:Actor,entity:Entity){
 return transaction(async db=>{actor=await freshActor(db,actor.id);assertAllowed(canRead(actor,entity));
 if(entity==='customers')return (await db.query("SELECT id,name FROM users WHERE active AND roles && ARRAY['SALES','PRESIDENT_ADMIN']::text[] ORDER BY name")).rows;
 if(entity==='products'&&permittedFields(actor,entity,['supplier_id']).length)return (await db.query('SELECT id,name FROM suppliers WHERE active ORDER BY name')).rows;
 return [];
 });
}
