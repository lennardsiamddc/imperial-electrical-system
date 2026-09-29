import Decimal from 'decimal.js';
export const Money=Decimal.clone({precision:60,rounding:Decimal.ROUND_HALF_UP});
export const taxTreatments=['VATable','Zero-Rated','VAT-Exempt'] as const;
export const entryModes=['VAT Inclusive','VAT Exclusive'] as const;
export type TaxTreatment=typeof taxTreatments[number];
export type EntryMode=typeof entryModes[number];
export type TaxConfig={standard_rate:string;version:number;effective_at:string|Date};
const amountPattern=/^\d{1,30}(\.\d{1,12})?$/;
export function vatBreakdown(amount:string,mode:EntryMode,treatment:TaxTreatment,configuredRate:string,places:2|6=2){
 if(!amountPattern.test(amount)||!entryModes.includes(mode)||!taxTreatments.includes(treatment)||!/^\d(\.\d{1,6})?$/.test(configuredRate)||new Money(configuredRate).gt(1))throw new Error('Invalid VAT calculation input.');
 const entered=new Money(amount).toDecimalPlaces(places),rate=new Money(treatment==='VATable'?configuredRate:'0');
 const net=mode==='VAT Inclusive'?entered.div(rate.plus(1)).toDecimalPlaces(places):entered;
 const vat=mode==='VAT Inclusive'?entered.minus(net):net.mul(rate).toDecimalPlaces(places);
 const gross=net.plus(vat);
 return {entered:entered.toFixed(places),net:net.toFixed(places),vat:vat.toFixed(places),gross:gross.toFixed(places),rate:rate.toFixed(6),configured_rate:new Money(configuredRate).toFixed(6),treatment,mode};
}
export function taxSnapshot(amount:string,mode:EntryMode,treatment:TaxTreatment,config:TaxConfig,recoverable=false,quantity='1',places:2|6=2){
 if(!/^\d{1,24}(\.\d{1,6})?$/.test(quantity)||new Money(quantity).lte(0))throw new Error('Invalid tax quantity.');
 const unit=vatBreakdown(amount,mode,treatment,config.standard_rate,places);
 const line=vatBreakdown(new Money(amount).mul(quantity).toFixed(),mode,treatment,config.standard_rate,2);
 return {...unit,recoverable,recoverable_vat:recoverable?unit.vat:new Money(0).toFixed(places),economic_cost:recoverable?unit.net:unit.gross,
 line:{...line,recoverable_vat:recoverable?line.vat:'0.00',economic_cost:recoverable?line.net:line.gross},
 quantity,rounding:'HALF_UP_LINE_2_UNIT_'+places,configuration_version:config.version,configuration_effective_at:new Date(config.effective_at).toISOString()};
}
export type VatSnapshot=ReturnType<typeof taxSnapshot>;
export function percentText(rate:string){return new Money(rate).mul(100).toFixed(4).replace(/(\.\d{2})0+$/,'$1').replace(/(\.\d{3})0$/,'$1');}
// Sales snapshots never contain acquisition-cost or input-VAT fields.
export function sellingSnapshot(amount:string,mode:EntryMode,treatment:TaxTreatment,config:TaxConfig){
 const snapshot=taxSnapshot(amount,mode,treatment,config);
 const {recoverable,recoverable_vat,economic_cost,line,...sales}=snapshot;
 const {recoverable_vat:lineRecovery,economic_cost:lineCost,...salesLine}=line;
 void recoverable;void recoverable_vat;void economic_cost;void lineRecovery;void lineCost;
 return {...sales,line:salesLine};
}
