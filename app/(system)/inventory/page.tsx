import Link from 'next/link';
import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {allows} from '@/lib/permissions';
import {stockBalances,movementHistory} from '@/lib/inventory';
import {getMaster} from '@/lib/masters';
import {quantityText} from '@/lib/format';
import InventoryTable from '@/components/inventory-table';
import StockSuccess from '@/components/stock-success';
import InventoryHistory from '@/components/inventory-history';
export default async function Inventory({searchParams}:{searchParams:Promise<{q?:string;low?:string;status?:string;product?:string;page?:string;receive?:string;saved?:string;receipt?:string;view?:string}>}){
 const actor=await requireUser();if(!allows(actor,'inventory.read'))return <section className="panel"><h1>Access restricted</h1><p>Ask the Owner for inventory access.</p></section>;
 const s=await searchParams;if(s.receive==='1'&&s.product)redirect(`/stock-in?product=${encodeURIComponent(s.product)}`);
 const page=Math.max(1,Number.parseInt(s.page||'1')||1),history=s.view==='history'||!!s.product;
 const rows=await stockBalances(actor,{...s,page:s.product?1:page});
 const movements=history?await movementHistory(actor,{...s,page}):[];
 const selected=s.product?await getMaster(actor,'products',s.product):undefined;
 const financial=allows(actor,'inventory.value'),receive=allows(actor,'inventory.receive');
 const posted=s.saved?movements.find(m=>m.id===s.receipt):undefined;
 const pageLink=(n:number)=>`?${new URLSearchParams({...Object.fromEntries(Object.entries(s).filter(([k,v])=>v!==undefined&&!['saved','receipt'].includes(k))) as Record<string,string>,page:String(n)})}`;
 return <><div className="page-head"><div><h1>{selected?String(selected.name):'Inventory'}</h1><p className="muted">Find stock levels and recent activity.</p></div>{receive&&<Link className="button" href={selected?`/stock-in?product=${selected.id}`:'/stock-in'}>+ Stock In</Link>}</div>
 {posted&&<StockSuccess receipt={posted}/>}
 {!selected&&<nav className="filter-links" aria-label="Stock filters"><Link href="/inventory" aria-current={!s.low&&!history?'page':undefined}>All</Link><Link href="/inventory?low=true" aria-current={s.low==='true'?'page':undefined}>Low Stock</Link><Link href="/inventory?view=history" aria-current={history?'page':undefined}>Stock Activity</Link></nav>}
 <form className="toolbar panel">{s.product&&<input type="hidden" name="product" value={s.product}/>}<input type="hidden" name="view" value={history?'history':'balances'}/>{s.low&&<input type="hidden" name="low" value={s.low}/>}<label>Search<input name="q" defaultValue={s.q} placeholder={history?'Product name, code or reference':'Product name, code or brand'}/></label>{!history&&<label>Status<select name="status" defaultValue={s.status||''}><option value="">All products</option><option value="true">Active</option><option value="false">Inactive</option></select></label>}<button>Search</button><Link href="/inventory">Clear filters</Link></form>
 {(!history||selected)&&<InventoryTable rows={rows.slice(0,50)} financial={financial} receive={receive}/>}
 {selected&&<details className="panel advanced"><summary>Stock Details</summary><p>Unit: {String(selected.secondary_uom||selected.primary_uom)}. {Boolean(selected.secondary_uom)&&`1 ${selected.primary_uom} = ${quantityText(selected.conversion)} ${selected.secondary_uom}.`} Low Stock Level: {quantityText(selected.reorder_level)} {String(selected.primary_uom)}.</p>{rows[0]&&<p>Total stock in: {quantityText(rows[0].stock_in)} {String(rows[0].stock_uom)} · Total stock out: {quantityText(rows[0].stock_out)} {String(rows[0].stock_uom)}</p>}<Link href={`/masters/products/${selected.id}`}>View product →</Link></details>}
 {history&&<section className="panel" style={{marginTop:24}}><h2>Stock Activity</h2><InventoryHistory rows={movements.slice(0,50)} financial={financial}/></section>}
 <div className="pagination">{page>1?<Link href={pageLink(page-1)}>← Previous</Link>:<span/>}<span>Page {page} · up to 50 {history?'entries':'products'}</span>{(history?movements:rows).length>50?<Link href={pageLink(page+1)}>Next →</Link>:<span/>}</div>
 {financial&&<details className="advanced"><summary>About inventory value</summary><p>Inventory value uses receipt costs less weighted-average stock-out costs. New receipts use entered cost without VAT adjustments. Earlier entries keep their original recorded values.</p></details>}
 </>;
}
