import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {query,transaction,closeDB} from '../lib/db';
import {migrate} from '../lib/migrations';
import {hashPassword} from '../lib/password';
import {saveMaster,getMaster} from '../lib/masters';
import {saveUser} from '../lib/users';
import {postMovement,stockBalances,movementHistory} from '../lib/inventory';
import {pricingIndicators} from '../lib/pricing';
import {inventoryResponse} from '../lib/inventory-api';
import {authenticate} from '../lib/sessions';
import type {Actor} from '../lib/permissions';
let directory:string;
const owner:Actor={id:randomUUID(),name:'TEST Stage 2 Owner',email:'stage2-owner@example.test',roles:['PRESIDENT_ADMIN']};
const product={sku:'TEST-S2-WIRE',name:'TEST Wire',brand:'Imperial TEST',category:'Cable',primary_uom:'ROLL',secondary_uom:'METER',conversion:'150',base_price:'900',supplier_adjustment:'0',standard_cost:'900',vat_status:'VAT',vat_rate:'0.12',retail_price:'1200',contractor_price:'1100',wholesale_price:'1000',meter_price:'8',reorder_level:'1',supplier_id:'',notes:'TEST ONLY',active:true};
const password='TEST Stage2 password long';
let pid:string,warehouse:Actor,purchasing:Actor;
const receipt=(extra:Record<string,unknown>={})=>({request_id:randomUUID(),product_id:pid,kind:'IN',occurred_at:'2026-01-01T08:00:00+08:00',quantity:'2',uom:'ROLL',unit_cost:'900',reference:'TEST receipt',notes:'TEST',...extra});
const balance=async()=> (await stockBalances(owner,{product:pid}))[0];
async function employee(roles:Actor['roles'],email:string){const a={name:'TEST '+email,email:email+'@example.test',roles,active:true,password};return {...a,id:await saveUser(owner,a)};}
test('Stage 2 products and inventory',async t=>{
 delete process.env.DATABASE_URL;directory=await mkdtemp(join(tmpdir(),'imperial-stage2-'));process.env.LOCAL_DB_PATH=directory;await migrate();await migrate();
 await transaction(async db=>{await db.query("SELECT set_config('imperial.actor_id',$1,true)",[owner.id]);await db.query('INSERT INTO users(id,name,email,password_hash,roles) VALUES($1,$2,$3,$4,$5)',[owner.id,owner.name,owner.email,await hashPassword(password),owner.roles]);});
 warehouse=await employee(['WAREHOUSE'],'stage2-warehouse');purchasing=await employee(['PURCHASING'],'stage2-purchasing');
 await t.test('product notes, duplicate SKU, estimated pricing and zero denominators',async()=>{
  pid=await saveMaster(owner,'products',product);const p=await getMaster(owner,'products',pid);assert.equal(p.notes,'TEST ONLY');assert.equal(p.estimated_profit,'300.00');assert.equal(p.markup_percent,'33.33');assert.equal(p.profit_margin_percent,'25.00');
  assert.equal(pricingIndicators({standard_cost:'0',retail_price:'0'}).profit_margin_percent,null);
  await assert.rejects(saveMaster(owner,'products',{...product,sku:product.sku.toLowerCase()}),/already exists/);
  const restricted=await getMaster(warehouse,'products',pid);assert(!('estimated_profit'in restricted));assert(!('standard_cost'in restricted));
 });
 await t.test('zero stock, threshold low-stock and inactive filtering',async()=>{assert.equal((await balance()).available,'0');assert.equal((await balance()).low_stock,true);assert.equal((await stockBalances(owner,{low:'true'})).length,1);});
 let receiptId:string;
 await t.test('receipt is atomic, converts rolls to meters and values entered units',async()=>{
  const input=receipt();receiptId=await postMovement(purchasing,input);assert.equal(await postMovement(purchasing,input),receiptId);
  await assert.rejects(postMovement(purchasing,{...input,quantity:'3'}),/already used/);
  const b=await balance();assert.equal(b.available,'300.000000');assert.equal(b.inventory_value,'1800.000000');assert.equal(b.low_stock,false);
  assert.equal((await movementHistory(owner)).length,1);
  const audit=(await query("SELECT * FROM audit_log WHERE entity='inventory_movements' AND record_id=$1",[receiptId])).rows[0];assert.equal(audit.actor_id,purchasing.id);assert.equal(audit.actor_name,purchasing.name);
 });
 await t.test('meter receipt, weighted-average issue and threshold alert without FIFO',async()=>{
  await postMovement(owner,receipt({quantity:'150',uom:'METER',unit_cost:'12'}));
  await postMovement(owner,receipt({kind:'OUT',quantity:'300',uom:'METER',unit_cost:undefined}));
  const b=await balance();assert.equal(b.available,'150.000000');assert.equal(b.stock_in,'450.000000');assert.equal(b.stock_out,'300.000000');assert.equal(b.inventory_value,'1200.000000');assert.equal(b.low_stock,true);
 });
 await t.test('invalid unit, fractional count, precision, negative and future input rejection',async()=>{
  for(const extra of [{uom:'PCS'},{quantity:'0'},{quantity:'-1'},{quantity:'1.5'},{quantity:'0.0000001',uom:'METER'},{unit_cost:'-2'},{occurred_at:'2099-01-01T00:00:00Z'},{actor_id:owner.id}])await assert.rejects(postMovement(owner,receipt(extra)));
  await assert.rejects(postMovement(owner,receipt({kind:'OUT',quantity:'151',uom:'METER',unit_cost:undefined})),/Insufficient/);
  await assert.rejects(postMovement(owner,receipt({kind:'OUT'})),/server/);
 });
 await t.test('simultaneous issues cannot oversell, complete depletion has zero remaining value',async()=>{
  const results=await Promise.allSettled([postMovement(owner,receipt({kind:'OUT',quantity:'100',uom:'METER',unit_cost:undefined})),postMovement(owner,receipt({kind:'OUT',quantity:'100',uom:'METER',unit_cost:undefined}))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  await postMovement(owner,receipt({kind:'OUT',quantity:'50',uom:'METER',unit_cost:undefined}));assert.equal((await balance()).inventory_value,'0.000000');
 });
 await t.test('product rename preserves snapshots; stocked UOM cannot be changed; history immutable',async()=>{
  await saveMaster(owner,'products',{...product,name:'TEST Renamed Wire',notes:'Updated'},pid,1);
  assert.equal((await movementHistory(owner,{product:pid}))[0].product_name,'TEST Wire');assert.equal((await balance()).name,'TEST Renamed Wire');
  await assert.rejects(saveMaster(owner,'products',{...product,conversion:'100'},pid,2),/locked/);
  await assert.rejects(query('UPDATE inventory_movements SET quantity=1 WHERE id=$1',[receiptId]),/deletion/);await assert.rejects(query('DELETE FROM inventory_movements WHERE id=$1',[receiptId]),/deletion/);
 });
 await t.test('PCS and BOX quantities stay separate; configured BOX to PCS conversion works',async()=>{
  const pcs=await saveMaster(owner,'products',{...product,sku:'TEST-S2-PCS',primary_uom:'PCS',secondary_uom:'',conversion:''});
  const box=await saveMaster(owner,'products',{...product,sku:'TEST-S2-BOX',primary_uom:'BOX',secondary_uom:'PCS',conversion:'12'});
  await postMovement(owner,receipt({product_id:pcs,uom:'PCS',quantity:'5',unit_cost:'2'}));await postMovement(owner,receipt({product_id:box,uom:'BOX',quantity:'2',unit_cost:'24'}));
  assert.equal((await stockBalances(owner,{product:pcs}))[0].available,'5.000000');assert.equal((await stockBalances(owner,{product:box}))[0].available,'24.000000');
  await assert.rejects(postMovement(owner,receipt({product_id:pcs,uom:'METER'})),/not configured/);
 });
 await t.test('server projections, forged roles and individual denials are enforced',async()=>{
  const b=(await stockBalances(warehouse,{product:pid}))[0];assert(!('inventory_value'in b));const h=(await movementHistory(warehouse))[0];for(const field of ['unit_cost','total_cost','supplier_id','supplier_name'])assert(!(field in h));
  await assert.rejects(postMovement({...warehouse,roles:['PRESIDENT_ADMIN']},receipt()),/permission/);
  await saveUser(owner,{name:purchasing.name,email:purchasing.email,roles:purchasing.roles,active:true,password:'',permission_overrides:{'products.cost':'deny'}},purchasing.id,1);
  await assert.rejects(postMovement(purchasing,receipt()),/permission/);assert(!('inventory_value'in (await stockBalances(purchasing))[0]));
 });
 await t.test('direct API refuses anonymous/denied/disabled users and never returns protected fields',async()=>{
  assert.equal((await inventoryResponse(new Request('http://localhost/api/inventory'))).status,401);
  const token=await authenticate(warehouse.email,password);assert(token);
  const req=(view:string)=>new Request(`http://localhost/api/inventory?view=${view}&product=${pid}`,{headers:{cookie:`imperial_session=${token}`}});
  for(const view of ['balances','history','product']){const res=await inventoryResponse(req(view));assert.equal(res.status,200);const body=await res.text();for(const key of ['inventory_value','unit_cost','total_cost','standard_cost','estimated_profit','markup_percent','profit_margin_percent','retail_price'])assert(!body.includes('"'+key+'"'));}
  await saveUser(owner,{name:warehouse.name,email:warehouse.email,roles:warehouse.roles,active:true,password:'',permission_overrides:{'inventory.read':'deny'}},warehouse.id,1);
  const token2=await authenticate(warehouse.email,password);assert(token2);
  assert.equal((await inventoryResponse(new Request('http://localhost/api/inventory',{headers:{cookie:`imperial_session=${token2}`}}))).status,403);
  await saveUser(owner,{name:warehouse.name,email:warehouse.email,roles:warehouse.roles,password:'',active:false},warehouse.id,2);
  assert.equal((await inventoryResponse(new Request('http://localhost/api/inventory',{headers:{cookie:`imperial_session=${token2}`}}))).status,401);
  await assert.rejects(movementHistory(warehouse),/permission/);
 });
 await t.test('Owner-configured shared roles and separate valuation grants remain effective',async()=>{
  const second=await employee(['WAREHOUSE'],'stage2-warehouse-second');
  await saveUser(owner,{name:second.name,email:second.email,roles:second.roles,active:true,password:'',permission_overrides:{'products.cost':'allow','inventory.receive':'allow','inventory.value':'deny'}},second.id,1);
  await postMovement(second,receipt({quantity:'1',uom:'METER',unit_cost:'1'}));
  assert(!('inventory_value' in (await stockBalances(second,{product:pid}))[0]));
  const token=await authenticate(owner.email,password);assert(token);
  const response=await inventoryResponse(new Request(`http://localhost/api/inventory?product=${pid}`,{headers:{cookie:`imperial_session=${token}`}}));
  assert.equal(response.status,200);assert('inventory_value' in (await response.json()).data[0]);
  await postMovement(owner,receipt({kind:'OUT',quantity:'1',uom:'METER',unit_cost:undefined}));
 });
 await t.test('inventory remains operational with external fetch unavailable',async()=>{
  const fetchBefore=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('External fetch unavailable');};
  try{await postMovement(owner,receipt({quantity:'1',uom:'METER',unit_cost:'2'}));assert.equal((await balance()).available,'1.000000');await postMovement(owner,receipt({kind:'OUT',quantity:'1',uom:'METER',unit_cost:undefined}));}finally{globalThis.fetch=fetchBefore;}
 });
 await t.test('inactive products reject stock; history and audit survive database restart',async()=>{
  await saveMaster(owner,'products',{...product,active:false},pid,2);await assert.rejects(postMovement(owner,receipt()),/active product/);
  assert.equal((await stockBalances(owner,{product:pid,low:'true'})).length,0);
  const before=await movementHistory(owner,{product:pid}),audits=(await query('SELECT count(*) AS n FROM audit_log')).rows[0].n;
  await closeDB();await migrate();assert.deepEqual(await movementHistory(owner,{product:pid}),before);assert.equal((await query('SELECT count(*) AS n FROM audit_log')).rows[0].n,audits);assert.equal((await balance()).available,'0.000000');
 });
});
after(async()=>{await closeDB();if(directory)await rm(directory,{recursive:true,force:true});});
