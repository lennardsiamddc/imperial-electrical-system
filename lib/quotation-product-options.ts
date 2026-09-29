import {transaction} from './db';
import {freshActor} from './masters';
import {need,type Row} from './sales-common';
import {saleProductDefaults} from './sales';
import {allows,type Actor} from './permissions';
// Reopening never reprices saved units. Only a deliberate UOM change uses its current configured default.
export async function quotationProductOptions(actor:Actor,lines:Row[]){return transaction(async db=>{
 actor=await freshActor(db,actor.id);if(!allows(actor,'commercial.prices'))need(actor,'sales.prices');need(actor,'products.read');
 const products=(await db.query<Row>('SELECT id,primary_uom,secondary_uom,conversion,retail_price,contractor_price,selling_prices,meter_price,selling_entry_mode,selling_tax_treatment,vat_status FROM products WHERE id=ANY($1::uuid[]) AND active',[[...new Set(lines.map(l=>l.product_id))]])).rows;
 return lines.map(l=>{const p=products.find(p=>p.id===l.product_id),saved={uom:l.uom,price:l.entered_price,vat_mode:l.vat_mode,tax_treatment:l.tax_treatment};return {...l,unit_defaults:p?[p.primary_uom,p.secondary_uom].filter(Boolean).map(uom=>({uom,...saleProductDefaults(p,uom),...(uom===l.uom?saved:{}),prices:{Retail:saleProductDefaults(p,uom,'Retail').price,Contractor:saleProductDefaults(p,uom,'Contractor').price}})):[saved]};});
 });}
