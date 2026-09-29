import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {formatPesos} from '../lib/currency-display';
import CurrencyInput from '../components/currency-input';
import {quotationLine} from '../lib/quotation-calculations';
test('All quotation currency display uses pesos, grouping and exactly two decimal places without changing source precision',()=>{for(const [raw,expected] of [['350','₱350.00'],['1200','₱1,200.00'],['15.5','₱15.50'],['1234.5678','₱1,234.57'],['0','₱0.00'],['1500.50','₱1,500.50']]){assert.equal(formatPesos(raw),expected);const html=renderToStaticMarkup(React.createElement(CurrencyInput,{value:raw,onValueChange:()=>{throw new Error('Display must never write back');}}));assert(html.includes('value="'+expected+'"'));}const raw='1234.5678';const before=quotationLine(raw,'12.5','-25-5-3','VAT Exclusive','VATable',{standard_rate:'0.12',version:1,effective_at:'2026-01-01T00:00:00Z'},2);formatPesos(raw);assert.equal(raw,'1234.5678');assert.deepEqual(quotationLine(raw,'12.5','-25-5-3','VAT Exclusive','VATable',{standard_rate:'0.12',version:1,effective_at:'2026-01-01T00:00:00Z'},2),before);});
