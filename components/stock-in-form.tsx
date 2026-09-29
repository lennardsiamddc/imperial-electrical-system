'use client';
import VatEditor from './vat-editor';
import type {TaxConfig} from '@/lib/vat';
import {useActionState,useState} from 'react';
import {receiveStock} from '@/app/inventory-actions';
import {openInvalidDetails} from '@/lib/form-presentation';
export default function StockInForm({product,requestId,suppliers,taxConfig}:{product:Record<string,unknown>;requestId:string;suppliers:Record<string,unknown>[];taxConfig:TaxConfig}){
 const [quantity,setQuantity]=useState('');
 const [state,action,pending]=useActionState(receiveStock,{error:''});
 return <form onReset={event=>event.preventDefault()} action={action} className="panel stock-in-form" onInvalidCapture={openInvalidDetails} aria-busy={pending}><h2>{String(product.name)}</h2><p className="muted">{String(product.sku)} · * Required fields. Check the quantity, unit and reference before adding stock.</p>{state.error&&<p className="error" role="alert">{state.error}</p>}
 <input type="hidden" name="product_id" value={String(product.id)}/><input type="hidden" name="request_id" value={requestId}/>
 <div className="form-grid"><label>Quantity *<input name="quantity" required inputMode="decimal" placeholder="e.g. 10" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><label>Unit *<select name="uom">{[product.primary_uom,product.secondary_uom].filter(Boolean).map(u=><option key={String(u)}>{String(u)}</option>)}</select></label></div>
 <VatEditor side="cost" amountName="unit_cost" amountLabel="Cost per selected unit (₱)" record={{...product,unit_cost:'0'}} config={taxConfig} quantity={quantity} places={6}/>
 <div className="form-grid"><label>Supplier<select name="supplier_id" defaultValue={String(product.supplier_id||'')}><option value="">Not specified</option>{suppliers.map(s=><option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>)}</select></label>
 <label>Reference *<input name="reference" required maxLength={100} placeholder="Invoice / DR / reference number"/></label><label className="wide">Notes<textarea name="notes" maxLength={1000} placeholder="Optional — do not include confidential prices"/></label></div>
 <details className="advanced"><summary>Received date and time</summary><label>Received date/time (Manila) *<input type="datetime-local" required name="local_time" defaultValue={new Date(Date.now()+8*3600000).toISOString().slice(0,16)}/></label></details>
 <div className="actions"><button disabled={pending}>{pending?'Adding stock…':'Stock In'}</button></div></form>;
}
