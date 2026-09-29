import {Money} from './vat';

export const returnConditions=['Sellable','Damaged','Defective','For Inspection','Other'] as const;
export type ReturnCondition=typeof returnConditions[number];
export const returnStatuses=['Return Requested','Approved','In Transit','Received','Inspected','Restocked','Rejected','Completed','Cancelled'] as const;

/** Allocate historical totals, never current prices or current VAT configuration.
 * Cumulative rounding assigns residual centavos exactly once across partial returns.
 * Values are operational allocations, not tax documents or evidence of a refund.
 */
export function allocateReturn(original:{quantity:string;stock_quantity:string;net_amount:string;vat_amount:string;entered_amount:string;discount_amount:string;cogs:string},alreadyAccepted:string,quantity:string){
 const sold=new Money(original.quantity),prior=new Money(alreadyAccepted),qty=new Money(quantity),next=prior.plus(qty);
 if(!sold.isFinite()||!prior.isFinite()||!qty.isFinite()||sold.lte(0)||prior.lt(0)||qty.lte(0)||next.gt(sold))throw new Error('Return quantity exceeds the remaining quantity sold.');
 const portion=(value:string,places:number)=>{
  const amount=new Money(value);
  if(!amount.isFinite()||amount.lt(0))throw new Error('Invalid historical Sale amount.');
  return amount.mul(next).div(sold).toDecimalPlaces(places).minus(amount.mul(prior).div(sold).toDecimalPlaces(places)).toFixed(places);
 };
 const net=portion(original.net_amount,2),vat=portion(original.vat_amount,2),cogs=portion(original.cogs,6);
 return {quantity:qty.toFixed(6),stock_quantity:portion(original.stock_quantity,6),entered_amount:portion(original.entered_amount,2),discount_amount:portion(original.discount_amount,2),net_amount:net,vat_amount:vat,gross_amount:new Money(net).plus(vat).toFixed(2),historical_cogs:cogs};
}

export function restockAllocation(allocation:ReturnType<typeof allocateReturn>,condition:ReturnCondition){
 if(!returnConditions.includes(condition))throw new Error('Choose a valid Return condition.');
 return condition==='Sellable'?{stock_quantity:allocation.stock_quantity,inventory_value:allocation.historical_cogs}:{stock_quantity:'0.000000',inventory_value:'0.000000'};
}
