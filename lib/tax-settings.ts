import {operationalConfig} from './operational-pricing';
import {z} from 'zod';
import {transaction,type DB} from './db';
import {freshActor} from './masters';
import {has,canRead,assertAllowed,type Actor} from './permissions';
import {Money,type TaxConfig} from './vat';
export type TaxSettings=TaxConfig&{id:string;updated_at:Date;reason:string;updated_by:string|null};
export async function taxConfigInTransaction(db:DB,expectedVersion?:number){
 const config=(await db.query<TaxSettings>('SELECT * FROM tax_settings WHERE singleton FOR SHARE')).rows[0];
 if(!config)throw new Error('Tax configuration is unavailable.');
 if(expectedVersion!==undefined&&config.version!==expectedVersion)throw new Error('Tax settings changed. Reload and review the VAT breakdown before saving.');
 return config;
}
export async function getTaxSettings(actor:Actor){return transaction(async db=>{actor=await freshActor(db,actor.id);assertAllowed(has(actor));return taxConfigInTransaction(db);});}
export async function getTaxDefaults(actor:Actor){return transaction(async db=>{actor=await freshActor(db,actor.id);assertAllowed(canRead(actor,'products'));return operationalConfig;});}
export async function saveTaxSettings(actor:Actor,input:unknown){
 const data=z.object({percent:z.string().regex(/^\d{1,3}(\.\d{1,4})?$/),version:z.number().int().positive(),reason:z.string().trim().min(3).max(500)}).strict().parse(input);
 const rate=new Money(data.percent).div(100);if(rate.gt(1))throw new Error('VAT rate must be between 0% and 100%.');
 return transaction(async db=>{actor=await freshActor(db,actor.id);assertAllowed(has(actor));
 await db.query("SELECT set_config('imperial.actor_id',$1,true)",[actor.id]);
 const result=await db.query('UPDATE tax_settings SET standard_rate=$1,version=version+1,effective_at=now(),updated_at=now(),updated_by=$2,reason=$3 WHERE singleton AND version=$4 RETURNING id',[rate.toFixed(6),actor.id,data.reason,data.version]);
 if(!result.rows.length)throw new Error('Tax settings changed. Reload before saving.');return String(result.rows[0].id);
 });
}
