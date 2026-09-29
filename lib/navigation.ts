import {allows,type Actor} from './permissions';
export function navigationItems(actor:Actor){
 return [
  {name:'Dashboard',url:'/'},
  ...(allows(actor,'products.read')?[{name:'Products',url:'/masters/products'}]:[]),
  ...(allows(actor,'inventory.read')?[{name:'Inventory',url:'/inventory'}]:[]),
  ...(allows(actor,'inventory.receive')?[{name:'Stock In',url:'/stock-in'}]:[]),
  ...(allows(actor,'sales.read')?[{name:'Sales',url:'/sales'}]:[]),
  ...(['quotations','orders','deliveries','invoices'] as const).flatMap((k,i)=>allows(actor,`${k}.read`)?[{name:['Quotations','Sales Orders','Delivery Receipts','Sales Invoices'][i],url:['/quotations','/orders','/delivery-receipts','/sales-invoices'][i]}]:[]),
  ...(allows(actor,'deliveries.create')&&allows(actor,'commercial.prices')?[{name:'DR Entry',url:'/delivery-receipts/new'}]:[]),
  ...(allows(actor,'invoices.create')&&allows(actor,'commercial.prices')?[{name:'SI Entry',url:'/sales-invoices/new'}]:[]),
  ...(allows(actor,'vat.reference')?[{name:'VAT Reference',url:'/vat-reference'}]:[]),
  ...(allows(actor,'ar.read')?[{name:'Accounts Receivable',url:'/accounts-receivable'}]:[]),
  ...(allows(actor,'collections.read')?[{name:'Collections',url:'/collections'}]:[]),
  ...(allows(actor,'collections.checks')?[{name:'Checks',url:'/checks'}]:[]),
  ...(allows(actor,'returns.read')?[{name:'Returns',url:'/returns'}]:[]),
  ...(allows(actor,'customers.read')?[{name:'Customers',url:'/masters/customers'}]:[]),
  ...(allows(actor,'suppliers.read')?[{name:'Suppliers',url:'/masters/suppliers'}]:[]),
  ...(actor.roles.includes('PRESIDENT_ADMIN')?[{name:'Administration',url:'/administration'}]:[]),
 ];
}
