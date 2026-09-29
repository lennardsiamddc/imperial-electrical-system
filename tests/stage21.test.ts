import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {vatBreakdown,taxSnapshot,Money,type VatSnapshot,type EntryMode} from '../lib/vat';
import {query,transaction,closeDB} from '../lib/db';
import {migrate} from '../lib/migrations';
import {hashPassword} from '../lib/password';
import {saveMaster,getMaster} from '../lib/masters';
import {saveUser} from '../lib/users';
import {postMovement,stockBalances,movementHistory} from '../lib/inventory';
import {getTaxSettings,saveTaxSettings} from '../lib/tax-settings';
import {inventoryResponse} from '../lib/inventory-api';
import {authenticate,resolveSession} from '../lib/sessions';
import type {Actor} from '../lib/permissions';
const config={standard_rate:'0.12',version:1,effective_at:'2026-01-01T00:00:00Z'};
test('VAT Inclusive selling price: 1120 = 1000 + 120',()=>{const v=vatBreakdown('1120','VAT Inclusive','VATable','0.12');assert.equal(v.net,'1000.00');assert.equal(v.vat,'120.00');assert.equal(v.gross,'1120.00');});
test('VAT Exclusive selling price: 1000 + 120 = 1120',()=>{const v=vatBreakdown('1000','VAT Exclusive','VATable','0.12');assert.equal(v.net,'1000.00');assert.equal(v.vat,'120.00');assert.equal(v.gross,'1120.00');});
test('VAT Inclusive recoverable acquisition cost: 560 separates 500 and 60',()=>{const v=taxSnapshot('560','VAT Inclusive','VATable',config,true);assert.equal(v.economic_cost,'500.00');assert.equal(v.recoverable_vat,'60.00');assert.equal(v.gross,'560.00');});
test('VAT Exclusive acquisition cost and nonrecoverable VAT',()=>{const v=taxSnapshot('500','VAT Exclusive','VATable',config,false);assert.equal(v.net,'500.00');assert.equal(v.vat,'60.00');assert.equal(v.economic_cost,'560.00');assert.equal(v.recoverable_vat,'0.00');});
test('Zero-Rated and VAT-Exempt preserve distinct treatments with zero applied rate',()=>{for(const treatment of ['Zero-Rated','VAT-Exempt'] as const){const v=taxSnapshot('1120','VAT Inclusive',treatment,config,true);assert.equal(v.treatment,treatment);assert.equal(v.rate,'0.000000');assert.equal(v.configured_rate,'0.120000');assert.equal(v.net,'1120.00');assert.equal(v.vat,'0.00');}});
test('Central HALF_UP centavo and six-decimal rounding, line totals reconcile',()=>{
 assert.equal(vatBreakdown('1.005','VAT Exclusive','VAT-Exempt','0.12').net,'1.01');
 assert.equal(vatBreakdown('0.05','VAT Exclusive','VATable','0.10').vat,'0.01');
 const v=taxSnapshot('0.333333','VAT Inclusive','VATable',config,true,'3',6);assert.equal(v.entered,'0.333333');assert.equal(v.line.gross,'1.00');assert.equal(v.line.net,'0.89');assert.equal(v.line.vat,'0.11');
 for(const amount of ['0','0.01','1.01','19.99','1120','9999999999999999.99'])for(const mode of ['VAT Inclusive','VAT Exclusive'] as const){const b=vatBreakdown(amount,mode,'VATable','0.12');assert(new Money(b.net).plus(b.vat).eq(b.gross));}
 assert.throws(()=>vatBreakdown('-1','VAT Inclusive','VATable','0.12'));assert.throws(()=>vatBreakdown('1','VAT Inclusive','VATable','1.01'));
});
let directory:string;
const owner:Actor={id:randomUUID(),name:'TEST VAT Owner',email:'vat-owner@example.test',roles:['PRESIDENT_ADMIN']};
const password='TEST VAT long password';
const base={sku:'TEST-VAT',name:'TEST VAT Product',brand:'TEST',category:'VAT',primary_uom:'PCS',secondary_uom:'',conversion:'',base_price:'500',supplier_adjustment:'0',standard_cost:'560',vat_status:'VAT',vat_rate:'0.12',retail_price:'1120',contractor_price:'1120',wholesale_price:'1120',meter_price:'',reorder_level:'1',supplier_id:'',notes:'TEST VAT',active:true};
const vat={selling_tax_treatment:'VATable',selling_entry_mode:'VAT Inclusive',cost_tax_treatment:'VATable',cost_entry_mode:'VAT Inclusive',cost_input_vat_recoverable:true};
let pid:string,sales:Actor,warehouse:Actor;
const receipt=(extra:Record<string,unknown>={})=>({request_id:randomUUID(),product_id:pid,kind:'IN',occurred_at:'2026-09-01T00:00:00Z',quantity:'2',uom:'PCS',unit_cost:'560',reference:'TEST VAT RECEIPT',notes:'TEST',cost_tax_treatment:'VATable',cost_entry_mode:'VAT Inclusive',cost_input_vat_recoverable:true,...extra});
const balance=async()=> (await stockBalances(owner,{product:pid}))[0];
test('Stage 2.1 stored VAT and security',async t=>{
 delete process.env.DATABASE_URL;directory=await mkdtemp(join(tmpdir(),'imperial-vat-'));process.env.LOCAL_DB_PATH=directory;await migrate();await migrate();
 await transaction(async db=>{await db.query("SELECT set_config('imperial.actor_id',$1,true)",[owner.id]);await db.query('INSERT INTO users(id,name,email,password_hash,roles) VALUES($1,$2,$3,$4,$5)',[owner.id,owner.name,owner.email,await hashPassword(password),owner.roles]);});
 for(const role of ['SALES','WAREHOUSE'] as const){const user={name:'TEST VAT '+role,email:'vat-'+role+'@example.test',roles:[role],password,active:true};const a={...user,id:await saveUser(owner,user)};if(role==='SALES')sales=a;else warehouse=a;}
 await t.test('all four legacy modes preserve entered amounts for operational profit',async()=>{
  for(const costMode of ['VAT Inclusive','VAT Exclusive'] as EntryMode[])for(const sellingMode of ['VAT Inclusive','VAT Exclusive'] as EntryMode[]){
   const id=await saveMaster(owner,'products',{...base,...vat,sku:randomUUID(),standard_cost:costMode==='VAT Inclusive'?'560':'500',retail_price:sellingMode==='VAT Inclusive'?'1120':'1000',cost_entry_mode:costMode,selling_entry_mode:sellingMode});
   const p=await getMaster(owner,'products',id);assert.equal(p.cost_vat,null);assert.equal(p.selling_vat,null);const c=new Money(costMode==='VAT Inclusive'?'560':'500'),v=new Money(sellingMode==='VAT Inclusive'?'1120':'1000');assert.equal(p.estimated_profit,v.minus(c).toFixed(2));assert.equal(p.markup_percent,v.minus(c).div(c).mul(100).toFixed(2));assert.equal(p.profit_margin_percent,v.minus(c).div(v).mul(100).toFixed(2));
  }
  pid=await saveMaster(owner,'products',{...base,...vat});
 });
 for(const [costMode,costAmount,sellingMode,sellingAmount] of [
  ['VAT Exclusive','500','VAT Exclusive','700'],
  ['VAT Inclusive','560','VAT Exclusive','700'],
  ['VAT Exclusive','500','VAT Inclusive','784'],
  ['VAT Inclusive','560','VAT Inclusive','784'],
 ] as const) await t.test(`entered amounts persist independently: buy ${costAmount} ${costMode}, sell ${sellingAmount} ${sellingMode}`,async()=>{
  const id=await saveMaster(owner,'products',{...base,...vat,sku:randomUUID(),standard_cost:costAmount,retail_price:sellingAmount,cost_entry_mode:costMode,selling_entry_mode:sellingMode});
  await closeDB();
  const p=await getMaster(owner,'products',id),c=p.cost_vat as VatSnapshot,s=p.selling_vat as VatSnapshot;
  assert(new Money(String(p.standard_cost)).eq(costAmount));assert(new Money(String(p.retail_price)).eq(sellingAmount));
  assert.equal(c,null);assert.equal(s,null);assert.equal(p.cost_entry_mode,costMode);assert.equal(p.estimated_profit,new Money(sellingAmount).minus(costAmount).toFixed(2));
 });
 await t.test('configured products cannot silently drop VAT settings or forge computed snapshots',async()=>{
  assert.equal((await getMaster(owner,'products',pid)).cost_entry_mode,'VAT Inclusive');
  await assert.rejects(saveMaster(owner,'products',{...base,...vat,cost_vat:{net:'0'}},pid,1),/permission/);
  // Obsolete treatment/recovery fields are optional; the next receipt verifies tag-only cost.
 });
 let firstInput:ReturnType<typeof receipt>,firstId:string,firstSnapshot:unknown;
 await t.test('receipt preserves supplier tag with full entered cost',async()=>{
  firstInput=receipt({tax_config_version:1});firstId=await postMovement(owner,firstInput);
  const row=(await movementHistory(owner,{product:pid}))[0],v=row.cost_vat as VatSnapshot;firstSnapshot=v;
  assert.equal(v.entered,'560.000000');assert.equal(v.net,'560.000000');assert.equal(v.vat,'0.000000');assert.equal(v.line.gross,'1120.000000');assert.equal(v.line.recoverable_vat,'0.00');assert.equal(row.total_cost,'1120.000000');assert.equal((await balance()).inventory_value,'1120.000000');
  assert.equal((await query('SELECT after_data FROM audit_log WHERE record_id=$1',[firstId])).rows.length,1);
 });
 await t.test('Owner-only Tax Settings, stale-update protection and audit identity',async()=>{
  const c=await getTaxSettings(owner);assert.equal(c.standard_rate,'0.120000');
  await assert.rejects(getTaxSettings(sales),/permission/);await assert.rejects(saveTaxSettings({...sales,roles:['PRESIDENT_ADMIN']},{percent:'10',version:1,reason:'TEST forged'}),/permission/);
  await saveTaxSettings(owner,{percent:'10',version:1,reason:'TEST prospective rate change'});
  await assert.rejects(saveTaxSettings(owner,{percent:'9',version:1,reason:'TEST stale'}),/Reload/);
  const audit=(await query("SELECT * FROM audit_log WHERE entity='tax_settings'")).rows[0];assert.equal(audit.actor_id,owner.id);assert.equal(audit.actor_name,owner.name);assert.equal((audit.before_data as Record<string,unknown>).standard_rate,0.12);assert.equal((audit.after_data as Record<string,unknown>).standard_rate,0.10);
 });
 await t.test('future rate changes cannot rewrite old product or receipt snapshots, retry stays idempotent',async()=>{
  assert.equal(await postMovement(owner,firstInput),firstId);
  assert.equal(await postMovement(owner,{...firstInput,tax_config_version:2}),firstId);
  // Rate changes are irrelevant to new operational costs; the next receipt uses the old version safely.
  assert.deepEqual((await movementHistory(owner,{product:pid})).find(r=>r.id===firstId)?.cost_vat,firstSnapshot);
  assert.equal((await getMaster(owner,'products',pid)).estimated_profit,'560.00');
  await postMovement(owner,receipt({unit_cost:'550',quantity:'1',tax_config_version:2}));
  const newV=(await movementHistory(owner,{product:pid}))[0].cost_vat as VatSnapshot;assert.equal(newV.rate,'0.000000');assert.equal(newV.net,'550.000000');assert.equal(newV.vat,'0.000000');assert.equal((await balance()).inventory_value,'1670.000000');
 });
 await t.test('receipt treatment may differ from Product Master and retains distinct zero/exempt snapshots',async()=>{
  for(const treatment of ['Zero-Rated','VAT-Exempt']){await postMovement(owner,receipt({cost_tax_treatment:treatment,quantity:'1',unit_cost:'100'}));const v=(await movementHistory(owner,{product:pid}))[0].cost_vat as VatSnapshot;assert.equal(v.entered,'100.000000');assert.equal(v.rate,'0.000000');assert.equal(v.vat,'0.000000');}
 });
 await t.test('nonrecoverable VAT remains economic cost; product updates do not change receipt history',async()=>{
  await postMovement(owner,receipt({quantity:'1',unit_cost:'110',cost_input_vat_recoverable:false}));
  assert.equal((await balance()).inventory_value,'1980.000000');
  await saveMaster(owner,'products',{...base,...vat,standard_cost:'550',retail_price:'1100',cost_input_vat_recoverable:false,tax_config_version:2},pid,1);
  const p=await getMaster(owner,'products',pid);assert.equal(p.estimated_profit,'550.00');assert.equal(p.profit_margin_percent,'50.00');
  assert.deepEqual((await movementHistory(owner,{product:pid})).find(r=>r.id===firstId)?.cost_vat,firstSnapshot);
  const audits=(await query("SELECT after_data FROM audit_log WHERE entity='products' AND record_id=$1 ORDER BY created_at DESC",[pid])).rows;assert.equal((audits[0].after_data as Record<string,unknown>).cost_input_vat_recoverable,null);
 });
 await t.test('weighted-average stock-out consumes economic cost and does not create output VAT',async()=>{
  await postMovement(owner,{request_id:randomUUID(),product_id:pid,kind:'OUT',occurred_at:'2026-09-01T00:00:00Z',quantity:'6',uom:'PCS',reference:'TEST VAT issue',notes:''});
  assert.equal((await balance()).inventory_value,'0.000000');assert.equal((await balance()).available,'0.000000');assert.equal((await movementHistory(owner,{product:pid}))[0].cost_vat,null);
 });
 await t.test('cost/input VAT/margin excluded from service and direct API for restricted users',async()=>{
  for(const actor of [sales,warehouse]){
   const p=await getMaster(actor,'products',pid);for(const key of ['cost_vat','cost_tax_treatment','cost_input_vat_recoverable','estimated_profit','standard_cost'])assert(!(key in p));
   const token=await authenticate(actor.email,password);assert(token);
   for(const view of ['product','history','balances']){const response=await inventoryResponse(new Request(`http://localhost/api/inventory?view=${view}&product=${pid}`,{headers:{cookie:`imperial_session=${token}`}}));assert.equal(response.status,200);const body=await response.text();for(const key of ['cost_vat','recoverable_vat','economic_cost','cost_input_vat_recoverable','inventory_value','estimated_profit'])assert(!body.includes('"'+key+'"'),`${actor.roles} ${view} ${key}`);}
  }
  assert.equal((await getMaster(sales,'products',pid)).selling_vat,null);assert(!('selling_vat'in await getMaster(warehouse,'products',pid)));
 });
 await t.test('obsolete VAT configuration cannot affect entered-price profit',async()=>{
  const id=await saveMaster(owner,'products',{...base,sku:'TEST-VAT-PARTIAL',cost_tax_treatment:'VATable',cost_entry_mode:'VAT Inclusive',cost_input_vat_recoverable:true});const p=await getMaster(owner,'products',id);assert.equal(p.estimated_profit,'560.00');
 });
 await t.test('VAT snapshot/settings/audit/session persistence after close and reopen',async()=>{
  const token=await authenticate(owner.email,password);assert(token);
  const snapshots=await movementHistory(owner,{product:pid}),settings=await getTaxSettings(owner),audits=(await query('SELECT count(*) AS n FROM audit_log')).rows[0].n;
  await closeDB();await migrate();assert.equal((await resolveSession(token))?.id,owner.id);assert.deepEqual(await movementHistory(owner,{product:pid}),snapshots);assert.deepEqual(await getTaxSettings(owner),settings);assert.equal((await query('SELECT count(*) AS n FROM audit_log')).rows[0].n,audits);
  const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('No external network');};try{assert.equal(taxSnapshot('110','VAT Inclusive','VATable',settings,true).net,'100.00');assert(await authenticate(owner.email,password));}finally{globalThis.fetch=original;}
 });
});
after(async()=>{await closeDB();if(directory)await rm(directory,{recursive:true,force:true});});
