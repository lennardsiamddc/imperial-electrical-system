import {requireUser} from '@/lib/auth';
import {quotationDefaults} from '@/lib/quotation-defaults';
import QuotationSettings from '@/components/quotation-settings';
export default async function Page(){const actor=await requireUser();if(!actor.roles.includes('PRESIDENT_ADMIN'))return <h1>Owner access required</h1>;return <><h1>Quotation defaults</h1><p>Changes apply to new quotations. Saved quotations retain their own text.</p><QuotationSettings initial={await quotationDefaults(actor)}/></>;}
