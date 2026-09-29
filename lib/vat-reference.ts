import {z} from 'zod';
import {Money} from './vat';
import {transaction,type DB} from './db';
import {freshActor} from './masters';
import {need,type Row} from './sales-common';
import type {Actor} from './permissions';
export const referenceDate=(date:Date|string=new Date())=>new Date(new Date(date).getTime()+8*3600000).toISOString().slice(0,10);
export function extractReference(amount:string){return new Money(amount).mul(12).div(112).toFixed(2);}
export async function recordVatReference(db:DB,actor:Actor,input:{direction:'Input'|'Output';kind:string;id:string;number:string;date:string;amount:string;included:boolean}){
 if(!input.included)return;
 await db.query(`INSERT INTO vat_reference_events(event_key,direction,source_kind,source_id,source_number,effective_date,basis_amount,vat_amount,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(event_key) DO NOTHING`,[input.kind+':'+input.id,input.direction,input.kind,input.id,input.number,input.date,input.amount,extractReference(input.amount),'Separate 12/112 reference only; operational amount unchanged.',actor.id]);
}
// Lock the original and allocate cumulative VAT cents, preserving dated history.
// A cancellation and a later AR adjustment cannot offset the same source twice.
export async function offsetVatReference(db:DB,actor:Actor,kind:string,id:string,eventKey:string,amount:string,date:string,reason:string){
 const original=(await db.query<Row>('SELECT * FROM vat_reference_events WHERE source_kind=$1 AND source_id=$2 AND original_event_id IS NULL FOR UPDATE',[kind,id])).rows[0];if(!original)return;
 if((await db.query('SELECT id FROM vat_reference_events WHERE event_key=$1',[eventKey])).rows.length)return;
 const prior=new Money(String((await db.query('SELECT COALESCE(-sum(basis_amount),0)::text amount FROM vat_reference_events WHERE original_event_id=$1',[original.id])).rows[0].amount));
 const selected=Money.min(new Money(amount),new Money(original.basis_amount).minus(prior));if(selected.lte(0))return;
 if(date<(original.effective_date instanceof Date?original.effective_date.toISOString():String(original.effective_date)).slice(0,10))throw new Error('VAT reference reversal date precedes its original transaction.');
 const after=prior.plus(selected),vat=new Money(extractReference(after.toFixed())).minus(extractReference(prior.toFixed()));
 await db.query(`INSERT INTO vat_reference_events(event_key,direction,source_kind,source_id,source_number,effective_date,basis_amount,vat_amount,original_event_id,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[eventKey,original.direction,kind,id,original.source_number,date,selected.negated().toFixed(6),vat.negated().toFixed(2),original.id,reason,actor.id]);
}
export async function vatReferenceSummary(actor:Actor,from:string,to:string){z.iso.date().parse(from);z.iso.date().parse(to);if(from>to)throw new Error('Start date must not be after end date.');return transaction(async db=>{actor=await freshActor(db,actor.id);need(actor,'vat.reference');const rows=(await db.query<Row>('SELECT v.*,u.name actor_name FROM vat_reference_events v JOIN users u ON u.id=v.actor_id WHERE effective_date BETWEEN $1 AND $2 ORDER BY effective_date,created_at,id',[from,to])).rows;const sum=(direction:string)=>rows.filter(r=>r.direction===direction).reduce((n,r)=>n.plus(r.vat_amount),new Money(0));const input=sum('Input'),output=sum('Output');return {rows,input:input.toFixed(2),output:output.toFixed(2),difference:output.minus(input).toFixed(2)};});}
