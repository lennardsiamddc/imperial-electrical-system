'use client';
import {useState} from 'react';
import type {PriceList} from '@/lib/operational-pricing';
export default function PriceListControl({value,hasItems,onChange,disabled=false}:{value:PriceList;hasItems:boolean;onChange:(value:PriceList,update:boolean)=>void;disabled?:boolean}){
 const [pending,setPending]=useState<PriceList|null>(null);
 return <div className="no-print"><label>Price List<select aria-label="Price List" value={value} disabled={disabled} onChange={e=>{const next=e.target.value as PriceList;if(hasItems)setPending(next);else onChange(next,false);}}><option>Retail</option><option>Contractor</option></select></label>{pending&&<section className="notice" role="alertdialog" aria-label="Change existing item prices"><p>Change existing item prices to the selected price list?</p><button type="button" onClick={()=>{onChange(pending,true);setPending(null);}}>Update Existing Items</button> <button type="button" onClick={()=>{onChange(pending,false);setPending(null);}}>Keep Existing Prices</button></section>}</div>;
}
