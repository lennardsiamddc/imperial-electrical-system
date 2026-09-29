import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateSaleLine,saleTotals} from '../lib/sales-calculations';
import {allocateReturn,restockAllocation,returnConditions} from '../lib/return-calculations';
import {Money} from '../lib/vat';
const config={standard_rate:'0.12',version:2,effective_at:'2026-01-01T00:00:00Z'};
test('Stage 3 entered EX/INC prices and discount-first entered amounts ignore VAT tags',()=>{
 for(const [price,mode] of [['700','VAT Exclusive'],['784','VAT Inclusive']] as const){
  for(const discount of ['0','10']){
   const line=calculateSaleLine(price,'1',discount,mode,'VATable',config);
   assert.equal(line.entered_price,new Money(price).toFixed(6));
   assert.equal(line.net_amount,new Money(price).mul(discount==='0'?1:0.9).toFixed(2));
   assert.equal(line.vat_amount,'0.00');
   assert.equal(line.gross_amount,line.net_amount);
   assert.equal(line.vat_snapshot.mode,mode);
  }
 }
});
test('Stage 3 mixed lines sum stored rounded amounts',()=>{
 const lines=[calculateSaleLine('700','2','10','VAT Exclusive','VATable',config),calculateSaleLine('784','1','10','VAT Inclusive','VATable',config),calculateSaleLine('0.05','1','10','VAT Exclusive','VATable',config)];
 assert.equal(saleTotals(lines).gross_total,'1965.65');
 assert.equal(saleTotals(lines).net_total,'1965.65');
});
const original={quantity:'10',stock_quantity:'10',net_amount:'7000.00',vat_amount:'840.00',entered_amount:'7000.00',discount_amount:'0',cogs:'5000.000000'};
test('Returns allocate original historical cost and VAT for full/partial/multiple returns',()=>{
 const first=allocateReturn(original,'0','4'),last=allocateReturn(original,'4','6');
 assert.equal(first.historical_cogs,'2000.000000');assert.equal(first.net_amount,'2800.00');assert.equal(first.vat_amount,'336.00');
 assert.equal(last.historical_cogs,'3000.000000');assert.equal(last.gross_amount,'4704.00');
 assert.deepEqual(allocateReturn(original,'0','10'),{quantity:'10.000000',stock_quantity:'10.000000',entered_amount:'7000.00',discount_amount:'0.00',net_amount:'7000.00',vat_amount:'840.00',gross_amount:'7840.00',historical_cogs:'5000.000000'});
 assert.throws(()=>allocateReturn(original,'4','7'),/remaining/);assert.throws(()=>allocateReturn(original,'10','1'),/remaining/);
 for(const invalid of ['0','-1','NaN','Infinity'])assert.throws(()=>allocateReturn(original,'0',invalid));
});
test('Return rounding conserves every original centavo and cost fraction',()=>{
 const small={quantity:'3',stock_quantity:'450',net_amount:'0.10',vat_amount:'0.01',entered_amount:'0.11',discount_amount:'0.02',cogs:'1.000001'};
 const parts=['0','1','2'].map(prior=>allocateReturn(small,prior,'1'));
 for(const key of ['net_amount','vat_amount','entered_amount','discount_amount'] as const)assert.equal(parts.reduce((s,p)=>s.plus(p[key]),new Money(0)).toFixed(2),small[key]);
 assert.equal(parts.reduce((s,p)=>s.plus(p.historical_cogs),new Money(0)).toFixed(6),small.cogs);
 assert.equal(parts.reduce((s,p)=>s.plus(p.stock_quantity),new Money(0)).toFixed(6),'450.000000');
 assert.equal(parts.reduce((s,p)=>s.plus(p.gross_amount),new Money(0)).toFixed(2),'0.11');
});
test('Only Sellable returns restore available inventory value and quantity',()=>{
 const allocation=allocateReturn(original,'0','2');
 for(const condition of returnConditions){
  const stock=restockAllocation(allocation,condition);
  assert.deepEqual(stock,condition==='Sellable'?{stock_quantity:'2.000000',inventory_value:'1000.000000'}:{stock_quantity:'0.000000',inventory_value:'0.000000'});
 }
 assert.equal(allocation.historical_cogs,'1000.000000');
});
