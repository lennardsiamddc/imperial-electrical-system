// Isolated browser fixture only. Never point this script at the operational database.
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {migrate} from '../lib/migrations';
import {transaction,closeDB} from '../lib/db';
import {hashPassword} from '../lib/password';
import {saveMaster} from '../lib/masters';
import {saveUser} from '../lib/users';
import {postMovement} from '../lib/inventory';
import type {Actor} from '../lib/permissions';
async function main(){
 if(process.env.DATABASE_URL||process.env.NODE_ENV==='production')throw new Error('Local isolated acceptance only.');
 const root=await mkdtemp(join(tmpdir(),'imperial-stage22-browser-'));process.env.LOCAL_DB_PATH=join(root,'db');await migrate();
 const owner:Actor={id:randomUUID(),name:'TEST UI Owner',email:'owner@ui.test',roles:['PRESIDENT_ADMIN']},password=randomBytes(18).toString('base64url');
 await transaction(async db=>{await db.query("SELECT set_config('imperial.actor_id',$1,true)",[owner.id]);await db.query('INSERT INTO users(id,name,email,password_hash,roles) VALUES($1,$2,$3,$4,$5)',[owner.id,owner.name,owner.email,await hashPassword(password),owner.roles]);});
 await saveUser(owner,{name:'TEST Stock Employee',email:'stock@ui.test',password,roles:['WAREHOUSE'],active:true,permission_overrides:{'products.cost':'allow','inventory.receive':'allow','inventory.value':'allow'}});
 await saveUser(owner,{name:'TEST Restricted Employee',email:'staff@ui.test',password,roles:['WAREHOUSE'],active:true});
 const product=await saveMaster(owner,'products',{sku:'TEST-UI22-WIRE',name:'TEST Imperial Wire',brand:'Phelps Test Brand',category:'Wire',primary_uom:'ROLL',secondary_uom:'METER',conversion:'150',base_price:'0',supplier_adjustment:'0',standard_cost:'500',vat_status:'VAT',vat_rate:'0.12',retail_price:'700',contractor_price:'0',wholesale_price:'0',meter_price:'',reorder_level:'3',supplier_id:'',notes:'Isolated browser acceptance',active:true,cost_tax_treatment:'VATable',cost_entry_mode:'VAT Exclusive',cost_input_vat_recoverable:true,selling_tax_treatment:'VATable',selling_entry_mode:'VAT Exclusive'});
 await postMovement(owner,{request_id:randomUUID(),product_id:product,kind:'IN',occurred_at:'2026-09-01T00:00:00Z',quantity:'1',uom:'ROLL',unit_cost:'500',reference:'TEST-INITIAL',notes:'Isolated acceptance',cost_tax_treatment:'VATable',cost_entry_mode:'VAT Exclusive',cost_input_vat_recoverable:true});
 await writeFile(join(root,'acceptance.json'),JSON.stringify({root,password,product}),{mode:0o600});console.log(root);
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(closeDB);
