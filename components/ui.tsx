import type {ReactNode} from 'react';
export function StatusBadge({active}:{active:boolean}){return <span className={`badge ${active?'':'off'}`}>{active?'Active':'Disabled'}</span>;}
export function PageHeader({eyebrow,title,description,actions}:{eyebrow:string;title:string;description:string;actions?:ReactNode}){return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="muted">{description}</p></div>{actions}</div>;}
export function Notice({children,kind='info'}:{children:ReactNode;kind?:'info'|'success'|'error'}){return <div className={kind==='info'?'notice':kind} role={kind==='error'?'alert':'status'}>{children}</div>;}

// Presentation primitives for current and future modules; no business behavior.
export function Card({children,className=''}:{children:ReactNode;className?:string}){return <section className={`panel ${className}`}>{children}</section>;}
export function Button({secondary=false,className='',...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{secondary?:boolean}){return <button {...props} className={`${secondary?'button secondary':'button'} ${className}`}/>;}
export function Field({label,children}:{label:string;children:ReactNode}){return <label>{label}{children}</label>;}
export function Input(props:React.InputHTMLAttributes<HTMLInputElement>){return <input {...props}/>;}
export function Select(props:React.SelectHTMLAttributes<HTMLSelectElement>){return <select {...props}/>;}
export function SearchField(props:React.InputHTMLAttributes<HTMLInputElement>){return <input type="search" {...props}/>;}
export function Table({children,label}:{children:ReactNode;label:string}){return <div className="table-wrap"><table aria-label={label}>{children}</table></div>;}
export function EmptyState({children}:{children:ReactNode}){return <div className="empty">{children}</div>;}
