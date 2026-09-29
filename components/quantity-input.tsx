'use client';
import {useState,type InputHTMLAttributes} from 'react';
import {formatQuantity} from '@/lib/quantity-display';
export default function QuantityInput({value,onChange,onFocus,onBlur,...props}:InputHTMLAttributes<HTMLInputElement>){
 const [editing,setEditing]=useState(false),[buffer,setBuffer]=useState('');
 const display=formatQuantity(value as string|number|undefined);
 return <input {...props} value={editing?buffer:display} onFocus={e=>{setBuffer(display);setEditing(true);onFocus?.(e);}} onChange={e=>{setBuffer(e.target.value);onChange?.(e);}} onBlur={e=>{setEditing(false);onBlur?.(e);}}/>;
}
