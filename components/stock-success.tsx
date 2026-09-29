import Link from 'next/link';
import {quantityText} from '@/lib/format';
export default function StockSuccess({receipt}:{receipt:Record<string,unknown>}){
 return <div className="success" role="status"><strong>Stock added successfully</strong><p>{String(receipt.product_name)} · {quantityText(receipt.quantity)} {String(receipt.uom)}<br/>Reference: {String(receipt.reference)}</p><Link href="/stock-in">Add another delivery →</Link></div>;
}
