'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type Product={id:string;name:string;sku:string;brand:string;active:boolean};
export default function ProductSearch({stockIn=false}:{stockIn?:boolean}){
 const [q,setQ]=useState(''),[results,setResults]=useState<Product[]>([]),[status,setStatus]=useState(''),[more,setMore]=useState(false);
 useEffect(()=>{
  if(!q.trim()){setResults([]);setStatus('Type a product name, code or brand.');setMore(false);return;}
  const controller=new AbortController();setStatus('Searching…');setResults([]);setMore(false);
  const timer=setTimeout(async()=>{try{const response=await fetch(`/api/products/search?q=${encodeURIComponent(q)}${stockIn?'&active=true':''}`,{signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.error);if(controller.signal.aborted)return;setResults(body.data);setMore(body.more);setStatus(body.data.length?'':'No matching products. Try another name, code or brand.');}catch(e){if(!controller.signal.aborted)setStatus(e instanceof Error?e.message:'Unable to search. Please try again.');}},250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[q,stockIn]);
 return <section className="panel product-search"><label>Find a product<input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search product name, code or brand…" autoComplete="off" maxLength={100} aria-describedby="product-search-help"/></label><p id="product-search-help" className="muted">{stockIn?'Search, then choose a product to add stock.':'Type to find a product. Use Tab to move through results and Enter to open.'}</p><p role="status" aria-live="polite">{status}</p>{results.length>0&&<ul className="search-results">{results.map(p=><li key={p.id}><Link href={stockIn?`/stock-in?product=${p.id}`:`/masters/products/${p.id}`}><strong>{p.name}</strong><small>{p.sku}{p.brand?` · ${p.brand}`:''}{!p.active?' · Inactive':''}</small>{stockIn&&<span>Add stock →</span>}</Link></li>)}</ul>}{more&&<p className="muted">Showing the first 20 matches. Keep typing to narrow your search.</p>}</section>;
}
