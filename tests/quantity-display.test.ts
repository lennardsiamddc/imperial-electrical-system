import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {formatQuantity} from '../lib/quantity-display';
import QuantityInput from '../components/quantity-input';
test('Quantity presentation drops only trailing zeroes and retains all fractional digits',()=>{for(const [raw,expected] of [['1.000000','1'],['10.0000','10'],['100.000000','100'],['1.500000','1.5'],['12.500000','12.5'],['1.250000','1.25'],['0.000001','0.000001'],['123456789012345678.123456','123456789012345678.123456'],['0.000000','0'],['','']]){assert.equal(formatQuantity(raw),expected);const html=renderToStaticMarkup(React.createElement(QuantityInput,{type:'number',value:raw}));assert(html.includes('value="'+expected+'"'));}const stored={quantity:'12.500000'};formatQuantity(stored.quantity);assert.equal(stored.quantity,'12.500000');});
