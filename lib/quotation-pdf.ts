import {PDFDocument,rgb,pushGraphicsState,popGraphicsState,rectangle,clip,endPath,type PDFFont,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {currency,unitCurrency,type QuotationDocument} from './quotation-document';
const red=rgb(.65,0,0),gray=rgb(.91,.93,.94),black=rgb(0,0,0),white=rgb(1,1,1);
export async function quotationRender(q:QuotationDocument){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);pdf.setTitle('Imperial Quotation '+q.number);pdf.setAuthor(q.company);pdf.setCreationDate(new Date('2026-01-01T00:00:00Z'));pdf.setModificationDate(new Date('2026-01-01T00:00:00Z'));
 const font=await pdf.embedFont(await readFile(join(process.cwd(),'public/quotation/fonts/regular.ttf')),{subset:true});
 const bold=await pdf.embedFont(await readFile(join(process.cwd(),'public/quotation/fonts/bold.ttf')),{subset:true});
 const italic=await pdf.embedFont(await readFile(join(process.cwd(),'public/quotation/fonts/bold-italic.ttf')),{subset:true});
 const logo=await pdf.embedPng(await readFile(join(process.cwd(),'public/quotation/reference.png')));
 const svgPages:string[][]=[];let svg:string[]=[];const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const fontData=await Promise.all(['regular','bold','bold-italic'].map(async n=>(await readFile(join(process.cwd(),'public/quotation/fonts/'+n+'.ttf'))).toString('base64')));
 const imageData=(await readFile(join(process.cwd(),'public/quotation/reference.png'))).toString('base64');
 const colorText=(c:ReturnType<typeof rgb>)=>`rgb(${c.red*255},${c.green*255},${c.blue*255})`;
 let page:PDFPage,y=0;const left=34,right=561,width=527,columns=[200,53,40,77,71,86];
 const clean=(s:string)=>s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
 function wrap(s:string,w:number,size=8,f:PDFFont=font){const output:string[]=[];for(const paragraph of clean(s).split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const candidate=line?line+' '+word:word;if(f.widthOfTextAtSize(candidate,size)<=w){line=candidate;continue;}if(line)output.push(line);line='';for(const char of word){if(f.widthOfTextAtSize(line+char,size)>w){output.push(line);line='';}line+=char;}}output.push(line);}return output;}
 function text(s:string,x:number,top:number,size=8,f:PDFFont=font,color=black){svg.push(`<text x="${x}" y="${top+size}" font-family="${f===bold?'QBold':f===italic?'QItalic':'QRegular'}" font-size="${size}" fill="${colorText(color)}">${escape(clean(s))}</text>`);page.drawText(clean(s),{x,y:842-top-size,size,font:f,color});}
 function box(x:number,top:number,w:number,h:number,fill=white){svg.push(`<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${colorText(fill)}" stroke="black" stroke-width="0.5"/>`);page.drawRectangle({x,y:842-top-h,width:w,height:h,color:fill,borderColor:black,borderWidth:.5});}
 function block(s:string,x:number,top:number,w:number,size=8,f:PDFFont=font,color=black){const list=wrap(s,w,size,f);list.forEach((v,i)=>text(v,x,top+i*(size+3),size,f,color));return list.length*(size+3);}
 function newPage(first=false){page=pdf.addPage([595,842]);svg=[];svgPages.push(svg);
  if(first){
   // Viewport over the supplied logo; original image bytes are preserved, no AI redraw.
   const scale=.62,lx=34,ly=26,lw=118*scale,lh=57*scale;svg.push(`<svg x="${lx}" y="${ly}" width="${lw}" height="${lh}" viewBox="52 9 118 57" overflow="hidden"><image width="${logo.width}" height="${logo.height}" href="data:image/png;base64,${imageData}"/></svg>`);
   page.pushOperators(pushGraphicsState(),rectangle(lx,842-ly-lh,lw,lh),clip(),endPath());
   page.drawImage(logo,{x:lx-52*scale,y:842-ly-(logo.height-9)*scale,width:logo.width*scale,height:logo.height*scale});page.pushOperators(popGraphicsState());
   const companyHeight=block(q.company.toUpperCase(),117,30,444,11,bold,red);
   const titleTop=Math.max(74,45+companyHeight);text('QUOTATION FORM',151,titleTop,23,bold);text('Quotation No.: '+q.number,left,titleTop+37,9,bold);
   text(q.status==='Draft'?'DRAFT':q.status==='Cancelled'?'CANCELLED':'',left,titleTop+52,9,bold,red);
   let meta=titleTop+36;for(const [label,value] of [['Agent',q.agent],['Date',q.date],['Terms',q.terms]]){const h=Math.max(17,wrap(value,116).length*11+6);text(label+':',369,meta+3);box(430,meta,131,h,gray);block(value,435,meta+3,121);meta+=h;}
   y=Math.max(177,meta+14);for(const [label,value] of [['Client',q.customer],['Address',q.address],['Contact',q.contact]]){const h=Math.max(19,wrap(value,width-72).length*11+6);box(left,y,61,h,red);text(label+':',left+4,y+4,8,bold,white);box(left+61,y,width-61,h,gray);block(value,left+66,y+4,width-72);y+=h;}y+=18;
  }else{ const h=block(q.company.toUpperCase(),left,26,width,9,bold,red);const h2=block('QUOTATION '+q.number+' · '+q.customer,left,32+h,width,9,bold);y=44+h+h2;}
 }
 function tableHead(){let x=left;['ITEM DESCRIPTION','QUANTITY','UOM','UNIT PRICE','DISCOUNT','AMOUNT'].forEach((label,i)=>{box(x,y,columns[i],21,red);text(label,x+4,y+6,7,bold,white);x+=columns[i];});y+=21;}
 function ensure(h:number,table=false){if(y+h>786){newPage();if(table)tableHead();}}
 newPage(true);tableHead();
 for(const l of q.lines){const cells=[l.description,l.quantity,l.uom,unitCurrency(l.price),['0','0%'].includes(l.discount)?'':l.discount,currency(l.amount)];const wraps=cells.map((s,i)=>wrap(s,columns[i]-8,8));const h=Math.max(16,...wraps.map(a=>a.length*10+6));ensure(h,true);let x=left;wraps.forEach((a,i)=>{box(x,y,columns[i],h,gray);a.forEach((v,j)=>text(v,x+4,y+3+j*10));x+=columns[i];});y+=h;}
 y+=12;
 for(const f of q.fees){const detail=f.description+' — '+currency(f.amount);const h=wrap(detail,width-10).length*11+10;ensure(h);box(left,y,width,h,gray);block(detail,left+5,y+4,width-10);y+=h;}
 ensure(100);y+=8;
 for(const [label,value] of [['Total Sales',q.salesTotal],['Other Fees',q.feeTotal],['TOTAL AMOUNT DUE',q.total]]){const strong=label==='TOTAL AMOUNT DUE';box(333,y,228,21,strong?red:gray);text(label,338,y+6,8,bold,strong?white:black);const amount=currency(value);text(amount,right-5-bold.widthOfTextAtSize(amount,8),y+6,8,bold,strong?white:black);y+=21;}
 y+=12;
 if(q.notes){const h=wrap('Notes: '+q.notes,width-12).length*11+14;ensure(h);box(left,y,width,h,rgb(1,.97,.91));block('Notes: '+q.notes,left+6,y+6,width-12);y+=h+16;}
 if(q.disclaimer){const h=wrap(q.disclaimer,width-8,10,italic).length*13;ensure(h);block(q.disclaimer,left+4,y,width-8,10,italic);}
 const count=pdf.getPageCount();for(const [i,p] of pdf.getPages().entries()){page=p;svg=svgPages[i];text(q.number,left,811,8);if(count>1)text(`Page ${i+1} of ${count}`,485,811,8);}
 return {bytes:await pdf.save(),pages:svgPages.map(items=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595 842" role="img" aria-label="Quotation page"><style>${['QRegular','QBold','QItalic'].map((n,i)=>`@font-face{font-family:${n};src:url(data:font/ttf;base64,${fontData[i]})}`).join('')}</style><rect width="595" height="842" fill="white"/>${items.join('')}</svg>`)};
}

export async function quotationPDF(q:QuotationDocument){return (await quotationRender(q)).bytes;}
