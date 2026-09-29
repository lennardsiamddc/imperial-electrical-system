import {randomUUID} from 'node:crypto';
import {transaction,closeDB} from '../lib/db';
import {hashPassword} from '../lib/password';
async function main(){const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(),password=process.env.ADMIN_PASSWORD;
 if(!email||!email.includes('@')||!password||password.length<12)throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters).');
 const hash=await hashPassword(password);await transaction(async db=>{
 await db.query('LOCK TABLE users IN EXCLUSIVE MODE');
 if((await db.query('SELECT id FROM users LIMIT 1')).rows.length)throw new Error('Bootstrap only works on an empty user table. Use Administration.');
 const id=randomUUID();await db.query("SELECT set_config('imperial.actor_id',$1,true)",[id]);
 await db.query('INSERT INTO users(id,email,name,password_hash,roles) VALUES ($1,$2,$3,$4,$5)',[id,email,process.env.ADMIN_NAME||'President',hash,['PRESIDENT_ADMIN']]);
 });console.log('President account created. No business records imported.');}
main().finally(closeDB);
