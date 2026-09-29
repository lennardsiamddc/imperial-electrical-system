'use client';
import {useEffect,useState} from 'react';
import type {Row} from '@/lib/sales-common';
export default function SalesSearch({kind,label,onSelect}:{kind:'products'|'customers'|'agents';label:string;onSelect:(row:Row)=>void}){
 const [q,setQ]=useState(''),[rows,setRows]=useState<Row[]>([]),[message,setMessage]=useState('');
 useEffect(()=>{if(q.trim().length<2){setRows([]);setMessage('');return;}const controller=new AbortController();const timer=setTimeout(async()=>{try{const res=await fetch('/api/sales?lookup='+kind+'&q='+encodeURIComponent(q),{signal:controller.signal});const body=await res.json();if(!res.ok)throw new Error(body.error);setRows(body.data);setMessage(body.data.length?'':'No matching active records.');}catch(e){if(!controller.signal.aborted)setMessage(e instanceof Error?e.message:'Search failed.');}},200);return()=>{clearTimeout(timer);controller.abort();};},[q,kind]);
 return <div className="product-search"><label>{label}<input value={q} onChange={e=>setQ(e.target.value)} placeholder={kind==='products'?'Type product name, SKU or brand':'Type at least 2 characters'} autoComplete="off"/></label><p role="status">{message}</p>{rows.length>0&&<ul className="search-results">{rows.map(r=><li key={r.id}><button type="button" className="sales-search-option" onClick={()=>{onSelect(r);setQ('');setRows([]);}}><strong>{r.name}</strong><small>{r.sku||r.code||''} {r.brand||''}{r.available!==undefined?' · Available '+r.available+' '+(r.secondary_uom||r.primary_uom):''}</small></button></li>)}</ul>}</div>;
}
