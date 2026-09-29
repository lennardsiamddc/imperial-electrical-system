import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {canRead} from '@/lib/permissions';
export default async function Module({params}:{params:Promise<{module:string}>}){const {module}=await params;if(!['sales','inventory','purchasing','accounting','reports'].includes(module))notFound();const actor=await requireUser();return <><div className="eyebrow">Imperial workspace</div><h1 style={{textTransform:'capitalize'}}>{module}</h1>{module==='inventory'&&<Link className="button" href="/masters/products">Open Product Database →</Link>}{module==='purchasing'&&canRead(actor,'suppliers')&&<Link className="button" href="/masters/suppliers">Open Supplier Database →</Link>}<section className="panel" style={{marginTop:24}}><h2>Coming in Stage 2+</h2><p className="muted">This workflow will be connected to your customer, product and supplier records in a future stage.</p></section></>;}
