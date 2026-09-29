'use client';
import {useState,useRef,useLayoutEffect,type InputHTMLAttributes} from 'react';
import {formatPesos} from '@/lib/currency-display';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'> & {value:string;onValueChange:(value:string)=>void};
export default function CurrencyInput({value,onValueChange,onFocus,onBlur,readOnly,...props}:Props){
 const input=useRef<HTMLInputElement>(null);
 const [editing,setEditing]=useState(false),[buffer,setBuffer]=useState('');
 useLayoutEffect(()=>{if(editing)input.current?.select();},[editing]);
 return <input ref={input} {...props} type="text" inputMode="decimal" readOnly={readOnly} value={editing?buffer:value===''?'':formatPesos(value)} onFocus={e=>{if(!readOnly){setBuffer(value);setEditing(true);}onFocus?.(e);}} onChange={e=>{const raw=e.target.value.replace(/[₱,\s]/g,'');setBuffer(raw);onValueChange(raw);}} onBlur={e=>{setEditing(false);onBlur?.(e);}}/>;
}
