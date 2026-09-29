import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {query,closeDB} from '../lib/db';
import {saveUser} from '../lib/users';
import {permissionKeys,type Actor} from '../lib/permissions';
import {saveCommercial,actCommercial,createCommercialChild,assignCommercialNumber} from '../lib/commercial';
import {getCommercial} from '../lib/commercial-read';
import {getAR} from '../lib/finance-read';
import {businessDate} from '../lib/finance';
import type {Row} from '../lib/sales-common';
async function main(){if(!process.env.LOCAL_DB_PATH?.includes('stage5-acceptance'))throw new Error('Isolated acceptance DB only');const original=(await query<Actor>("SELECT id,name,email,roles FROM users WHERE active AND 'PRESIDENT_ADMIN'=ANY(roles) LIMIT 1")).rows[0];const password='TEST Stage5 acceptance password';
 const ownerId=await saveUser(original,{name:'TEST Stage5 Owner',email:'owner-stage5@example.test',roles:['PRESIDENT_ADMIN'],password,active:true});
 await saveUser(original,{name:'TEST Stage5 Accounting',email:'accounting-stage5@example.test',roles:['ACCOUNTING'],password,active:true,permission_overrides:Object.fromEntries(permissionKeys.filter(p=>p.startsWith('ar.')||p.startsWith('collections.')).map(p=>[p,'allow']))});
 await saveUser(original,{name:'TEST Stage5 Sales',email:'sales-stage5@example.test',roles:['SALES'],password,active:true,permission_overrides:{'ar.read':'allow','ar.customer':'allow'}});
 await saveUser(original,{name:'TEST Stage5 Restricted',email:'restricted-stage5@example.test',roles:['WAREHOUSE'],password,active:true});
 const owner:Actor={id:ownerId,name:'TEST Stage5 Owner',email:'owner-stage5@example.test',roles:['PRESIDENT_ADMIN']};const customer=(await query<Row>('SELECT id FROM customers WHERE active ORDER BY created_at LIMIT 1')).rows[0],product=(await query<Row>("SELECT id FROM products WHERE active AND primary_uom='PCS' ORDER BY created_at LIMIT 1")).rows[0];const tax=(await query<Row>('SELECT version FROM tax_settings')).rows[0];
 const order=await saveCommercial(owner,{request_id:randomUUID(),kind:'SO',channel:'Wholesale',customer_id:customer.id,occurred_at:businessDate()+'T00:00:00Z',terms:'30 Days',tax_config_version:tax.version,notes:'TEST STAGE 5 isolated browser acceptance',lines:[{id:randomUUID(),product_id:product.id,quantity:'1',uom:'PCS',price:'500000',vat_mode:'VAT Inclusive',tax_treatment:'VATable',discount:'0'}]});await actCommercial(owner,{id:order,version:1,request_id:randomUUID(),action:'confirm'});const o=await getCommercial(owner,order);const si=await createCommercialChild(owner,{order_id:order,kind:'SI',request_id:randomUUID(),occurred_at:businessDate()+'T00:00:00Z',lines:[{source_line_id:o.lines[0].id,quantity:'1'}]});const series=(await query<Row>("SELECT id FROM sales_options WHERE kind='si_series' AND active LIMIT 1")).rows[0];await assignCommercialNumber(owner,{id:si,version:1,request_id:randomUUID(),series_id:series.id,number:'TEST-STAGE5-004821'});await actCommercial(owner,{id:si,version:2,request_id:randomUUID(),action:'finalize'});const ar=(await query<Row>('SELECT id FROM receivables WHERE invoice_id=$1',[si])).rows[0].id;await writeFile('test-results/stage5-browser-fixture.json',JSON.stringify({order,si,ar,customer:customer.id},null,2));console.log('Isolated TEST invoice ready', (await getAR(owner,ar)).number);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(closeDB);
