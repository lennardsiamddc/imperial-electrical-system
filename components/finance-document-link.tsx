import Link from 'next/link';
import {allows,type Actor} from '@/lib/permissions';
import {listAR} from '@/lib/finance-read';
import {money} from './dashboard-ui';
export default async function FinanceDocumentLink({actor,number}:{actor:Actor;number:string}){if(!allows(actor,'ar.read'))return null;const rows=(await listAR(actor,{q:number})).rows.filter(r=>r.source_number===number);return rows.length?<section className="panel"><h2>Receivable / Payment</h2>{rows.map(r=><p key={r.id}><Link href={'/accounts-receivable/'+r.id}>{r.number}</Link> · {r.payment_status} · Outstanding {money(r.balance)} · Due {r.due_date}</p>)}</section>:null;}
