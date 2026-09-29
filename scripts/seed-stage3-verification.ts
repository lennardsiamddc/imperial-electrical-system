import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {migrate} from '../lib/migrations';
import {transaction,query,closeDB} from '../lib/db';
import {hashPassword} from '../lib/password';
import {saveMaster} from '../lib/masters';
import {saveUser} from '../lib/users';
import {postMovement} from '../lib/inventory';
import {saveSale} from '../lib/sales';
import {stamp} from '../lib/sales-common';
import type {Actor,Overrides} from '../lib/permissions';
async function main(){
if(process.env.DATABASE_URL||!process.env.LOCAL_DB_PATH?.startsWith('/private/tmp/imperial-stage3-browser-'))throw new Error('This fixture requires an isolated Stage 3 browser database.');
await migrate();
if((await query('SELECT id FROM users LIMIT 1')).rows.length)throw new Error('Fixture database must be empty.');
const owner:Actor={id:randomUUID(),name:'TEST Stage 3 Browser Owner',email:'owner-stage3@example.test',roles:['PRESIDENT_ADMIN']};
const password='TEST Stage3 Browser 2026!';
await transaction(async db=>{await stamp(db,owner);await db.query('INSERT INTO users(id,name,email,password_hash,roles) VALUES($1,$2,$3,$4,$5)',[owner.id,owner.name,owner.email,await hashPassword(password),owner.roles]);});
const grants:Overrides={'sales.post':'allow','inventory.issue':'allow','returns.read':'allow','returns.create':'allow','returns.approve':'allow','returns.receive':'allow','returns.condition':'allow','returns.restock':'allow','returns.complete':'allow','returns.reject':'allow','sales.si.assign':'allow','sales.dr.assign':'allow'};
const employee=await saveUser(owner,{name:'TEST Counter Employee',email:'employee-stage3@example.test',password,roles:['SALES'],active:true,permission_overrides:grants});
const restricted=await saveUser(owner,{name:'TEST Restricted Employee',email:'restricted-stage3@example.test',password,roles:['WAREHOUSE'],active:true,permission_overrides:{'sales.read':'allow','returns.read':'allow'}});
const customer=await saveMaster(owner,'customers',{code:'TEST-S3-BROWSER-C001',name:'TEST Stage 3 Construction',customer_type:'Wholesale',contact_person:'TEST Buyer',phone:'',email:'',tin:'TEST-ONLY',notes:'Isolated TEST fixture',billing_address:'TEST Manila',delivery_addresses:'TEST Warehouse',salesperson_id:employee,payment_terms:'30 Days',credit_limit:'0',credit_notes:'',account_status:'Active',active:true});
const lines=[];let first='';
for(let i=0;i<50;i++){
 const id=await saveMaster(owner,'products',{sku:'TEST-S3-BROWSER-'+String(i+1).padStart(3,'0'),name:'TEST Browser Product '+String(i+1).padStart(3,'0'),brand:'Imperial TEST',category:'Electrical',primary_uom:'PCS',secondary_uom:'',conversion:'',base_price:'500',supplier_adjustment:'0',standard_cost:'500',vat_status:'VAT',vat_rate:'0.12',retail_price:'700',contractor_price:'700',wholesale_price:'700',meter_price:'',reorder_level:'2',supplier_id:'',notes:'Isolated browser TEST',active:true,selling_tax_treatment:'VATable',selling_entry_mode:'VAT Exclusive',cost_tax_treatment:'VATable',cost_entry_mode:'VAT Exclusive',cost_input_vat_recoverable:true,tax_config_version:1});
 if(!i)first=id;
 await postMovement(owner,{request_id:randomUUID(),product_id:id,kind:'IN',occurred_at:'2026-01-01T00:00:00Z',quantity:'100',uom:'PCS',unit_cost:'500',reference:'TEST Browser receipt',cost_tax_treatment:'VATable',cost_entry_mode:'VAT Exclusive',cost_input_vat_recoverable:true,tax_config_version:1});
 lines.push({id:randomUUID(),product_id:id,quantity:'1',uom:'PCS',price:'700',vat_mode:'VAT Exclusive',tax_treatment:'VATable',discount:'0'});
}
const sale=await saveSale(owner,{request_id:randomUUID(),channel:'Wholesale',customer_id:customer,occurred_at:'2026-02-01T00:00:00Z',terms:'30 Days',tax_config_version:1,lines,documents:{si:true,dr:true},notes:'TEST 50-product browser verification'});
await writeFile('/private/tmp/imperial-stage3-fixture.json',JSON.stringify({owner:owner.id,employee,restricted,customer,first_product:first,large_sale:sale,password},null,2),{mode:0o600});
await closeDB();console.log('Isolated 50-product Draft and three employee accounts ready.');

}
main().catch(async e=>{console.error(e);await closeDB();process.exitCode=1;});
