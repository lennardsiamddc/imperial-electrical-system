import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {migrate} from '../lib/migrations';
import {query,transaction,closeDB} from '../lib/db';
import {hashPassword} from '../lib/password';
import {saveMaster} from '../lib/masters';
import {saveUser} from '../lib/users';
import {postMovement,stockBalances} from '../lib/inventory';
import {saveSale,postSale} from '../lib/sales';
import {getSale,listSales,salesLookup,saleDocumentData} from '../lib/sales-read';
import {createReturn,changeReturn,getReturn} from '../lib/returns';
import {salesOptions,saveSalesOption} from '../lib/sales-options';
import {changeSaleDocument} from '../lib/sales-documents';
import {salesResponse} from '../lib/sales-api';
import {authenticate,resolveSession} from '../lib/sessions';
import {stamp} from '../lib/sales-common';
import type {Actor} from '../lib/permissions';
const owner:Actor={id:randomUUID(),name:'TEST Sales Owner',email:'sales-owner@example.test',roles:['PRESIDENT_ADMIN']};
const password='TEST Sales password long';let directory:string,pid:string,retail:string,large:string,employee:Actor,token:string;
const product={sku:'TEST-S3-BASE',name:'TEST Sale Breaker',brand:'TEST',category:'Breaker',primary_uom:'PCS',secondary_uom:'',conversion:'',base_price:'500',supplier_adjustment:'0',standard_cost:'500',vat_status:'VAT',vat_rate:'0.12',retail_price:'700',contractor_price:'700',wholesale_price:'700',meter_price:'0',reorder_level:'1',supplier_id:'',notes:'TEST ONLY',active:true};
const line=(id=pid,quantity='1')=>({id:randomUUID(),product_id:id,quantity,uom:'PCS',price:'700',vat_mode:'VAT Exclusive',tax_treatment:'VATable',discount:'0'});
const draft=(extra:Record<string,unknown>={})=>({request_id:randomUUID(),channel:'Retail',occurred_at:'2026-02-01T00:00:00Z',terms:'Cash',tax_config_version:1,lines:[line()],...extra});
async function receipt(id:string,qty='10'){return postMovement(owner,{request_id:randomUUID(),product_id:id,kind:'IN',occurred_at:'2026-01-01T00:00:00Z',quantity:qty,uom:'PCS',unit_cost:'500',reference:'TEST Stage 3 receipt'});}
const balance=async(id=pid)=> (await stockBalances(owner,{product:id}))[0];
async function post(id:string,actor=owner){const sale=await getSale(actor,id);return postSale(actor,{id,version:sale.version,request_id:randomUUID()});}
test('Stage 3 Sales posting, snapshots and access',async t=>{
 delete process.env.DATABASE_URL;directory=await mkdtemp(join(tmpdir(),'imperial-sales-'));process.env.LOCAL_DB_PATH=directory;await migrate();
 await transaction(async db=>{await stamp(db,owner);await db.query('INSERT INTO users(id,name,email,password_hash,roles) VALUES($1,$2,$3,$4,$5)',[owner.id,owner.name,owner.email,await hashPassword(password),owner.roles]);});
 pid=await saveMaster(owner,'products',product);await receipt(pid);
 await t.test('Draft save/edit/idempotence, EX primary price and no premature stock movements',async()=>{
  const input=draft({lines:[{...line(),discount:'10'}],documents:{si:true,dr:true}});retail=await saveSale(owner,input);assert.equal(await saveSale(owner,input),retail);
  await assert.rejects(saveSale(owner,{...input,notes:'changed'}),/already used/);
  const sale=await getSale(owner,retail);assert.equal(sale.number,'S-000001');assert.equal(sale.lines[0].entered_price,'700.000000');assert.equal(sale.gross_total,'630.00');assert.equal(sale.lines[0].net_amount,'630.00');assert.equal(sale.cogs,null);assert.equal((await balance()).available,'10.000000');
  await saveSale(owner,{...input,id:retail,version:1,request_id:randomUUID(),notes:'TEST revised'});assert.equal((await getSale(owner,retail)).version,2);
  await assert.rejects(saveSale(owner,{...input,id:retail,version:1,request_id:randomUUID()}),/changed/);
 });
 await t.test('controlled SI and DR numbers preserve leading zeros and never alter stock',async()=>{
  const options=await salesOptions(owner),si=options.find(o=>o.kind==='si_series')!,dr=options.find(o=>o.kind==='dr_series')!;
  const before=await balance();await changeSaleDocument(owner,{sale_id:retail,kind:'SI',action:'assign',series_id:si.id,number:'000001'});await changeSaleDocument(owner,{sale_id:retail,kind:'DR',action:'assign',series_id:dr.id,number:'000001'});assert.deepEqual(await balance(),before);
  const other=await saveSale(owner,draft({documents:{si:true,dr:false}}));await assert.rejects(changeSaleDocument(owner,{sale_id:other,kind:'SI',action:'assign',series_id:si.id,number:'000001'}),/already been used/);
 });
 await t.test('posting is atomic and idempotent; weighted-average historical COGS and net profit',async()=>{
  const input={id:retail,version:2,request_id:randomUUID()};await postSale(owner,input);await postSale(owner,input);await post(retail);
  const s=await getSale(owner,retail);assert.equal(s.status,'Posted');assert.equal(s.cogs,'500.000000');assert.equal(s.profit,'130.000000');assert.equal(s.payments.length,0);assert.equal((await balance()).available,'9.000000');
  assert.equal((await saleDocumentData(owner,s.documents[0].id)).lines.length,1);
  await assert.rejects(saveSale(owner,draft({id:retail,version:s.version})),/Draft/);
  const id=s.documents.find((d:{kind:string})=>d.kind==='SI').id;await changeSaleDocument(owner,{sale_id:retail,document_id:id,kind:'SI',action:'void',reason:'TEST spoiled form'});
  const options=await salesOptions(owner),series=options.find(o=>o.kind==='si_series')!;await assert.rejects(changeSaleDocument(owner,{sale_id:retail,kind:'SI',action:'assign',series_id:series.id,number:'000001'}),/already been used/);
  await changeSaleDocument(owner,{sale_id:retail,kind:'SI',action:'assign',series_id:series.id,number:'000002'});assert.equal((await query('SELECT count(*)::int AS n FROM sale_document_lines l JOIN sale_documents d ON d.id=l.document_id WHERE d.sale_id=$1 AND d.number=$2',[retail,'000002'])).rows[0].n,1);assert.equal((await balance()).available,'9.000000');
 });
 await t.test('last-line shortage rolls back all stock-outs, COGS and audit postings',async()=>{
  const input=draft({lines:[line(pid,'1'),line(pid,'10')]});const id=await saveSale(owner,input);const before=await balance();await assert.rejects(post(id),/insufficient/);assert.deepEqual(await balance(),before);const s=await getSale(owner,id);assert.equal(s.status,'Draft');assert(s.lines.every((l:{movement_id:unknown})=>!l.movement_id));
 });
 await t.test('an error after the first stock-out rolls back the entire posting',async()=>{
  const used=(await query("SELECT request_id FROM inventory_movements WHERE product_id=$1 AND kind='IN' LIMIT 1",[pid])).rows[0].request_id;
  const id=await saveSale(owner,draft({lines:[{...line(),id:'00000000-0000-4000-8000-000000000001'},{...line(),id:used}]}));
  const before=await balance(),audit=(await query('SELECT count(*)::int AS n FROM audit_log')).rows[0];await assert.rejects(post(id),/already used/);assert.deepEqual(await balance(),before);assert.deepEqual((await query('SELECT count(*)::int AS n FROM audit_log')).rows[0],audit);assert((await getSale(owner,id)).lines.every((l:{movement_id:unknown})=>l.movement_id===null));
 });
 await t.test('employee permissions and direct API prevent cost leaks, override and posting bypass',async()=>{
  employee={id:await saveUser(owner,{name:'TEST Sales Employee',email:'sales-employee@example.test',roles:['SALES'],active:true,password}),name:'TEST Sales Employee',email:'sales-employee@example.test',roles:['SALES']};
  token=(await authenticate(employee.email,password))!;
  for(const url of ['http://localhost/api/sales?id='+retail,'http://localhost/api/sales','http://localhost/api/sales?lookup=products']){const response=await salesResponse(new Request(url,{headers:{cookie:'imperial_session='+token}}));assert.equal(response.status,200);const text=await response.text();for(const field of ['cogs','profit','cost_snapshot','standard_cost','gross_margin'])assert(!text.includes('"'+field+'"'));}
  await assert.rejects(postSale({...employee,roles:['PRESIDENT_ADMIN']},{id:retail,version:3,request_id:randomUUID()}),/permission/);
  await assert.rejects(saveSale(employee,draft({lines:[{...line(),price:'699'}]})),/permission/);
  await assert.rejects(saveSale(employee,draft({lines:[{...line(),discount:'10'}]})),/permission/);
  const id=await saveSale(employee,draft());assert(id);
  await saveUser(owner,{name:employee.name,email:employee.email,roles:employee.roles,active:true,password:'',permission_overrides:{'sales.post':'allow','inventory.issue':'allow'}},employee.id,1);
  assert.equal(await resolveSession(token),null);token=(await authenticate(employee.email,password))!;
  await post(id,employee);assert.equal((await balance()).available,'8.000000');
 });
 await t.test('competing Sales for 8 of 10 units allow one complete posting',async()=>{
  const productId=await saveMaster(owner,'products',{...product,sku:'TEST-S3-RACE'});await receipt(productId);
  const first=await saveSale(owner,draft({lines:[line(productId,'8')]})),second=await saveSale(employee,draft({lines:[line(productId,'8')]}));
  const ownerToken=await authenticate(owner.email,password);const request=(id:string,session:string)=>new Request('http://localhost/api/sales',{method:'POST',headers:{cookie:'imperial_session='+session,origin:'http://localhost'},body:JSON.stringify({operation:'post',data:{id,version:1,request_id:randomUUID()}})});const responses=await Promise.all([salesResponse(request(first,ownerToken!)),salesResponse(request(second,token))]);assert.equal(responses.filter(r=>r.status===200).length,1);assert.equal(responses.filter(r=>r.status===400).length,1);assert.equal((await balance(productId)).available,'2.000000');
 });
 await t.test('actual received payments are separate from unpaid terms and match payable',async()=>{
  const opts=await salesOptions(owner),cash=opts.find(o=>o.code==='cash')!,check=opts.find(o=>o.code==='check')!;
  await assert.rejects(saveSale(owner,draft({payment:{method_id:cash.id,amount_received:'0',status:'Paid'}})),/status/);
  await assert.rejects(saveSale(owner,draft({payment:{method_id:check.id,amount_received:'700',status:'Paid'}})),/check/);
  const id=await saveSale(owner,draft({terms:'30 Days',payment:{method_id:cash.id,amount_received:'100',status:'Partially Paid'}}));await post(id);const sale=await getSale(owner,id);assert.equal(sale.payments[0].amount,'100.00');assert.equal(sale.payment_status,'Partially Paid');assert.equal(new Date(sale.due_date).toISOString().slice(0,10),'2026-03-03');
 });
 await t.test('100 distinct products retain one Sale header, searchable summaries and every posted line',async()=>{
  const lines=[];for(let i=0;i<100;i++){const id=await saveMaster(owner,'products',{...product,sku:'TEST-S3-LARGE-'+i,name:'TEST Large Product '+i});await receipt(id,'2');lines.push(line(id));}
  large=await saveSale(owner,draft({lines}));await post(large);const s=await getSale(owner,large);assert.equal(s.line_count,100);assert.equal(s.lines.length,100);assert.equal(s.gross_total,'70000.00');assert.equal(s.cogs,'50000.000000');
  const list=await listSales(owner,{q:'TEST Large Product 99'});assert.equal(list.length,1);assert.equal(list[0].id,large);assert.equal((list[0].products as unknown[]).length,3);
 });
 await t.test('ROLL/METER sale, independent VAT modes, recoverable VAT COGS and full Return',async()=>{
  const productId=await saveMaster(owner,'products',{...product,sku:'TEST-S3-ROLL',name:'TEST VAT Cable',primary_uom:'ROLL',secondary_uom:'METER',conversion:'150',base_price:'560',standard_cost:'560',retail_price:'784',meter_price:'5.60',selling_tax_treatment:'VATable',selling_entry_mode:'VAT Inclusive',cost_tax_treatment:'VATable',cost_entry_mode:'VAT Inclusive',cost_input_vat_recoverable:true,tax_config_version:1});
  await postMovement(owner,{request_id:randomUUID(),product_id:productId,kind:'IN',occurred_at:'2026-01-01T00:00:00Z',quantity:'5',uom:'ROLL',unit_cost:'560',reference:'TEST VAT receipt',cost_tax_treatment:'VATable',cost_entry_mode:'VAT Inclusive',cost_input_vat_recoverable:true,tax_config_version:1});
  const id=await saveSale(owner,draft({lines:[{...line(productId,'2'),uom:'ROLL',price:'784',vat_mode:'VAT Inclusive',discount:'10'},{...line(productId,'12.5'),uom:'METER',price:'5.60'}]}));await post(id);
  const original=await getSale(owner,id);assert.equal(original.gross_total,'1481.20');assert.equal(original.cogs,'1166.666667');assert.equal((await balance(productId)).available,'437.500000');
  const returned=await createReturn(owner,{request_id:randomUUID(),sale_id:id,reason:'TEST Full return',requested_at:'2026-02-02T00:00:00Z',lines:original.lines.map((l:{id:string;quantity:string})=>({sale_line_id:l.id,quantity:l.quantity}))});
  for(const action of ['approve','receive','inspect','restock','complete']){const r=await getReturn(owner,returned);await changeReturn(owner,{id:returned,version:r.version,request_id:randomUUID(),action,...(action==='receive'?{received_at:'2026-02-03T00:00:00Z'}:{}),...(action==='inspect'?{conditions:r.lines.map((l:{id:string})=>({line_id:l.id,condition:'Sellable'}))}:{})});}
  assert.equal((await getSale(owner,id)).activity,'Fully Returned');assert.equal((await balance(productId)).available,'750.000000');assert.equal((await balance(productId)).inventory_value,'2800.000000');assert.equal((await getSale(owner,id)).cogs,original.cogs);
 });
 await t.test('all configured payment methods validate their conditional fields independently',async()=>{
  const options=await salesOptions(owner),bank=await saveSalesOption(owner,{kind:'bank',code:'test-label',name:'TEST Receiving Account',behavior:'Other',active:true});
  for(const method of options.filter(o=>o.kind==='payment_method')){
   const id=await saveSale(owner,draft({payment:{method_id:method.id,amount_received:method.behavior==='Unpaid'?'0':'700',status:method.behavior==='Unpaid'?'Unpaid':'Paid',...(method.behavior==='Bank'?{account_id:bank,reference:'TEST Bank reference'}:{}),...(method.behavior==='Check'?{check_bank:'TEST bank',check_number:'00012',check_date:'2026-02-10'}:{}),...(method.behavior==='Wallet'?{reference:'TEST Wallet reference'}:{})}}));
   const sale=await getSale(owner,id);assert.equal(sale.payment_intent.method_snapshot.name,method.name);assert.equal(sale.payments.length,0);
  }
  const cash=options.find(o=>o.code==='cash')!;await assert.rejects(saveSale(owner,draft({payment:{method_id:cash.id,amount_received:'700',status:'Paid',account_id:bank}})),/Bank/);
 });
 await t.test('customer snapshot, inactive customer rejection, terms and per-series document uniqueness',async()=>{
  const details={code:'TEST-S3-CUSTOMER',name:'TEST Original Customer',customer_type:'Wholesale',contact_person:'TEST Contact',phone:'',email:'',tin:'TEST-S3-TIN',notes:'',billing_address:'TEST Original Address',delivery_addresses:'TEST Delivery',salesperson_id:'',payment_terms:'30 Days',credit_limit:'0',credit_notes:'',account_status:'Active',active:true};
  const customer=await saveMaster(owner,'customers',details);assert.equal((await salesLookup(owner,'customers','TEST-S3-TIN') as {id:string}[])[0].id,customer);
  const id=await saveSale(owner,draft({channel:'Wholesale',customer_id:customer,terms:'30 Days',documents:{si:true,dr:false}}));await post(id);await saveMaster(owner,'customers',{...details,name:'TEST Renamed Customer',billing_address:'TEST New Address',active:false},customer,1);
  assert.equal((await getSale(owner,id)).customer_snapshot.name,details.name);assert.equal((await getSale(owner,id)).customer_snapshot.billing_address,details.billing_address);
  await assert.rejects(saveSale(owner,draft({channel:'Wholesale',customer_id:customer})),/active customer/);
  const series=await saveSalesOption(owner,{kind:'si_series',code:'test-booklet-2',name:'TEST SI Booklet 2',behavior:'SI',active:true});await changeSaleDocument(owner,{sale_id:id,kind:'SI',action:'assign',series_id:series,number:'000001'});assert((await listSales(owner,{q:'000001'})).some(r=>r.id===id));
  for(const terms of ['Cash','COD','7 Days','15 Days','30 Days','45 Days','60 Days','Custom']){const saleId=await saveSale(owner,draft({terms,...(terms==='Custom'?{custom_terms:'TEST agreed date',custom_due_date:'2026-04-01'}:{})}));assert.equal((await getSale(owner,saleId)).terms,terms);}
  await assert.rejects(saveSale(owner,draft({terms:'Custom',custom_terms:'TEST',custom_due_date:'2026-02-31'})),/valid custom/);
 });
 await t.test('individual financial denials override the same role and Owner settings remain protected',async()=>{
  const id=await saveUser(owner,{name:'TEST Sales restricted',email:'sales-individual@example.test',roles:['SALES'],active:true,password,permission_overrides:{'products.prices':'deny','returns.read':'allow'}}),session=(await authenticate('sales-individual@example.test',password))!;
  const res=await salesResponse(new Request('http://localhost/api/sales?id='+retail,{headers:{cookie:'imperial_session='+session}}));assert.equal(res.status,200);const body=await res.text();for(const field of ['entered_price','gross_total','payment_intent','cogs','profit','discount_percent','documents']){if(field!=='documents')assert(!body.includes('"'+field+'"'));}
  const denied=await salesResponse(new Request('http://localhost/api/sales',{method:'POST',headers:{cookie:'imperial_session='+session,origin:'http://localhost'},body:JSON.stringify({operation:'option',data:{kind:'platform',code:'forged',name:'Forbidden',behavior:'Other',active:true}})}));assert.equal(denied.status,403);
  assert.equal((await salesResponse(new Request('http://localhost/api/sales'))).status,401);
  assert.equal((await salesResponse(new Request('http://localhost/api/sales',{method:'POST',headers:{cookie:'imperial_session='+session,origin:'http://other.test'},body:'{}'}))).status,403);
 });
 await t.test('restart preserves 100-line Sale, snapshots, payments, inventory, audit and sessions',async()=>{
  const before=await getSale(owner,large),audit=(await query("SELECT count(*)::int AS count FROM audit_log WHERE entity='sale_lines'")).rows[0];await closeDB();assert(await resolveSession(token));assert.deepEqual(await getSale(owner,large),before);assert.deepEqual((await query("SELECT count(*)::int AS count FROM audit_log WHERE entity='sale_lines'")).rows[0],audit);
  await saveUser(owner,{name:employee.name,email:employee.email,roles:employee.roles,active:false,password:''},employee.id,2);
  assert.equal((await salesResponse(new Request('http://localhost/api/sales',{headers:{cookie:'imperial_session='+token}}))).status,401);
 });
});
after(async()=>{await closeDB();if(directory)await rm(directory,{recursive:true,force:true});});
