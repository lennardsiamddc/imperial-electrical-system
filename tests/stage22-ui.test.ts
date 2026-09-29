import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createElement,type ComponentType} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {navigationItems} from '../lib/navigation';
import {formError} from '../lib/form-errors';
import {productMainFields,productAdvancedFields} from '../lib/form-presentation';
import {taxSnapshot} from '../lib/vat';
import {transaction,closeDB} from '../lib/db';
import {migrate} from '../lib/migrations';
import {hashPassword} from '../lib/password';
import {saveMaster,listMaster} from '../lib/masters';
import {saveUser} from '../lib/users';
import {authenticate} from '../lib/sessions';
import {productSearchResponse} from '../lib/product-search';
import {postMovement,stockBalances,movementHistory} from '../lib/inventory';
import type {Actor} from '../lib/permissions';
import InventoryHistory from '../components/inventory-history';
import InventoryTable from '../components/inventory-table';
import ProductDetails from '../components/product-details';
import VatEditor from '../components/vat-editor';
import StockSuccess from '../components/stock-success';
const owner:Actor={id:randomUUID(),name:'TEST UI Owner',email:'uiowner@example.test',roles:['PRESIDENT_ADMIN']};
const warehouse:Actor={id:randomUUID(),name:'TEST UI Warehouse',email:'uiwarehouse@example.test',roles:['WAREHOUSE']};
const config={standard_rate:'0.12',version:1,effective_at:'2026-01-01T00:00:00Z'};
const render=<P extends object>(component:ComponentType<P>,props:P)=>renderToStaticMarkup(createElement(component,props));
test('navigation offers available work and keeps advanced controls Owner-only',()=>{
 assert(!navigationItems(owner).some(i=>i.name==='Tax Settings'));assert(navigationItems(owner).some(i=>i.name==='Stock In'));
 assert.deepEqual(navigationItems(warehouse).map(i=>i.name),['Dashboard','Products','Inventory']);
 assert(!navigationItems({...warehouse,permission_overrides:{'products.read':'deny'}}).some(i=>i.name==='Inventory'));
});
test('product form prioritizes name and keeps additional pricing separate',()=>{
 assert.equal(productMainFields[0],'name');assert(productMainFields.includes('primary_uom'));
 for(const field of ['base_price','contractor_price','conversion']){assert(!productMainFields.includes(field));assert(productAdvancedFields.includes(field));}
});
test('friendly validation identifies invalid unit and reference without schema terminology',()=>{
 const unit=z.object({uom:z.enum(['PCS'])}).safeParse({uom:'bad'});assert(!unit.success);assert.equal(formError(unit.error),'Please select a valid unit.');
 const ref=z.object({reference:z.string().min(1)}).safeParse({reference:''});assert(!ref.success);assert.match(formError(ref.error),/reference/);
 assert.equal(formError({code:'23505'}),'This email, code or SKU already exists.');
});
for(const costMode of ['VAT Exclusive','VAT Inclusive'] as const)for(const sellMode of ['VAT Exclusive','VAT Inclusive'] as const)test(`simplified form retains separate amounts: ${costMode} / ${sellMode}`,()=>{
 const record={standard_cost:costMode==='VAT Inclusive'?'560':'500',retail_price:sellMode==='VAT Inclusive'?'784':'700',cost_entry_mode:costMode,selling_entry_mode:sellMode,cost_tax_treatment:'VATable',selling_tax_treatment:'VATable'};
 const cost=render(VatEditor,{side:'cost',amountName:'standard_cost',amountLabel:'Cost',record,config});const sell=render(VatEditor,{side:'selling',amountName:'retail_price',amountLabel:'Selling Price',record,config});
 assert(cost.includes(`value="${record.standard_cost}"`));assert(sell.includes(`value="${record.retail_price}"`));
 assert(cost.includes(`<option value="${costMode}" selected=""`));assert(!sell.includes('<select'));
 assert(!cost.includes('View VAT Details'));assert(!sell.includes('View VAT Details'));
});
test('employee views omit financial data even when supplied an Owner-shaped record',()=>{
 const product={id:randomUUID(),name:'TEST Wire',sku:'TEST-W',active:true,primary_uom:'PCS',available:'3',stock_uom:'PCS',reorder_level:'1',inventory_value:'987654',pricing_rules:{PCS:{base:'987654',supplier:'0%',retail:'0%',contractor:'0%',net_override:null,retail_override:null,contractor_override:null}},standard_cost:'987654',retail_price:'1000000',cost_vat:taxSnapshot('987654','VAT Exclusive','VATable',config),selling_vat:taxSnapshot('1000000','VAT Exclusive','VATable',config),created_at:'2026-09-01',updated_at:'2026-09-01'};
 const html=render(ProductDetails,{product,actor:warehouse});assert(!html.includes('987654'));assert(!html.includes('Input VAT'));assert(!html.includes('profit'));assert(html.includes('TEST Wire'));
 const table=render(InventoryTable,{rows:[product]});assert(!table.includes('Inventory value'));assert(!table.includes('987654'));assert(table.includes('Available Stock'));
});
test('stock success names the saved product, quantity and reference without exposing cost',()=>{
 const html=render(StockSuccess,{receipt:{product_name:'TEST Receipt Wire',quantity:'4.000000',uom:'ROLL',reference:'TEST-UI-OK',unit_cost:'SECRET_COST'}});
 assert(html.includes('role="status"'));assert(html.includes('Stock added successfully'));assert(html.includes('TEST Receipt Wire'));assert(html.includes('4'));assert(html.includes('ROLL'));assert(html.includes('TEST-UI-OK'));assert(!html.includes('SECRET_COST'));
});
test('advanced product details retain permitted default supplier information',()=>{
 const product={id:'test',name:'TEST Product',sku:'TEST',supplier_id:'supplier',reorder_level:'0',primary_uom:'PCS',standard_cost:'500',retail_price:'700',base_price:'0',created_at:'2026-09-01',updated_at:'2026-09-01'};
 const suppliers=[{id:'supplier',name:'TEST Confidential Supplier'}];
 assert(render(ProductDetails,{product,actor:owner,suppliers}).includes('TEST Confidential Supplier'));
 assert(!render(ProductDetails,{product,actor:warehouse,suppliers}).includes('TEST Confidential Supplier'));
});
let directory:string;
test('Stage 2.2 product discovery and employee workflow',async t=>{
 delete process.env.DATABASE_URL;directory=await mkdtemp(join(tmpdir(),'imperial-ui-tests-'));process.env.LOCAL_DB_PATH=directory;await migrate();
 const password='TEST isolated usability password';
 await transaction(async db=>{await db.query("SELECT set_config('imperial.actor_id',$1,true)",[owner.id]);await db.query('INSERT INTO users(id,name,email,password_hash,roles) VALUES($1,$2,$3,$4,$5)',[owner.id,owner.name,owner.email,await hashPassword(password),owner.roles]);});
 warehouse.id=await saveUser(owner,{name:warehouse.name,email:warehouse.email,roles:warehouse.roles,password,active:true});
 const base={sku:'TEST-SEARCH',name:'TEST Cable Search',brand:'UniqueBrand22',category:'Electrical',primary_uom:'PCS',secondary_uom:'',conversion:'',base_price:'0',supplier_adjustment:'0',standard_cost:'500',vat_status:'VAT',vat_rate:'0.12',retail_price:'700',contractor_price:'0',wholesale_price:'0',meter_price:'',reorder_level:'10',supplier_id:'',notes:'',active:true,cost_tax_treatment:'VATable',selling_tax_treatment:'VATable',cost_entry_mode:'VAT Exclusive',selling_entry_mode:'VAT Exclusive',cost_input_vat_recoverable:true};
 const id=await saveMaster(owner,'products',base),token=await authenticate(warehouse.email,password);assert(token);
 const request=(q:string,t=token)=>new Request('http://localhost/api/products/search?q='+encodeURIComponent(q),{headers:t?{cookie:'imperial_session='+t}:{}});
 await t.test('partial name, SKU and brand search returns stable identity without costs',async()=>{
  for(const q of ['Cable','SEARCH','Brand22']){const response=await productSearchResponse(request(q));assert.equal(response.status,200);const body=await response.json();assert.equal(body.data[0].id,id);assert.deepEqual(Object.keys(body.data[0]).sort(),['active','brand','id','name','sku']);assert.equal((await listMaster(warehouse,'products',q))[0].id,id);}
  assert.equal((await productSearchResponse(request('no matches'))).status,200);
 });
 await t.test('search rejects anonymous and revoked directory access',async()=>{
  assert.equal((await productSearchResponse(request('Cable',''))).status,401);
  const denied=await saveUser(owner,{name:'TEST denied',email:'denied@example.test',password,roles:['WAREHOUSE'],active:true,permission_overrides:{'products.read':'deny'}});assert(denied);
  const deniedToken=await authenticate('denied@example.test',password);assert(deniedToken);assert.equal((await productSearchResponse(request('Cable',deniedToken))).status,403);
 });
 await t.test('Stock In retains duplicate protection; low-stock filter and plain-language history match saved quantities',async()=>{
  const input={request_id:randomUUID(),product_id:id,kind:'IN',occurred_at:'2026-09-01T00:00:00Z',quantity:'12',uom:'PCS',unit_cost:'500',reference:'TEST-UI-RECEIPT',notes:'TEST',cost_tax_treatment:'VATable',cost_entry_mode:'VAT Exclusive',cost_input_vat_recoverable:true};
  const first=await postMovement(owner,input);assert.equal(await postMovement(owner,input),first);assert.equal((await movementHistory(owner,{product:id})).length,1);
  assert.equal((await stockBalances(owner,{product:id}))[0].available,'12.000000');assert.equal((await stockBalances(owner,{product:id,low:'true'})).length,0);
  const history=await movementHistory(warehouse,{product:id}),html=render(InventoryHistory,{rows:history});assert(html.includes('STOCK IN'));assert(html.includes('+12'));assert(html.includes('Entered by:'));assert(html.includes('TEST-UI-RECEIPT'));assert(!html.includes('Input VAT'));assert(!html.includes('Inventory value'));
 });
 await t.test('search result payload remains bounded',async()=>{
  for(let n=0;n<22;n++)await saveMaster(owner,'products',{...base,sku:'TEST-BOUNDED-'+n,name:'TEST Bounded '+n});
  const result=await (await productSearchResponse(request('TEST Bounded'))).json();assert.equal(result.data.length,20);assert.equal(result.more,true);
 });
});
after(async()=>{await closeDB();if(directory)await rm(directory,{recursive:true,force:true});});

