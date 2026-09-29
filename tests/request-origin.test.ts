import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasValidRequestOrigin} from '../lib/request-origin';
const request=(origin:string|null,host='127.0.0.1:3000',url='http://localhost:3000/api/sales',extra:Record<string,string>={},method='POST')=>new Request(url,{method,headers:{host,...(origin===null?{}:{origin}),...extra}});
test('CSRF regression: public 127.0.0.1 Host is used instead of Next internal localhost URL',()=>{
 for(const method of ['POST','PUT','PATCH','DELETE']){
  assert.equal(hasValidRequestOrigin(request('http://127.0.0.1:3000',undefined,undefined,{},method)),true);
  assert.equal(hasValidRequestOrigin(request('http://localhost:3000','localhost:3000',undefined,{},method)),true);
 }
});
test('CSRF rejects cross-origin, host aliases, wrong ports/schemes and malformed/missing origins',()=>{
 for(const origin of [null,'null','http://evil.test','http://localhost:3000','http://127.0.0.1:3001','https://127.0.0.1:3000','http://127.0.0.1:3000.evil.test','http://127.0.0.1:3000/path','http://127.0.0.1:3000/','http://user@127.0.0.1:3000','http://127.0.0.1:3000,http://evil.test'])assert.equal(hasValidRequestOrigin(request(origin)),false,String(origin));
 for(const host of ['', 'evil.test','127.0.0.1:3000,evil.test','127.0.0.1:3000/path','user@127.0.0.1:3000','127.0.0.1:3000?x','127.0.0.1:3000\\evil'])assert.equal(hasValidRequestOrigin(request('http://127.0.0.1:3000',host)),false,host);
});
test('Forwarded host/protocol cannot grant a cross-origin exception',()=>{
 assert.equal(hasValidRequestOrigin(request('http://evil.test',undefined,undefined,{'x-forwarded-host':'evil.test','x-forwarded-proto':'http','forwarded':'host=evil.test;proto=http'})),false);
 assert.equal(hasValidRequestOrigin(request('https://127.0.0.1:3000',undefined,undefined,{'x-forwarded-proto':'https'})),false);
 assert.equal(hasValidRequestOrigin(request('http://127.0.0.1:3000',undefined,undefined,{'x-forwarded-host':'evil.test'})),true);
 assert.equal(hasValidRequestOrigin(request('https://erp.example.test','erp.example.test','https://internal:3000/api/sales')),true);
 assert.equal(hasValidRequestOrigin(request('https://erp.example.test','internal:3000','http://internal:3000/api/sales',{'x-forwarded-host':'erp.example.test','x-forwarded-proto':'https'})),false);
});
test('Synthetic Request fallback retains strict URL-origin checking',()=>{
 assert.equal(hasValidRequestOrigin(new Request('http://localhost/api/returns',{method:'POST',headers:{origin:'http://localhost'}})),true);
 assert.equal(hasValidRequestOrigin(new Request('http://localhost/api/returns',{method:'POST',headers:{origin:'http://evil.test'}})),false);
});
