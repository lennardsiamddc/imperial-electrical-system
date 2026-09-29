import type {FormEvent} from 'react';
export const productMainFields=['name','sku','brand','category','primary_uom'];
export const productAdvancedFields=['secondary_uom','conversion','base_price','supplier_adjustment','contractor_price','wholesale_price','meter_price','supplier_id'];
// Browser validation must reveal any invalid required field inside a disclosure.
export function openInvalidDetails(event:FormEvent){let parent=(event.target as HTMLElement).parentElement;while(parent){if(parent.tagName==='DETAILS')(parent as HTMLDetailsElement).open=true;parent=parent.parentElement;}}
