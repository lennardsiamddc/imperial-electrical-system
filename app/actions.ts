'use server';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {login,requireUser} from '@/lib/auth';
import {revokeSession} from '@/lib/sessions';
import {entityFrom,saveMaster} from '@/lib/masters';
import {saveUser} from '@/lib/users';
import {formError} from '@/lib/form-errors';
export type FormState={error:string};
const message=formError;
export async function signIn(_:FormState,form:FormData):Promise<FormState>{let ok=false;try{ok=await login(String(form.get('email')||''),String(form.get('password')||''));}catch{return {error:'Database unavailable. Complete the local setup and migration first.'};}if(!ok)return {error:'Sign-in failed. Check your credentials, or wait 15 minutes after repeated attempts.'};redirect('/');}
export async function signOut(){const jar=await cookies();const token=jar.get('imperial_session')?.value;if(token)await revokeSession(token);jar.delete('imperial_session');redirect('/login');}
export async function saveRecord(entityName:string,id:string|undefined,version:number|undefined,_:FormState,form:FormData):Promise<FormState>{const actor=await requireUser();let recordId:string;let entity;try{entity=entityFrom(entityName);const input:Record<string,unknown>=Object.fromEntries([...form.entries()].filter(([key])=>!key.startsWith('$ACTION_')));if(entity==='products'){
  if(input.pricing_rules)input.pricing_rules=JSON.parse(String(input.pricing_rules));
  if(input.selling_prices)input.selling_prices=JSON.parse(String(input.selling_prices));
 }
 if(entity==='customers'&&input.default_price_list==='')input.default_price_list=null;
 recordId=await saveMaster(actor,entity,{...input,active:input.active==='on'},id,version);}catch(e){return {error:message(e)};}revalidatePath(`/masters/${entity}`);redirect(`/masters/${entity}/${recordId}?saved=1`);}
export async function saveAccount(id:string|undefined,version:number|undefined,_:FormState,form:FormData):Promise<FormState>{const actor=await requireUser();try{
 const overrides=Object.fromEntries([...form.entries()].filter(([key,value])=>key.startsWith('permission:')&&value!=='inherit').map(([key,value])=>[key.slice(11),value]));
 await saveUser(actor,{name:form.get('name'),email:form.get('email'),password:form.get('password'),roles:form.getAll('roles'),active:form.get('active')==='on',permission_overrides:overrides},id,version);
 }catch(e){return {error:message(e)};}revalidatePath('/administration');redirect('/administration?saved=1');}
