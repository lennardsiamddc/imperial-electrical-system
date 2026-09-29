import {Money} from './vat';
// Presentation only: no rounding, fixed precision, or binary-number conversion.
export function formatQuantity(value:string|number|null|undefined):string{
 if(value===null||value===undefined||value==='')return '';
 try{const quantity=new Money(value);return quantity.isFinite()?quantity.toFixed():String(value);}catch{return String(value);}
}
