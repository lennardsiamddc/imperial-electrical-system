import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
async function main(){
const token=await readFile('/private/tmp/imperial-q55-review-token','utf8');const headers={cookie:'imperial_session='+token};const id='133c941c-434e-4157-9263-589f2f623faf';const d=(await (await fetch('http://127.0.0.1:3002/api/commercial?id='+id,{headers})).json()).data;assert.equal(d.lines[0].quantity,'1.250000');assert.equal(d.lines[0].entered_price,'1234.567800');console.log({version:d.version,quantity:d.lines[0].quantity,price:d.lines[0].entered_price,contact:d.customer_snapshot.quotation_contact});
const pdf=await fetch('http://127.0.0.1:3002/quotation-document/'+id+'?download=1',{headers});if(pdf.status!==200)throw new Error('PDF status '+pdf.status);await writeFile('output/pdf/Imperial_Quotation_long_descriptions.pdf',new Uint8Array(await pdf.arrayBuffer()));await writeFile('test-results/stage55/format-http.json',JSON.stringify({version:d.version,quantity:d.lines[0].quantity,price:d.lines[0].entered_price,contact:d.customer_snapshot.quotation_contact,pdfStatus:pdf.status},null,2));

}
main().catch(e=>{console.error(e);process.exitCode=1});
