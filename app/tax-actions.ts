'use server';
import {requireUser} from '@/lib/auth';
export async function updateTaxSettings(_: {error:string},_form:FormData){await requireUser();return {error:'Operational VAT calculations are disabled. Historical tax settings are retained unchanged.'};}
