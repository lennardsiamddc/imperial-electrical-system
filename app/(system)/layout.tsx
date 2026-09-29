import {transaction} from '@/lib/db';
import {financeReady} from '@/lib/finance';
import {requireUser} from '@/lib/auth';
import Nav from '@/components/nav';
import AppHeader from '@/components/app-header';
import {commercialReady} from '@/lib/commercial-read';
import {navigationItems} from '@/lib/navigation';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}){const actor=await requireUser(),stage4=await commercialReady(),stage5=await transaction(financeReady);return <div className="shell"><AppHeader actor={actor}/><aside className="sidebar"><Nav items={navigationItems(actor).filter(i=>stage5||!['/accounts-receivable','/collections','/checks'].includes(i.url)).filter(i=>stage4||!['/quotations','/orders','/delivery-receipts','/sales-invoices','/delivery-receipts/new','/sales-invoices/new'].includes(i.url))}/></aside><div className="workspace"><main>{children}</main><footer className="app-footer"><span>Imperial Electrical and Industrial Supply Corporation<small>Business Management System · v0.1.0</small></span><a href="/">Dashboard</a></footer></div></div>;}
