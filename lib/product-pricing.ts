import {z} from 'zod';
import {Money} from './vat';
import {normalizeDiscount,discountRules} from './quotation-calculations';
const amount=z.string().regex(/^\d{1,16}(\.\d{1,30})?$/);
export const pricingRuleSchema=z.object({meter_per_roll:amount.optional(),selling_basis:z.enum(['Base','Legacy net']).optional(),base:amount,supplier:z.string().max(150),retail:z.string().max(150),contractor:z.string().max(150),net_override:amount.nullable(),retail_override:amount.nullable(),contractor_override:amount.nullable()}).strict();
export const pricingRulesSchema=z.partialRecord(z.enum(['PCS','ROLL','BOX','METER']),pricingRuleSchema);
export type PricingRule=z.infer<typeof pricingRuleSchema>;
export function adjusted(amount:string,expression:string){return discountRules(normalizeDiscount(expression),2).reduce((value,r)=>value.mul(new Money(1).minus(new Money(r.percent).div(100))),new Money(amount)).toFixed();}
export function productPricing(rule:PricingRule){const calculatedNet=adjusted(rule.base,rule.supplier),net=rule.net_override??calculatedNet,sellingBase=rule.selling_basis==='Base'?rule.base:net,calculatedRetail=adjusted(sellingBase,rule.retail),calculatedContractor=adjusted(sellingBase,rule.contractor);return {net,retail:rule.retail_override??calculatedRetail,contractor:rule.contractor_override??calculatedContractor,calculatedNet,calculatedRetail,calculatedContractor};}
