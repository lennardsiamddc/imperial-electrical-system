'use client';
import type {TaxConfig} from '@/lib/vat';
export default function VatEditor({side,amountName,amountLabel,record}:{side:'cost'|'selling';amountName:string;amountLabel:string;record?:Record<string,unknown>;config:TaxConfig;quantity?:string;places?:2|6;required?:boolean}){
 return <fieldset className="panel"><div className="form-grid"><label>{amountLabel}<input name={amountName} defaultValue={String(record?.[amountName]??'0')} required inputMode="decimal"/></label>{side==='cost'&&<label>Supplier VAT tag<select name="cost_entry_mode" defaultValue={String(record?.cost_entry_mode||'VAT Exclusive')}><option value="VAT Inclusive">VAT INC</option><option value="VAT Exclusive">VAT EX</option></select><small>Information only. The entered cost is unchanged.</small></label>}</div></fieldset>;
}
