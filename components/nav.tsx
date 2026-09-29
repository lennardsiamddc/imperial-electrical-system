'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import Icon from './icon';
const icons:Record<string,string>={'Dashboard':'home','Products':'box','Inventory':'box','Stock In':'stock','Sales':'cart','Returns':'return','Customers':'users','Suppliers':'truck','Administration':'settings','Tax Settings':'document'};
export default function Nav({items}:{items:{name:string;url:string}[]}){const path=usePathname();return <nav className="nav" aria-label="Main navigation">{items.map(({name,url})=>{const active=url==='/'?path==='/':url==='/administration'?path==='/administration':(path===url||path.startsWith(url+'/'))&&!items.some(other=>other.url!==url&&other.url.startsWith(url+'/')&&(path===other.url||path.startsWith(other.url+'/')));return <Link key={url} href={url} aria-current={active?'page':undefined} className={active?'active':''}><Icon name={icons[name]||'document'}/><span>{name==='Stock In'?'Stock In / Receiving':name==='Returns'?'Returns & Cancellations':name}</span>{['Inventory','Sales','Returns','Administration'].includes(name)&&<Icon name="chevron" size={16}/>}</Link>;})}</nav>;}
