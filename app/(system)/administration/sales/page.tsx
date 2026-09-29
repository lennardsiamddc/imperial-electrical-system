import {requireUser} from '@/lib/auth';
import {has} from '@/lib/permissions';
import {salesOptions,returnPolicies} from '@/lib/sales-options';
import SalesSettings from '@/components/sales-settings';
export default async function Page(){const actor=await requireUser();if(!has(actor))return <h1>Access restricted</h1>;return <><h1>Sales & Returns Settings</h1><p>Manage platforms, payment methods, receiving-account labels and physical SI/DR series.</p><SalesSettings options={await salesOptions(actor,true)} policies={JSON.parse(JSON.stringify(await returnPolicies(actor)))}/></>;}
