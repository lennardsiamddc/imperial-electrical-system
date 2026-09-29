import {productPricing} from './product-pricing';
import {Money,type VatSnapshot} from './vat';
export function pricingIndicators(row:Record<string,unknown>):Record<string,unknown>{
 if(row.standard_cost===undefined||row.retail_price===undefined)return {};
 const rule=(row.pricing_rules as Record<string,any>|undefined)?.[String(row.primary_uom)];const cost=new Money(rule?productPricing(rule).net:String(row.standard_cost)),price=new Money(rule?productPricing(rule).retail:String((row.selling_prices as Record<string,Record<string,string>>|undefined)?.[String(row.primary_uom)]?.Retail??row.retail_price)),profit=price.minus(cost);
 return {estimated_profit:profit.toFixed(2),markup_percent:cost.isZero()?null:profit.div(cost).mul(100).toFixed(2),profit_margin_percent:price.isZero()?null:profit.div(price).mul(100).toFixed(2),profit_basis:'Entered selling price less entered acquisition cost. VAT tags do not change amounts.'};
}
