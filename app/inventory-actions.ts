'use server';
import {requireUser} from '@/lib/auth';
import {postMovement} from '@/lib/inventory';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {formError} from '@/lib/form-errors';
export async function receiveStock(_: {error:string},form:FormData){
 const actor=await requireUser();let product='',receipt='';
 try{
  const input:Record<string,unknown>=Object.fromEntries([...form.entries()].filter(([key])=>!key.startsWith('$ACTION_')));
  // Stock-in is the only public mutation in Stage 2. No client can select OUT or an actor.
  if('kind' in input||'actor_id' in input)throw new Error('Invalid stock receipt.');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(input.local_time)))throw new Error('Choose a valid received date and time.');
  input.occurred_at=String(input.local_time)+':00+08:00';
  delete input.local_time;
  if(!['VAT Inclusive','VAT Exclusive'].includes(String(input.cost_entry_mode)))throw new Error('Choose VAT INC or VAT EX as the supplier tag.');
  product=String(input.product_id);
  receipt=await postMovement(actor,{...input,kind:'IN'});
 }catch(e){return {error:formError(e)};}
 revalidatePath('/inventory');redirect(`/inventory?product=${product}&saved=1&receipt=${receipt}`);
}
