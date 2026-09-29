import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {migrate} from '../lib/migrations';
import {query,transaction,closeDB,type DB} from '../lib/db';
import {hashPassword} from '../lib/password';
import {saveMaster} from '../lib/masters';
import {saveUser} from '../lib/users';
import {postMovement,stockBalances} from '../lib/inventory';
import {createReturn,changeReturn,getReturn,listReturns,cancelDraftSale} from '../lib/returns';
import {returnsResponse} from '../lib/returns-api';
import {authenticate,resolveSession} from '../lib/sessions';
import {saveReturnPolicy,returnPolicies} from '../lib/sales-options';
import {calculateSaleLine} from '../lib/sales-calculations';
import {allows,type Actor,type Permission} from '../lib/permissions';
import {stamp} from '../lib/sales-common';
let directory:string;
const password='TEST return password long';
const owner:Actor={id:randomUUID(),name:'TEST Returns Owner',email:'returns-owner@example.test',roles:['PRESIDENT_ADMIN']};
const config={standard_rate:'0.12',version:1,effective_at:'2026-01-01T00:00:00Z'};
const product={sku:'TEST-RETURN',name:'TEST Return Breaker',brand:'TEST',category:'Breaker',primary_uom:'PCS',secondary_uom:'',conversion:'',base_price:'500',supplier_adjustment:'0',standard_cost:'500',vat_status:'VAT',vat_rate:'0.12',retail_price:'700',contractor_price:'700',wholesale_price:'700',meter_price:'0',reorder_level:'1',supplier_id:'',notes:'TEST ONLY',active:true};
let pid:string,sale:string,line:string,secondLine:string,stockOut:string,ret:string,session:string,restricted:Actor;
async function insert(db:DB,table:string,row:Record<string,unknown>){const keys=Object.keys(row);return (await db.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING id`,Object.values(row))).rows[0].id as string;}
const request=(qty='2',extra:Record<string,unknown>={})=>({request_id:randomUUID(),sale_id:sale,reason:'TEST Customer return',requested_at:'2026-02-02T00:00:00Z',platform_case_reference:'TEST-CASE-007',lines:[{sale_line_id:line,quantity:qty}],...extra});
async function action(id:string,operation:string,extra:Record<string,unknown>={}){const r=await getReturn(owner,id);return changeReturn(owner,{id,request_id:randomUUID(),version:r.version,action:operation,...extra});}
async function receive(id:string){await action(id,'approve');await action(id,'receive',{received_at:'2026-02-03T00:00:00Z'});}
async function inspect(id:string,condition:string){const r=await getReturn(owner,id);await action(id,'inspect',{conditions:r.lines.map((l:{id:string})=>({line_id:l.id,condition,notes:'TEST inspection'}))});}
const balance=async()=> (await stockBalances(owner,{product:pid}))[0];
test('Stage 3 Returns database, workflow and API',async t=>{
 delete process.env.DATABASE_URL;directory=await mkdtemp(join(tmpdir(),'imperial-returns-'));process.env.LOCAL_DB_PATH=directory;await migrate();await migrate();
 await transaction(async db=>{await stamp(db,owner);await insert(db,'users',{id:owner.id,name:owner.name,email:owner.email,password_hash:await hashPassword(password),roles:owner.roles});});
 pid=await saveMaster(owner,'products',product);
 await postMovement(owner,{request_id:randomUUID(),product_id:pid,kind:'IN',occurred_at:'2026-01-01T00:00:00Z',quantity:'20',uom:'PCS',unit_cost:'500',reference:'TEST receipt'});
 stockOut=await postMovement(owner,{request_id:randomUUID(),product_id:pid,kind:'OUT',occurred_at:'2026-02-01T00:00:00Z',quantity:'10',uom:'PCS',reference:'TEST original sale'});
 const secondOut=await postMovement(owner,{request_id:randomUUID(),product_id:pid,kind:'OUT',occurred_at:'2026-02-01T00:00:00Z',quantity:'2',uom:'PCS',reference:'TEST second line'});
 // Isolated Posted Sale fixture; lifecycle tests for Sale entry/posting are separate.
 await transaction(async db=>{
  await stamp(db,owner);const platform=(await db.query("SELECT id,name FROM sales_options WHERE kind='platform' AND code='shopee'")).rows[0];
  sale=await insert(db,'sales',{request_id:randomUUID(),channel:'Online',occurred_at:'2026-02-01T00:00:00Z',customer_snapshot:JSON.stringify({name:'TEST Walk-in'}),platform_id:platform.id,platform_snapshot:JSON.stringify(platform),online_reference:'TEST-ORDER-001',creation_hash:'fixture',terms:'Cash',tax_config:JSON.stringify(config),created_by:owner.id,actor_name:owner.name});
  for(const [position,quantity,movement] of [[1,'10',stockOut],[2,'2',secondOut]] as const){
   const amounts=calculateSaleLine('700',quantity,'0','VAT Exclusive','VATable',config);
   const id=await insert(db,'sale_lines',{sale_id:sale,position,product_id:pid,product_name:product.name,sku:product.sku,brand:product.brand,category:product.category,quantity,uom:'PCS',stock_quantity:quantity,stock_uom:'PCS',conversion:'1',entered_price:amounts.entered_price,vat_mode:'VAT Exclusive',tax_treatment:'VATable',discount_percent:'0',subtotal:amounts.subtotal,discount_amount:amounts.discount_amount,entered_amount:amounts.entered_amount,vat_snapshot:JSON.stringify(amounts.vat_snapshot),net_amount:amounts.net_amount,vat_amount:amounts.vat_amount,gross_amount:amounts.gross_amount,movement_id:movement,cogs:position===1?'5000':'1000',profit:position===1?'2000':'400',cost_snapshot:JSON.stringify({method:'weighted-average',historical:true})});
   if(position===1)line=id;else secondLine=id;
  }
  const series=(await db.query("SELECT id FROM sales_options WHERE kind='si_series'")).rows[0];
  await insert(db,'sale_documents',{sale_id:sale,kind:'SI',status:'Assigned',series_id:series.id,number:'000125'});
  await db.query("UPDATE sales SET status='Posted',posted_by=$1,posted_at=now() WHERE id=$2",[owner.id,sale]);
 });
 const original=(await query('SELECT to_jsonb(l) AS snapshot FROM sale_lines l WHERE id=$1',[line])).rows[0].snapshot;
 const originalMovement=(await query('SELECT to_jsonb(m) AS snapshot FROM inventory_movements m WHERE id=$1',[stockOut])).rows[0].snapshot;
 const docs=(await query('SELECT to_jsonb(d) AS snapshot FROM sale_documents d WHERE sale_id=$1',[sale])).rows;
 await t.test('stable return number, online references, idempotence and pending requests do not move stock',async()=>{
  const input=request();ret=await createReturn(owner,input);assert.equal(await createReturn(owner,input),ret);
  await assert.rejects(createReturn(owner,{...input,reason:'Different reason'}),/already used/);
  const r=await getReturn(owner,ret);assert.equal(r.number,'RTN-000001');assert.equal(r.platform_order_reference,'TEST-ORDER-001');assert.equal(r.platform_case_reference,'TEST-CASE-007');assert.equal(r.refund_status,'Not recorded');assert.equal((await balance()).available,'8.000000');
  await assert.rejects(createReturn(owner,request('2',{lines:[{sale_line_id:line,quantity:'2'},{sale_line_id:line,quantity:'1'}]})),/Combine/);
  await assert.rejects(createReturn(owner,request('1.5')),/quantity/);
 });
 await t.test('partial sellable return restores only original cost and stock; repeat restock is safe',async()=>{
  await receive(ret);await inspect(ret,'Sellable');
  await saveMaster(owner,'products',{...product,name:'TEST Renamed Breaker',base_price:'999',standard_cost:'999'},pid,1);
  await transaction(async db=>{await stamp(db,owner);await db.query("UPDATE tax_settings SET standard_rate='0.15',version=version+1,updated_at=now(),updated_by=$1,reason='TEST changed rate'",[owner.id]);});
  const r=await getReturn(owner,ret);const data={request_id:randomUUID(),id:ret,version:r.version,action:'restock'};
  await changeReturn(owner,data);await changeReturn(owner,data);await action(ret,'complete');
  assert.equal((await balance()).available,'10.000000');assert.equal((await balance()).inventory_value,'5000.000000');
  const finished=await getReturn(owner,ret);assert.equal(finished.lines[0].historical_cogs,'1000.000000');assert.equal(finished.lines[0].vat_amount,'0.00');assert.equal(finished.lines[0].original_vat_snapshot.policy,'ENTERED_AMOUNTS_NO_VAT_V1');assert.equal(finished.refund_status,'Not recorded');
  assert.equal((await query('SELECT count(*)::int AS n FROM inventory_movements WHERE request_id=$1',[finished.lines[0].id])).rows[0].n,1);
 });
 await t.test('inspection can reject physically received goods without stock or economic acceptance',async()=>{
  const id=await createReturn(owner,request('2'));const before=await balance();await receive(id);await inspect(id,'Defective');
  let r=await getReturn(owner,id);assert.equal(r.lines[0].accepted,false);assert.equal(r.lines[0].historical_cogs,null);
  await action(id,'reject',{reason:'TEST inspection rejected the request'});r=await getReturn(owner,id);assert.equal(r.status,'Rejected');assert.deepEqual(await balance(),before);assert.equal(r.lines[0].accepted,false);assert.equal(r.lines[0].movement_id,null);
 });
 await t.test('damaged multi-line return consumes allowance but does not restock',async()=>{
  const id=await createReturn(owner,request('3',{lines:[{sale_line_id:line,quantity:'3'},{sale_line_id:secondLine,quantity:'1'}]}));await receive(id);await inspect(id,'Damaged');await assert.rejects(action(id,'restock'),/no sellable/);await action(id,'complete');
  assert.equal((await balance()).available,'10.000000');const r=await getReturn(owner,id);assert.equal(r.lines.length,2);assert(r.lines.every((l:{movement_id:string|null})=>!l.movement_id));
 });
 await t.test('concurrent accepted returns cannot exceed remaining original quantities',async()=>{
  const a=await createReturn(owner,request('4')),b=await createReturn(owner,request('4'));await action(a,'approve');await action(b,'approve');
  const results=await Promise.allSettled([action(a,'receive',{received_at:'2026-02-03T00:00:00Z'}),action(b,'receive',{received_at:'2026-02-03T00:00:00Z'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const total=(await query("SELECT sum(l.quantity)::text AS quantity FROM sale_return_lines l JOIN sale_returns r ON r.id=l.return_id WHERE l.sale_line_id=$1 AND (l.accepted OR r.status IN ('Received','Inspected','Restocked'))",[line])).rows[0];assert.equal(total.quantity,'9.000000');
  const accepted=results[0].status==='fulfilled'?a:b;await assert.rejects(action(accepted,'cancel',{reason:'Not allowed'}),/not available/);await inspect(accepted,'Defective');await action(accepted,'complete');
  const final=await createReturn(owner,request('1'));await receive(final);await inspect(final,'Sellable');await action(final,'restock');await action(final,'complete');
  const excess=await createReturn(owner,request('1'));await action(excess,'approve');await assert.rejects(action(excess,'receive',{received_at:'2026-02-03T00:00:00Z'}),/remaining/);
 });
 await t.test('original stock-out, Sale snapshots and controlled documents remain identical',async()=>{
  assert.deepEqual((await query('SELECT to_jsonb(l) AS snapshot FROM sale_lines l WHERE id=$1',[line])).rows[0].snapshot,original);
  assert.deepEqual((await query('SELECT to_jsonb(m) AS snapshot FROM inventory_movements m WHERE id=$1',[stockOut])).rows[0].snapshot,originalMovement);
  assert.deepEqual((await query('SELECT to_jsonb(d) AS snapshot FROM sale_documents d WHERE sale_id=$1',[sale])).rows,docs);
  await assert.rejects(query('DELETE FROM sale_returns WHERE id=$1',[ret]));
  await assert.rejects(query('UPDATE sale_return_lines SET accepted=false WHERE return_id=$1',[ret]),/immutable/);
 });
 await t.test('return searches, audit identity, rejected and cancelled requests',async()=>{
  for(const q of ['RTN-000001','TEST-ORDER-001','TEST-CASE-007','TEST Return Breaker','TEST Walk-in'])assert((await listReturns(owner,{q})).length>0);
  const r=await getReturn(owner,ret);assert.deepEqual(r.events.map((e:{action:string})=>e.action).sort(),['approve','complete','create','inspect','receive','restock'].sort());assert(r.events.every((e:{actor_name:string})=>e.actor_name===owner.name));
  for(const operation of ['reject','cancel']){const id=await createReturn(owner,request('1',{lines:[{sale_line_id:secondLine,quantity:'1'}]}));await action(id,operation,{reason:'TEST '+operation});await assert.rejects(action(id,'approve'),/not available/);}
  assert((await query("SELECT id FROM audit_log WHERE entity='sale_return_lines' AND actor_id=$1",[owner.id])).rows.length>0);
 });
 await t.test('permission grants are configurable; forged roles and direct API values stay protected',async()=>{
  const overrides={'sales.read':'allow','returns.read':'allow'} as const;
  restricted={id:await saveUser(owner,{name:'TEST Return employee',email:'return-employee@example.test',roles:['WAREHOUSE'],active:true,password,permission_overrides:overrides}),name:'TEST Return employee',email:'return-employee@example.test',roles:['WAREHOUSE'],permission_overrides:overrides};
  await assert.rejects(createReturn({...restricted,roles:['PRESIDENT_ADMIN']},request()),/permission/);
  const payload=await getReturn(restricted,ret);for(const key of ['historical_cogs','net_amount','vat_amount','original_vat_snapshot','original_cost_snapshot'])assert(!(key in payload.lines[0]));
  session=(await authenticate(restricted.email,password))!;
  const url='http://localhost/api/returns?id='+ret,headers={cookie:'imperial_session='+session};
  assert.equal((await returnsResponse(new Request(url))).status,401);
  const result=await returnsResponse(new Request(url,{headers}));assert.equal(result.status,200);assert(!(await result.text()).includes('historical_cogs'));
  const denied=await returnsResponse(new Request('http://localhost/api/returns',{method:'POST',headers:{...headers,origin:'http://localhost'},body:JSON.stringify({operation:'create',data:request()})}));assert.equal(denied.status,403);
  assert.equal((await returnsResponse(new Request(url,{method:'POST',headers:{...headers,origin:'http://evil.test'},body:'{}'}))).status,403);
  assert.equal(allows({...restricted,permission_overrides:{...overrides,'returns.financial':'allow'}},'returns.financial'),false);
  for(const permission of ['returns.create','returns.approve','returns.receive','returns.condition','returns.restock','returns.reject','returns.complete'] as Permission[])assert.equal(allows({...restricted,permission_overrides:{...overrides,[permission]:'allow'}},permission),true);
 });
 await t.test('platform return policies are configurable, snapshotted and Owner-only',async()=>{
  const platform=(await query("SELECT id FROM sales_options WHERE kind='platform' AND code='shopee'")).rows[0].id;
  const input={platform_id:platform,previous_version:0,window_days:14,starts_from:'Delivery',notes:'TEST reference policy only',effective_at:'2026-01-01T00:00:00Z'};
  await assert.rejects(saveReturnPolicy({...restricted,roles:['PRESIDENT_ADMIN']},input),/Only Owner/);
  await saveReturnPolicy(owner,input);const id=await createReturn(owner,request('1',{lines:[{sale_line_id:secondLine,quantity:'1'}]}));
  await saveReturnPolicy(owner,{...input,previous_version:1,window_days:30});assert.equal((await getReturn(owner,id)).return_policy_snapshot.window_days,14);assert.equal((await returnPolicies(owner)).length,2);
  assert.equal((await getReturn(owner,ret)).return_policy_snapshot,null);
  assert.equal((await listReturns(owner,{from:'2099-01-01'})).length,0);assert((await listReturns(owner,{platform:String(platform),from:'2026-02-01',to:'2026-02-28'})).length>0);
 });
 await t.test('posted cancellation reverses only remaining quantities and retains original Sale',async()=>{
  await assert.rejects(createReturn(owner,request('1',{kind:'Cancellation'})),/every remaining/);
  const cancellation=await createReturn(owner,request('1',{kind:'Cancellation',lines:[{sale_line_id:secondLine,quantity:'1'}]}));
  const before=await balance();await receive(cancellation);await inspect(cancellation,'Sellable');await action(cancellation,'restock');await action(cancellation,'complete');
  assert.equal(Number((await balance()).available),Number(before.available)+1);
  const reversal=(await query('SELECT * FROM sale_reversals WHERE sale_id=$1',[sale])).rows[0];assert.equal(reversal.return_id,cancellation);
  assert.equal((await query('SELECT status FROM sales WHERE id=$1',[sale])).rows[0].status,'Posted');
  await assert.rejects(createReturn(owner,request()),/already been reversed/);
  assert.deepEqual((await query('SELECT to_jsonb(d) AS snapshot FROM sale_documents d WHERE sale_id=$1',[sale])).rows,docs);
 });
 await t.test('Draft cancellation never posts stock or COGS and is idempotent',async()=>{
  const draft=await transaction(async db=>{await stamp(db,owner);return insert(db,'sales',{request_id:randomUUID(),channel:'Retail',occurred_at:'2026-02-01T00:00:00Z',customer_snapshot:JSON.stringify({name:'Walk-in'}),creation_hash:'draft-fixture',terms:'Cash',tax_config:JSON.stringify(config),created_by:owner.id,actor_name:owner.name});});
  const before=await balance(),input={id:draft,request_id:randomUUID(),version:1,reason:'TEST order cancelled'};
  await cancelDraftSale(owner,input);await cancelDraftSale(owner,input);assert.deepEqual(await balance(),before);
  const r=(await query('SELECT status,cogs,posted_at FROM sales WHERE id=$1',[draft])).rows[0];assert.equal(r.status,'Cancelled');assert.equal(r.cogs,null);assert.equal(r.posted_at,null);
  await assert.rejects(cancelDraftSale(owner,{...input,id:sale,request_id:randomUUID()}),/controlled/);
 });
 await t.test('restart preserves returns, original documents, stock, audit and sessions; disabled user rejected',async()=>{
  const before=await getReturn(owner,ret),stock=await balance();await closeDB();assert(await resolveSession(session));assert.deepEqual(await getReturn(owner,ret),before);assert.deepEqual(await balance(),stock);
  await saveUser(owner,{name:restricted.name,email:restricted.email,roles:restricted.roles,active:false,password:''},restricted.id,1);
  assert.equal((await returnsResponse(new Request('http://localhost/api/returns',{headers:{cookie:'imperial_session='+session}}))).status,401);
 });
});
after(async()=>{await closeDB();if(directory)await rm(directory,{recursive:true,force:true});});
