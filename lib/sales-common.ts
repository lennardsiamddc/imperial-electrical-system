import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {DB} from './db';
import {allows,type Actor,type Permission} from './permissions';
export type Row=Record<string,any>;
export const idSchema=z.uuid();
export const text=z.string().trim().max(1000);
export const decimal=z.string().regex(/^\d{1,16}(\.\d{1,6})?$/,'Please enter a valid amount or quantity.');
export const optionalId=z.union([z.uuid(),z.literal('')]).default('');
export function need(actor:Actor,key:Permission,message='You do not have permission for this action.'){if(!allows(actor,key))throw new Error(message);}
export const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function stamp(db:DB,actor:Actor){await db.query("SELECT set_config('imperial.actor_id',$1,true)",[actor.id]);}
export async function option(db:DB,id:string,kind:string){const row=(await db.query<Row>('SELECT id,kind,code,name,behavior,version FROM sales_options WHERE id=$1 AND kind=$2 AND active FOR SHARE',[id,kind])).rows[0];if(!row)throw new Error('Choose an active '+kind.replaceAll('_',' ')+'.');return row;}
export async function requestReplay(db:DB,actor:Actor,request:string,operation:string,hash:string){
 const row=(await db.query<Row>('SELECT * FROM sales_requests WHERE request_id=$1',[request])).rows[0];
 if(row){if(row.actor_id!==actor.id||row.operation!==operation||row.payload_hash!==hash)throw new Error('This submission was already used for different details.');return String(row.sale_id);}
}
export async function remember(db:DB,actor:Actor,request:string,operation:string,hash:string,sale:string){await db.query('INSERT INTO sales_requests(request_id,actor_id,operation,payload_hash,sale_id) VALUES($1,$2,$3,$4,$5)',[request,actor.id,operation,hash,sale]);}
export function saleError(e:unknown){
 if(e instanceof z.ZodError)return 'Please check the required fields, quantities, prices and dates.';
 if((e as {code?:string})?.code==='23505')return 'This sale submission or controlled document number has already been used.';
 if(e instanceof Error&&!('code' in e))return e.message;
 return 'Unable to save this sale. Refresh and try again.';
}
