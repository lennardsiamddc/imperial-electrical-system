import {Money} from './vat';
// Currency presentation only. Never pass this rounded string back to calculation/storage.
export function formatPesos(value:string|number):string{
 try{return '₱'+new Money(value||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');}catch{return String(value);}
}
