'use client';
import {useRef} from 'react';
// Keep the same id when retrying unchanged data after an interrupted response.
export function useSubmission(){const current=useRef({signature:'',id:''});return (payload:unknown)=>{const signature=JSON.stringify(payload);if(current.current.signature!==signature)current.current={signature,id:crypto.randomUUID()};return current.current.id;};}
