export const roles=['PRESIDENT_ADMIN','SALES','WAREHOUSE','ACCOUNTING','PURCHASING'] as const;
export type Role=typeof roles[number];
export const roleLabels:Record<Role,string>={PRESIDENT_ADMIN:'Owner/Admin',SALES:'Sales',WAREHOUSE:'Warehouse / Inventory',ACCOUNTING:'Accounting',PURCHASING:'Purchasing'};
export const permissionKeys=['vat.reference','ar.read','ar.generate','ar.aging','ar.overdue','ar.due','ar.paid','ar.customer','ar.followups','ar.followup.add','ar.promise','ar.promise.edit','ar.credit','ar.credit.edit','ar.statement','ar.adjust','collections.read','collections.record','collections.details','collections.accounts','collections.reverse','collections.checks','collections.check.update','collections.summary','quotations.read','quotations.create','quotations.fees','quotations.edit','quotations.approve','quotations.convert','orders.read','orders.create','orders.edit','orders.confirm','orders.cancel','deliveries.read','deliveries.create','deliveries.assign','deliveries.finalize','invoices.read','invoices.create','invoices.assign','invoices.finalize','commercial.read','commercial.prices','commercial.cancel','customers.read','customers.write','customers.credit','products.read','products.write','products.cost','products.prices','suppliers.read','suppliers.write','inventory.read','inventory.receive','inventory.issue','inventory.value','sales.read','sales.create','sales.edit','sales.post','sales.prices','sales.override','sales.discounts','sales.discount.apply','sales.payments','sales.payment.edit','sales.cogs','sales.profit','sales.margin','sales.documents','sales.documents.require','sales.si.assign','sales.dr.assign','sales.si.print','sales.dr.print','sales.documents.void','sales.cancel','customers.create','customers.edit','returns.read','returns.create','returns.approve','returns.receive','returns.condition','returns.restock','returns.reject','returns.complete','returns.financial'] as const;
export type Permission=typeof permissionKeys[number];
export type Overrides=Partial<Record<Permission,'allow'|'deny'>>;
export type Actor={id:string; name:string; email:string; roles:Role[];permission_overrides?:Overrides};
export const permissionLabels:Record<Permission,string>={
'vat.reference':'View Input / Output VAT accounting references',
'ar.read':'View AR','ar.generate':'Reconcile eligible AR','ar.aging':'View aging','ar.overdue':'View overdue balances','ar.due':'View due soon','ar.paid':'View paid history','ar.customer':'View customer outstanding','ar.followups':'View follow-ups','ar.followup.add':'Add follow-up','ar.promise':'View promise to pay','ar.promise.edit':'Edit promise to pay','ar.credit':'View credit limit','ar.credit.edit':'Edit credit limit','ar.statement':'View / generate customer statements','ar.adjust':'Approve return AR adjustment','collections.read':'View Collections','collections.record':'Record Collection','collections.details':'View payment method details','collections.accounts':'View receiving accounts','collections.reverse':'Reverse Collection','collections.checks':'View checks','collections.check.update':'Update check status','collections.summary':'View Collection summary',

 'quotations.read':'Read quotations',
 'quotations.create':'Create quotations',
 'quotations.edit':'Edit quotations',
 'quotations.fees':'Edit quotation fees (including Delivery Fee)',
 'quotations.approve':'Approve quotations',
 'quotations.convert':'Convert quotations',
 'orders.read':'Read orders',
 'orders.create':'Create orders',
 'orders.edit':'Edit orders',
 'orders.confirm':'Confirm orders',
 'orders.cancel':'Cancel orders',
 'deliveries.read':'Read deliveries',
 'deliveries.create':'Create deliveries',
 'deliveries.assign':'Assign deliveries',
 'deliveries.finalize':'Finalize deliveries',
 'invoices.read':'Read invoices',
 'invoices.create':'Create invoices',
 'invoices.assign':'Assign invoices',
 'invoices.finalize':'Finalize invoices',
 'commercial.read':'Read commercial',
 'commercial.prices':'Prices commercial',
 'commercial.cancel':'Cancel commercial',

 'customers.read':'View customers','customers.write':'Create / edit customers','customers.credit':'Customer credit information',
 'products.read':'View products','products.write':'Create / edit products','products.cost':'Confidential costs and supplier details','products.prices':'Selling prices',
 'inventory.read':'View stock and history','inventory.receive':'Post stock receipts (cost access required)','inventory.issue':'Issue stock (future integration)','inventory.value':'View inventory valuation (cost access required)',
 'suppliers.read':'View suppliers','suppliers.write':'Create / edit suppliers',
'sales.read':'View Sales',
'sales.create':'Create Sales',
'sales.edit':'Edit Draft Sales',
'sales.post':'Post Sales (stock issue access also required)',
'sales.prices':'View Sales selling prices',
'sales.override':'Override Sales prices',
'sales.discounts':'View Sales discounts',
'sales.discount.apply':'Apply Sales discounts',
'sales.payments':'View Sales payment information',
'sales.payment.edit':'Edit Draft payment information',
'sales.cogs':'View Sales COGS (cost access required)',
'sales.profit':'View Sales profit',
'sales.margin':'View Sales margin',
'sales.documents':'View SI / DR information',
'sales.documents.require':'Set SI / DR requirements',
'sales.si.assign':'Assign Sales Invoice numbers',
'sales.dr.assign':'Assign Delivery Receipt numbers',
'sales.si.print':'Prepare Sales Invoice print data / mark printed',
'sales.dr.print':'Prepare Delivery Receipt print data / mark printed',
'sales.documents.void':'Void controlled documents',
'sales.cancel':'Cancel Draft / reverse Posted Sales',
'customers.create':'Create customers',
'customers.edit':'Edit customers',
'returns.read':'View Returns',
'returns.create':'Create Return requests',
'returns.approve':'Approve Returns',
'returns.receive':'Receive returned products',
'returns.condition':'Mark Return condition',
'returns.restock':'Restock sellable Returns',
'returns.reject':'Reject Return requests',
'returns.complete':'Complete Returns',
'returns.financial':'View protected Return financial information'
};
const rolePermissions:Record<Role,readonly Permission[]>={
 PRESIDENT_ADMIN:permissionKeys,
 SALES:['quotations.fees','sales.read','sales.create','sales.edit','sales.prices','sales.discounts','sales.payments','sales.payment.edit','sales.documents','sales.documents.require','inventory.read','customers.read','customers.write','products.read','products.prices'],
 WAREHOUSE:['products.read','inventory.read'],
 ACCOUNTING:['vat.reference','quotations.fees','sales.read','sales.prices','sales.payments','sales.documents','inventory.read','customers.read','customers.write','customers.credit','products.read','products.prices'],
 PURCHASING:['inventory.read','inventory.receive','inventory.value','products.read','products.write','products.cost','products.prices','suppliers.read','suppliers.write']
};
export function allows(actor:Actor,permission:Permission):boolean{
 if(actor.roles.includes('PRESIDENT_ADMIN'))return true;
 const override=actor.permission_overrides?.[permission];
 const inherited=(permission==='customers.create'||permission==='customers.edit')?allows(actor,'customers.write'):actor.roles.some(role=>rolePermissions[role]?.includes(permission));
 const enabled=override?override==='allow':inherited;
 // Denying directory access also denies editing and its sensitive fields.
 if(!enabled)return false;
 if(permission==='vat.reference')return true;
 if(permission.startsWith('ar.')&&!allows(actor,'customers.read'))return false;
 if(permission.startsWith('collections.')&&permission!=='collections.read'&&!allows(actor,'ar.read'))return false;
 if(permission.startsWith('inventory.')&&!allows(actor,'products.read'))return false;
 if(['inventory.receive','inventory.value'].includes(permission)&&!allows(actor,'products.cost'))return false;
 if(permission.startsWith('sales.')&&permission!=='sales.read'&&!allows(actor,'sales.read'))return false;
 if(['sales.prices'].includes(permission)&&!allows(actor,'products.prices'))return false;
 if(['sales.override','sales.discounts','sales.payments','sales.si.print'].includes(permission)&&!allows(actor,'sales.prices'))return false;
 if(permission==='sales.discount.apply'&&!allows(actor,'sales.discounts'))return false;
 if(permission==='sales.payment.edit'&&!allows(actor,'sales.payments'))return false;
 if(permission==='sales.cogs'&&!allows(actor,'products.cost'))return false;
 if(['sales.profit','sales.margin'].includes(permission)&&(!allows(actor,'sales.cogs')||!allows(actor,'sales.prices')))return false;
 if(permission.startsWith('sales.')&&(permission.includes('.si.')||permission.includes('.dr.')||permission.startsWith('sales.documents.'))&&!allows(actor,'sales.documents'))return false;
 if(permission.startsWith('returns.')&&!allows(actor,'sales.read'))return false;
 if(permission==='returns.financial'&&(!allows(actor,'sales.cogs')||!allows(actor,'sales.prices')))return false;
 if(permission==='commercial.prices'&&!allows(actor,'sales.prices'))return false;
 if(['quotations','orders','deliveries','invoices'].includes(permission.split('.')[0])&&!allows(actor,'commercial.read'))return false;
 const directory=permission.split('.')[0];
 return permission.endsWith('.read')||allows(actor,`${directory}.read` as Permission);
}
export type Entity='customers'|'products'|'suppliers';
export function has(actor:Actor,...allowed:Role[]){return actor.roles.includes('PRESIDENT_ADMIN')||actor.roles.some(r=>allowed.includes(r));}
export function canRead(actor:Actor,entity:Entity){return allows(actor,`${entity}.read`);}
export function canWrite(actor:Actor,entity:Entity){return allows(actor,`${entity}.write`);}
export function assertAllowed(ok:boolean){if(!ok)throw new Error('You do not have permission for this action.');}
export const costFields=['base_price','supplier_adjustment','standard_cost','supplier_id','cost_tax_treatment','cost_entry_mode','cost_input_vat_recoverable','cost_vat'];
export const sellingFields=['selling_prices','vat_status','vat_rate','retail_price','contractor_price','wholesale_price','meter_price','selling_tax_treatment','selling_entry_mode','selling_vat'];
export const creditFields=['payment_terms','credit_limit','credit_notes','account_status'];
export function permittedFields(actor:Actor,entity:Entity,fields:string[]){return fields.filter(f=>{
 if(entity==='products'&&f==='pricing_rules')return allows(actor,'products.cost')&&allows(actor,'products.prices');
 if(entity==='products'&&costFields.includes(f))return allows(actor,'products.cost');
 if(entity==='products'&&sellingFields.includes(f))return allows(actor,'products.prices');
 if(entity==='customers'&&f==='credit_limit'&&actor.permission_overrides?.['ar.credit']==='deny'&&!actor.roles.includes('PRESIDENT_ADMIN'))return false;
 if(entity==='customers'&&creditFields.includes(f))return allows(actor,'customers.credit');
 return true;
});}
