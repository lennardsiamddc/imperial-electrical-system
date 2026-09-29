import {randomBytes,scrypt as scryptCb,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCb);
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64) as Buffer;return `${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password:string,hash:string){const [salt,key]=hash.split(':');if(!salt||!key)return false;const actual=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(key,'hex');return expected.length===actual.length&&timingSafeEqual(actual,expected);}
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
