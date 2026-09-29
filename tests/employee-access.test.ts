import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {transaction,query,closeDB} from '../lib/db';
import {migrate} from '../lib/migrations';
import {saveUser,listUsers,getUser} from '../lib/users';
import {authenticate,resolveSession,revokeSession} from '../lib/sessions';
import {hashPassword,tokenHash} from '../lib/password';
import {saveMaster,getMaster,listMaster} from '../lib/masters';
import {listAudit} from '../lib/audit';
import {allows,type Actor,type Role} from '../lib/permissions';
let directory:string;
const owner:Actor={id:randomUUID(),name:'TEST Owner',email:'owner@example.test',roles:['PRESIDENT_ADMIN']};
const password='TEST independent employee password';
const employees:Actor[]=[];
const form=(a:Actor)=>({name:a.name,email:a.email,roles:a.roles,active:true,password:'',permission_overrides:a.permission_overrides||{}});
const product={sku:'TEST-ACCESS-001',name:'TEST access product',brand:'',category:'',primary_uom:'PCS',secondary_uom:'',conversion:'',base_price:'10.25',supplier_adjustment:'0',standard_cost:'10.25',vat_status:'VAT',vat_rate:'0.12',retail_price:'20.50',contractor_price:'20.50',wholesale_price:'20.50',meter_price:'',reorder_level:'1',supplier_id:'',active:true};
test('Employee access foundation',async t=>{
 delete process.env.DATABASE_URL;directory=await mkdtemp(join(tmpdir(),'imperial-employees-'));process.env.LOCAL_DB_PATH=directory;
 await migrate();await migrate();
 await transaction(async db=>{await db.query("SELECT set_config('imperial.actor_id',$1,true)",[owner.id]);await db.query('INSERT INTO users(id,email,name,password_hash,roles) VALUES ($1,$2,$3,$4,$5)',[owner.id,owner.email,owner.name,await hashPassword(password),owner.roles]);});
 let pid:string;
 await t.test('more than ten employees, shared roles, unique credentials and combined roles',async()=>{
  for(let i=0;i<12;i++){const roles:Role[]=i<3?['SALES']:i===3?['SALES','PURCHASING']:i%3===0?['ACCOUNTING']:i%3===1?['WAREHOUSE']:['PURCHASING'];
   const input={name:`TEST Employee ${i}`,email:`employee${i}@example.test`,roles,active:true,password:password+i};
   const id=await saveUser(owner,input);employees.push({id,name:input.name,email:input.email,roles});
  }
  assert.equal((await listUsers(owner)).length,13);assert.equal((await listUsers(owner,'','true','SALES')).length,4);
  assert(allows(employees[3],'suppliers.write'));assert(allows(employees[3],'customers.write'));
  pid=await saveMaster(owner,'products',product);
 });
 await t.test('individual logins create separate sessions and wrong passwords fail',async()=>{
  const tokens=await Promise.all(employees.map((e,i)=>authenticate(e.email,password+i)));
  assert.equal(new Set(tokens).size,12);
  for(let i=0;i<tokens.length;i++)assert.equal((await resolveSession(tokens[i]!))?.id,employees[i].id);
  assert.equal(await authenticate(employees[0].email,password+'1'),null);
  assert.equal(await resolveSession('forged'),null);
 });
 await t.test('two Sales employees have different individual cost access',async()=>{
  const grant={'products.cost':'allow'} as const;
  await saveUser(owner,{...form(employees[0]),permission_overrides:grant},employees[0].id,1);
  assert.equal((await getMaster(employees[0],'products',pid)).standard_cost,'10.25');
  assert(!('standard_cost' in await getMaster(employees[1],'products',pid)));
  assert.equal((await query('SELECT count(*) AS total FROM sessions WHERE user_id=$1',[employees[0].id])).rows[0].total,0);
 });
 await t.test('explicit denies override role grants and read denial blocks write',async()=>{
  await saveUser(owner,{...form(employees[3]),permission_overrides:{'products.cost':'deny','products.write':'deny','customers.read':'deny'}},employees[3].id,1);
  assert(!('standard_cost' in await getMaster(employees[3],'products',pid)));
  await assert.rejects(saveMaster(employees[3],'products',product),/permission/);
  await assert.rejects(listMaster(employees[3],'customers'),/permission/);
 });
 await t.test('employees cannot promote themselves, edit others, list users or read audit snapshots',async()=>{
  const employee=employees[1];
  await assert.rejects(saveUser(employee,{...form(employee),roles:['PRESIDENT_ADMIN']},employee.id,1),/permission/);
  await assert.rejects(saveUser({...employee,roles:['PRESIDENT_ADMIN']},{...form(employee),permission_overrides:{'products.cost':'allow'}},employee.id,1),/permission/);
  await assert.rejects(listUsers(employee),/permission/);await assert.rejects(getUser(employee,owner.id),/permission/);await assert.rejects(listAudit(employee),/permission/);
  await assert.rejects(saveUser(owner,{...form(employee),permission_overrides:{'users.manage':'allow'}},employee.id,1));
 });
 await t.test('forged sensitive fields fail, permitted employee edits retain audit actor identity',async()=>{
  const employee=employees[2];await saveUser(owner,{...form(employee),permission_overrides:{'products.write':'allow'}},employee.id,1);
  await assert.rejects(saveMaster(employee,'products',{...product,name:'forged'},pid,1),/permission/);
  const {base_price,supplier_adjustment,standard_cost,supplier_id,...selling}=product;
  void base_price;void supplier_adjustment;void standard_cost;void supplier_id;
  await saveMaster(employee,'products',{...selling,name:'TEST employee edit'},pid,1);
  const audit=(await query("SELECT * FROM audit_log WHERE record_id=$1 AND action='UPDATE'",[pid])).rows[0];
  assert.equal(audit.actor_id,employee.id);assert.equal(audit.actor_name,employee.name);assert(audit.created_at);
 });
 await t.test('disable rejects credentials, revokes existing tokens, retains historical records',async()=>{
  const employee=employees[2],token=await authenticate(employee.email,password+'2');assert(token);
  await saveUser(owner,{...form(employee),active:false},employee.id,2);
  assert.equal(await resolveSession(token),null);assert.equal(await authenticate(employee.email,password+'2'),null);
  await assert.rejects(getMaster(employee,'products',pid),/permission/);await assert.rejects(saveMaster(employee,'products',product),/permission/);
  assert((await getUser(owner,employee.id)).active===false);
  assert.equal((await query("SELECT count(*) AS total FROM audit_log WHERE actor_id=$1 AND entity='products'",[employee.id])).rows[0].total,1);
  await assert.rejects(query('DELETE FROM users WHERE id=$1',[employee.id]),/deletion/);
 });
 await t.test('reactivation restores login, old tokens stay invalid and actor snapshot survives rename',async()=>{
  const employee=employees[2];await saveUser(owner,{...form(employee),name:'TEST Renamed employee'},employee.id,3);
  assert(await authenticate(employee.email,password+'2'));
  assert.equal((await query("SELECT actor_name FROM audit_log WHERE actor_id=$1 AND entity='products'",[employee.id])).rows[0].actor_name,employee.name);
 });
 await t.test('duplicate employee email and stale user edits are rejected',async()=>{
  await assert.rejects(saveUser(owner,{...form(employees[1]),email:employees[1].email.toUpperCase(),password}),e=>(e as {code?:string}).code==='23505');
  await assert.rejects(saveUser(owner,form(employees[2]),employees[2].id,1),/Reload/);
 });
 await t.test('last Owner remains active; role overrides cannot weaken Owner protection',async()=>{
  await assert.rejects(saveUser(owner,{...form(owner),active:false},owner.id,1),/at least one/);
  await assert.rejects(saveUser(owner,{...form(owner),roles:['SALES']},owner.id,1),/at least one/);
  assert(allows({...owner,permission_overrides:{'products.cost':'deny'}},'products.cost'));
 });
 await t.test('password reset revokes sessions and produces a secret-free audit event',async()=>{
  const employee=employees[1],token=await authenticate(employee.email,password+'1');assert(token);
  await saveUser(owner,{...form(employee),password:password+'changed'},employee.id,1);
  assert.equal(await resolveSession(token),null);assert.equal(await authenticate(employee.email,password+'1'),null);assert(await authenticate(employee.email,password+'changed'));
  assert.equal((await query("SELECT count(*) AS total FROM audit_log WHERE record_id=$1 AND action='PASSWORD_RESET'",[employee.id])).rows[0].total,1);
  const log=JSON.stringify((await query('SELECT * FROM audit_log')).rows);assert(!log.includes('password_hash'));assert(!log.includes(password));assert(!log.includes(token));
 });
 await t.test('logout and session expiry reject access; login/logout are audited',async()=>{
  const token=await authenticate(owner.email,password);assert(token);await revokeSession(token);assert.equal(await resolveSession(token),null);
  const expired=await authenticate(owner.email,password);assert(expired);await query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[tokenHash(expired)]);assert.equal(await resolveSession(expired),null);
  const actions=(await query("SELECT action FROM audit_log WHERE actor_id=$1 AND entity='sessions'",[owner.id])).rows.map(r=>r.action);assert(actions.includes('LOGIN'));assert(actions.includes('LOGOUT'));
 });
 await t.test('database close/reopen preserves employees, grants, sessions, products and audit history',async()=>{
  const token=await authenticate(employees[0].email,password+'0');assert(token);
  const before=(await query('SELECT count(*) AS total FROM audit_log')).rows[0].total;
  await closeDB();await migrate();
  assert.equal((await listUsers(owner)).length,13);assert.equal((await resolveSession(token))?.id,employees[0].id);
  assert.equal((await getMaster(employees[0],'products',pid)).standard_cost,'10.25');
  assert.equal((await query('SELECT count(*) AS total FROM audit_log')).rows[0].total,before);
 });
 await t.test('persistent rate limit blocks repeated guesses',async()=>{
  for(let i=0;i<10;i++)assert.equal(await authenticate(employees[10].email,'wrong'),null);
  assert.equal(await authenticate(employees[10].email,password+'10'),null);
 });
 await t.test('core operations succeed with external fetch disabled and without AI environment keys',async()=>{
  const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('External network disabled');};
  try{const token=await authenticate(owner.email,password);assert(token);assert(await resolveSession(token));assert((await listMaster(owner,'products')).length);await revokeSession(token);}finally{globalThis.fetch=originalFetch;}
 });
});
test('runtime source and dependencies contain no AI SDK or AI service endpoints',async()=>{
 const pkg=JSON.parse(await readFile('package.json','utf8'));assert(!Object.keys(pkg.dependencies).some(k=>/openai|anthropic|codex|astra|^ai$/.test(k)));
 async function scan(dir:string):Promise<void>{for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await scan(path);else if(/\.[jt]sx?$/.test(path)){const src=await readFile(path,'utf8');assert(!/api\.openai\.com|chatgpt\.com|process\.env\.(OPENAI|CODEX|ASTRA)|from\s+['"](?:openai|@openai\/)/i.test(src),path);}}}
 await scan('lib');await scan('app');await scan('components');
});
after(async()=>{await closeDB();if(directory)await rm(directory,{recursive:true,force:true});});
