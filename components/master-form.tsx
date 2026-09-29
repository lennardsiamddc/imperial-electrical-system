'use client';
import ProductPricingEditor from './product-pricing-editor';
import VatEditor from './vat-editor';
import type {TaxConfig} from '@/lib/vat';
import ProductPriceLists from './product-price-lists';
import {useActionState,useState} from 'react';
import Link from 'next/link';
import {saveRecord} from '@/app/actions';
import {labels,defaults,choices} from '@/lib/field-labels';
import {openInvalidDetails,productMainFields,productAdvancedFields} from '@/lib/form-presentation';
export default function MasterForm({entity,fields,record,options,taxConfig}:{entity:string;fields:string[];record?:Record<string,unknown>;options:Record<string,unknown>[];taxConfig?:TaxConfig}){
 const [primary,setPrimary]=useState(String(record?.primary_uom||'PCS')),[secondary,setSecondary]=useState(String(record?.secondary_uom||''));
 const [state,action,pending]=useActionState(saveRecord.bind(null,entity,record?String(record.id):undefined,record?Number(record.version):undefined),{error:''});
 const renderField=(key:string)=>{const value=record?.[key]??defaults[key]??'',wide=key.includes('address')||key.includes('notes'),required=['name','code','sku'].includes(key);return <label className={key==='active'?'check':wide?'wide':''} key={key}>{key==='active'?<><input type="checkbox" name={key} defaultChecked={Boolean(value)}/>Active</>:<>{entity==='products'?({name:'Product Name',sku:'SKU / Product Code',primary_uom:'Unit',reorder_level:'Low Stock Level'} as Record<string,string>)[key]||labels[key]:labels[key]||key}{required?' *':''}{choices[key]?<select name={key} defaultValue={String(value)} onChange={e=>{if(key==='primary_uom')setPrimary(e.target.value);if(key==='secondary_uom')setSecondary(e.target.value);}}>{choices[key].map(v=><option key={v} value={v}>{v||'None'}</option>)}</select>:key.endsWith('_id')?<select name={key} defaultValue={String(value)} onChange={e=>{if(key==='primary_uom')setPrimary(e.target.value);if(key==='secondary_uom')setSecondary(e.target.value);}}><option value="">Unassigned</option>{options.map(o=><option value={String(o.id)} key={String(o.id)}>{String(o.name)}</option>)}</select>:wide?<textarea name={key} defaultValue={Array.isArray(value)?value.join('\n'):String(value)} maxLength={1000} placeholder="Optional notes"/>:<input name={key} defaultValue={String(value)} type={key==='email'?'email':'text'} required={required} placeholder={key==='name'?'e.g. THHN Wire 3.5mm²':key==='sku'?'e.g. WIRE-THHN-35':undefined} maxLength={key==='sku'||key==='code'?60:key==='name'?200:1000}/>}</>}</label>;};
 const product=entity==='products';
 return <form onReset={event=>event.preventDefault()} action={action} className="panel" onInvalidCapture={openInvalidDetails} aria-busy={pending}><p className="muted">* Required fields</p>{state.error&&<div className="error" role="alert">{state.error}</div>}
 <div className="form-grid">{(product?productMainFields.filter(k=>fields.includes(k)):fields).map(renderField)}</div>
 {product&&taxConfig&&<>
  {['vat_status','vat_rate'].filter(k=>fields.includes(k)).map(k=><input type="hidden" name={k} key={k} value={String(record?.[k]??defaults[k])}/>)}
  {fields.includes('pricing_rules')?<><label>Supplier VAT tag<select name="cost_entry_mode" defaultValue={String(record?.cost_entry_mode||'VAT Exclusive')}><option value="VAT Inclusive">VAT INC</option><option value="VAT Exclusive">VAT EX</option></select></label><ProductPricingEditor units={[primary,secondary]} primary={primary} record={record}/></>:fields.includes('standard_cost')&&<VatEditor side="cost" amountName="standard_cost" amountLabel="Cost (₱)" record={record} config={taxConfig} required={!record||!!record.cost_vat}/>}
  {!fields.includes('pricing_rules')&&fields.includes('selling_prices')&&<ProductPriceLists units={[primary,secondary]} primary={primary} record={record}/>}
 </>}
 {product&&<>{['wholesale_price','meter_price'].filter(k=>fields.includes(k)).map(k=><input key={k} type="hidden" name={k} value={String(record?.[k]??defaults[k]??'')}/>)}<div className="form-grid">{['reorder_level','active','notes'].filter(k=>fields.includes(k)).map(renderField)}</div><details className="advanced"><summary>View Details — additional prices and units</summary><p className="muted">Retail and Contractor prices are entered separately for each supported unit. Cost is per main unit. Keep existing unit conversions unchanged after stock has been added.</p><div className="form-grid">{productAdvancedFields.filter(k=>fields.includes(k)&&!['contractor_price','wholesale_price','meter_price',...(fields.includes('pricing_rules')?['base_price','supplier_adjustment']:[])].includes(k)).map(renderField)}</div></details></>}
 <div className="actions"><button disabled={pending}>{pending?'Saving…':product?'Save product':'Save record'}</button><Link className="button secondary" href={`/masters/${entity}${record?`/${record.id}`:''}`}>Cancel</Link></div></form>;
}
