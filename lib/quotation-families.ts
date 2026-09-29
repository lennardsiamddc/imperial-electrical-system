import {z} from 'zod';
import {transaction,type DB} from './db';
import {freshActor} from './masters';
import {need,stamp,type Row} from './sales-common';
import type {Actor} from './permissions';
import {quotationUnits} from './quotation-pricing';
const schema=z.object({id:z.uuid().optional(),version:z.number().int().optional(),code:z.string().trim().min(1).max(80),name:z.string().trim().min(1).max(200),brand:z.string().trim().min(1),product_type:z.string().trim().min(1),specification:z.string().trim().min(1),color:z.string().trim().min(1),reason:z.string().trim().min(1),routes:z.array(z.object({uom:z.enum(['PCS','BOX','ROLL','METER']),product_id:z.uuid()})).min(1).max(4)}).strict();
export async function saveQuotationFamily(actor:Actor,input:unknown){const d=schema.parse(input);return transaction(async db=>{actor=await freshActor(db,actor.id);need(actor,'products.write');need(actor,'products.prices');await stamp(db,actor);if(new Set(d.routes.map(r=>r.uom)).size!==d.routes.length)throw new Error('Duplicate family UOM.');
 if(d.id){const old=(await db.query<Row>('SELECT * FROM quotation_families WHERE id=$1 FOR UPDATE',[d.id])).rows[0];if(!old||old.version!==d.version)throw new Error('Family changed. Reload before saving.');}
 for(const route of d.routes){const p=(await db.query<Row>('SELECT * FROM products WHERE id=$1 AND active FOR SHARE',[route.product_id])).rows[0];if(!p||p.primary_uom!==route.uom)throw new Error('Route must match an active inventory SKU primary UOM.');if(p.brand.trim().toLowerCase()!==d.brand.trim().toLowerCase())throw new Error('Variant brand does not match family.');}
 const id=d.id||(await db.query<Row>('INSERT INTO quotation_families(code,name,brand,product_type,specification,color) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[d.code,d.name,d.brand,d.product_type,d.specification,d.color])).rows[0].id;
 if(d.id)await db.query('UPDATE quotation_families SET code=$2,name=$3,brand=$4,product_type=$5,specification=$6,color=$7,version=version+1,updated_at=now() WHERE id=$1',[id,d.code,d.name,d.brand,d.product_type,d.specification,d.color]);
 for(const r of d.routes){await db.query('INSERT INTO quotation_family_variants(family_id,product_id,reason,approved_by) VALUES($1,$2,$3,$4) ON CONFLICT(family_id,product_id) DO NOTHING',[id,r.product_id,d.reason,actor.id]);await db.query('INSERT INTO quotation_family_routes(family_id,uom,product_id) VALUES($1,$2,$3) ON CONFLICT(family_id,uom) DO UPDATE SET product_id=EXCLUDED.product_id',[id,r.uom,r.product_id]);}return id;
 });}
export async function familyOptions(db:DB,id:string){const family=(await db.query<Row>('SELECT * FROM quotation_families WHERE id=$1 AND active FOR SHARE',[id])).rows[0];if(!family)return null;const rows=(await db.query<Row>('SELECT p.*,r.uom route_uom FROM quotation_family_routes r JOIN products p ON p.id=r.product_id WHERE r.family_id=$1 AND p.active ORDER BY r.uom FOR SHARE OF r,p',[id])).rows;return {id:family.id,family_id:family.id,name:family.name,sku:family.code,unit_defaults:quotationBasisVariants(rows).map(p=>({...quotationUnits(p).find(u=>u.uom===p.route_uom),product_id:p.id,sku:p.sku,product_name:p.name,family_name:family.name,family_id:family.id,family_version:family.version,inventory_uom:p.primary_uom}))};}

// Quotation labels choose a price basis, not an inventory conversion.
// Only an unambiguous whole-item source can supply the three whole-item labels.
export function quotationBasisVariants(rows:Row[]):Row[]{const whole=rows.filter(p=>p.route_uom!=='METER');if(whole.length!==1)return rows;return [...['PCS','BOX','ROLL'].map(route_uom=>({...whole[0],route_uom})),...rows.filter(p=>p.route_uom==='METER')];}
