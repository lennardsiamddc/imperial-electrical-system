'use client';
import {useEffect,useId,useRef,type ReactNode} from 'react';
/** Native dialog preserves focus trapping, Escape and focus restoration. */
export default function Dialog({open,title,onClose,children}:{open:boolean;title:string;onClose:()=>void;children:ReactNode}){const ref=useRef<HTMLDialogElement>(null),id=useId();useEffect(()=>{if(open&&!ref.current?.open)ref.current?.showModal();else if(!open&&ref.current?.open)ref.current.close();},[open]);return <dialog ref={ref} aria-labelledby={id} onCancel={onClose} onClose={onClose}><div className="page-head"><h2 id={id}>{title}</h2><button type="button" className="button secondary" onClick={onClose} aria-label="Close dialog">×</button></div>{children}</dialog>;}
