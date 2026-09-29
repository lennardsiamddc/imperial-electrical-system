import {transaction} from './db';
import {freshActor} from './masters';
import {assertAllowed,has,canRead,type Actor} from './permissions';
export const auditEntities=['vat_reference_events','quotation_defaults','receivables','collections','collection_allocations','check_events','collection_reversals','ar_adjustments','ar_followups','commercial_documents','commercial_lines','customers','products','suppliers','users','sessions','inventory_movements','tax_settings','sales','sale_lines','sale_payments','sale_documents','sale_document_lines','sale_deliveries','sales_options','sales_document_templates','sale_reversals','sale_reversal_lines','sale_online_settlements','sale_returns','sale_return_lines','sale_return_events','sale_return_refund_links','platform_return_policies'];
export async function listAudit(actor:Actor,entity='',page=1){return transaction(async db=>{
 const current=await freshActor(db,actor.id);assertAllowed(has(current));
 const selected=auditEntities.includes(entity)?entity:'';
 return (await db.query(`SELECT a.*,COALESCE(a.actor_name,u.name) AS actor_name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id
 WHERE ($1='' OR entity=$1) ORDER BY created_at DESC,a.id LIMIT 51 OFFSET $2`,[selected,(Math.max(1,Math.min(100000,page))-1)*50])).rows;
});}
export async function customerActivity(actor:Actor,id:string){return transaction(async db=>{
 const current=await freshActor(db,actor.id);assertAllowed(canRead(current,'customers'));
 return (await db.query("SELECT a.created_at,a.action,COALESCE(a.actor_name,u.name) AS name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id WHERE a.entity='customers' AND a.record_id=$1 ORDER BY a.created_at DESC LIMIT 100",[id])).rows;
});}
