import {listAR,listCollections} from '@/lib/finance-read';
import Link from 'next/link';
import {listCommercial} from '@/lib/commercial-read';
import {requireUser} from '@/lib/auth';
import {allows} from '@/lib/permissions';
import {listMaster} from '@/lib/masters';
import {listSales} from '@/lib/sales-read';
import {PageHeader} from '@/components/ui';
export default async function Search({searchParams}:{searchParams:Promise<{q?:string}>}){const actor=await requireUser(),q=((await searchParams).q||'').trim().slice(0,160);const groups:{label:string;rows:{id:string;name:string;url:string}[]}[]=[];
 if(q){for(const entity of ['products','customers','suppliers'] as const){if(allows(actor,`${entity}.read`)){const rows=await listMaster(actor,entity,q);groups.push({label:entity[0].toUpperCase()+entity.slice(1),rows:rows.slice(0,8).map(r=>({id:String(r.id),name:String(r.name),url:`/masters/${entity}/${r.id}`}))});}}if(allows(actor,'sales.read')){const rows=await listSales(actor,{q});groups.push({label:'Sales & document references',rows:rows.slice(0,8).map(r=>({id:String(r.id),name:String(r.number),url:`/sales/${r.id}`}))});}}
 if(q&&allows(actor,'commercial.read')){const docs=await listCommercial(actor,{q});groups.push({label:'Quotations, Orders, Deliveries & Invoices',rows:docs.slice(0,12).map(r=>({id:r.id,name:r.number+(r.physical_number?' / #'+r.physical_number:''),url:'/commercial/'+r.id}))});}
 if(q&&allows(actor,'ar.read'))groups.push({label:'Accounts Receivable',rows:(await listAR(actor,{q})).rows.slice(0,12).map(r=>({id:r.id,name:r.number+' / '+r.physical_number,url:'/accounts-receivable/'+r.id}))});
 if(q&&allows(actor,'collections.read'))groups.push({label:'Collections',rows:(await listCollections(actor,{q})).rows.slice(0,12).map(r=>({id:r.id,name:r.number,url:'/collections/'+r.id}))});
 return <><PageHeader eyebrow="Workspace" title="Search" description={q?`Results for “${q}” in the areas you can access.`:'Search products, customers, suppliers and Sales/document references.'}/><form className="panel toolbar"><label>Search<input name="q" defaultValue={q} required maxLength={160}/></label><button>Search</button></form>{groups.map(g=><section className="panel" key={g.label}><h2>{g.label}</h2>{g.rows.length?<ul className="search-results">{g.rows.map(r=><li key={r.id}><Link href={r.url}>{r.name} →</Link></li>)}</ul>:<p className="muted">No matching records.</p>}</section>)}</>;
}
