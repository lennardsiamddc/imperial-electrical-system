import {ZodError} from 'zod';
import {labels} from './field-labels';
export function formError(error:unknown){
 if(error instanceof ZodError)return error.issues.map(issue=>{
  const field=String(issue.path[0]||'');
  if(['uom','primary_uom','secondary_uom'].includes(field))return 'Please select a valid unit.';
  if(field==='quantity')return 'Please enter a valid quantity (up to 6 decimal places).';
  if(field.endsWith('_entry_mode'))return 'Please select EX or INC for each amount.';
  if(field.endsWith('_tax_treatment'))return 'Please choose the approved tax treatment under Tax options.';
  if(field==='reference')return 'Please enter a reference of up to 100 characters.';
  if(field==='unit_cost')return 'Please enter a valid cost (up to 6 decimal places).';
  if(issue.message.startsWith('Invalid')||issue.message.startsWith('Too '))return `Please check ${labels[field]?.toLowerCase()||'the highlighted details'} and try again.`;
  return `${labels[field]||'Entry'}: ${issue.message}`;
 }).join(' ');
 if((error as {code?:string})?.code==='23505')return 'This email, code or SKU already exists.';
 if(error instanceof Error&&!('code' in error))return error.message;
 return 'Unable to save. Check your entries and try again.';
}
