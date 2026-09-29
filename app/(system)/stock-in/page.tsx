import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {requireUser} from '@/lib/auth';
import {allows} from '@/lib/permissions';
import {getMaster,options} from '@/lib/masters';
import {getTaxDefaults} from '@/lib/tax-settings';
import ProductSearch from '@/components/product-search';
import StockInForm from '@/components/stock-in-form';
export default async function StockIn({searchParams}:{searchParams:Promise<{product?:string}>}){
 const actor=await requireUser();if(!allows(actor,'inventory.receive'))return <section className="panel"><h1>Stock In access restricted</h1><p>Ask the Owner if you need to receive stock.</p></section>;
 const {product:id}=await searchParams;
 const product=id?await getMaster(actor,'products',id):undefined;
 return <><div className="page-head"><div><h1>Stock In</h1><p className="muted">Add a delivery to your stock.</p></div><Link className="button secondary" href="/inventory">View inventory</Link></div>{!product?<ProductSearch stockIn/>:<><Link href="/stock-in">← Choose another product</Link>{product.active?<StockInForm key={String(product.id)} product={product} requestId={randomUUID()} suppliers={await options(actor,'products')} taxConfig={await getTaxDefaults(actor)}/>:<p className="error">This product is inactive. Ask the Owner before adding stock.</p>}</>}</>;
}
