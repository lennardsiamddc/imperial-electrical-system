// Keep decimal strings exact; formatting never changes stored arithmetic.
export function quantityText(value:unknown){return String(value??'0').replace(/(\.\d*?[1-9])0+$|\.0+$/,'$1');}
export function moneyText(value:unknown){const [whole,fraction='']=quantityText(value).split('.');return `${whole}.${fraction.padEnd(2,'0')}`;}
