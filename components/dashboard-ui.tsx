import type {ReactNode} from 'react';
import Icon from './icon';
export function DashboardPanel({title,icon,action,children,className=''}:{title:string;icon:string;action?:ReactNode;children:ReactNode;className?:string}){return <section className={`dashboard-panel ${className}`}><header><h2><Icon name={icon} size={22}/>{title}</h2>{action}</header><div className="dashboard-panel-body">{children}</div></section>;}
export function KpiCard({label,value,icon,note}:{label:string;value:string;icon:string;note:string}){return <section className="kpi-card"><div className="kpi-icon"><Icon name={icon} size={31}/></div><div><h2>{label}</h2><strong>{value}</strong><p>{note}</p></div></section>;}
export function EmptyState({children}:{children:ReactNode}){return <div className="dashboard-empty">{children}</div>;}
export function money(value:unknown){return new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2}).format(Number(value||0));}
