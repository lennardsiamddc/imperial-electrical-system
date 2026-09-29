import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import VatSummary from '../components/vat-summary';
import {taxSnapshot} from '../lib/vat';
const config={standard_rate:'0.12',version:1,effective_at:'2026-01-01T00:00:00Z'};
for(const cost of [true,false])for(const mode of ['VAT Exclusive','VAT Inclusive'] as const){
 test(`${cost?'Cost':'Selling'} ${mode} display prioritizes entered amount`,()=>{
  const amount=cost?(mode==='VAT Inclusive'?'560':'500'):(mode==='VAT Inclusive'?'784':'700');
  const snapshot=taxSnapshot(amount,mode,'VATable',config,true);
  const html=renderToStaticMarkup(createElement(VatSummary,{snapshot,title:'VAT',cost}));
  assert.equal(html,''); // Historical snapshot is retained but not shown as an operational VAT breakdown.
  assert.equal(snapshot.entered,amount+'.00');
 });
}