test('Product price management submits per-UOM price JSON and no obsolete tax version',async()=>{const {default:MasterForm}=await import('../components/master-form');const {fields,schemas}=await import('../lib/masters');const markup=render(MasterForm,{entity:'products',fields:fields('products'),record:{primary_uom:'ROLL',secondary_uom:'METER',retail_price:'3800',contractor_price:'3500',standard_cost:'3000',selling_prices:{ROLL:{Retail:'3800',Contractor:'3500'},METER:{Retail:'15',Contractor:'14'}}},options:[],taxConfig:config});assert(!markup.includes('name="tax_config_version"'));assert(markup.includes('name="pricing_rules"'));assert(markup.includes('Manual override'));assert(markup.includes('Supplier Adjustment'));assert(markup.includes('ROLL Retail Price'));assert(markup.includes('METER Contractor Price'));assert.deepEqual(schemas.products.shape.selling_prices.parse({ROLL:{Retail:'3800',Contractor:'3500'},METER:{Retail:'15',Contractor:'14'}}),{ROLL:{Retail:'3800',Contractor:'3500'},METER:{Retail:'15',Contractor:'14'}});});

test('Stock In form submits supplier tag without obsolete tax configuration',async()=>{const {default:StockInForm}=await import('../components/stock-in-form');const html=render(StockInForm,{product:{id:'test',name:'TEST',primary_uom:'PCS',cost_entry_mode:'VAT Inclusive'},requestId:randomUUID(),suppliers:[],taxConfig:config});assert(!html.includes('name="tax_config_version"'));assert(html.includes('name="cost_entry_mode"'));assert(!html.includes('name="cost_tax_treatment"'));assert(!html.includes('name="cost_input_vat_recoverable"'));});

test('Product rule details format all money to two decimals without exposing restricted rules',()=>{const p={name:'TEST Format',primary_uom:'PCS',standard_cost:'3750',retail_price:'4900.123456',pricing_rules:{PCS:{base:'3000',supplier:'+25%',retail:'+30%',contractor:'-25-5-3%',net_override:null,retail_override:'4900.123456',contractor_override:null}}};const html=render(ProductDetails,{product:p,actor:owner});assert(html.includes('₱4,900.12'));assert(html.includes('₱2,591.72'));assert(!html.includes('4900.123456'));});
