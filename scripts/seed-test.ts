import {randomBytes,randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {transaction,closeDB} from '../lib/db';
import {hashPassword} from '../lib/password';
async function main(){if(process.env.DATABASE_URL||process.env.NODE_ENV==='production')throw new Error('TEST seed is restricted to local development.');
 const password=randomBytes(18).toString('base64url'),hash=await hashPassword(password);
 await transaction(async db=>{await db.query('LOCK TABLE users IN EXCLUSIVE MODE');if((await db.query('SELECT id FROM users LIMIT 1')).rows.length)throw new Error('TEST seed requires an empty users table.');const id=randomUUID();await db.query("SELECT set_config('imperial.actor_id',$1,true)",[id]);await db.query('INSERT INTO users(id,email,name,password_hash,roles) VALUES ($1,$2,$3,$4,$5)',[id,'president@example.test','TEST President',hash,['PRESIDENT_ADMIN']]);});
 await writeFile('.local-test-login',`LOCAL DEVELOPMENT ONLY\nEmail: president@example.test\nPassword: ${password}\n`,{mode:0o600});console.log('Created TEST President. Local credentials are in .local-test-login. No business records seeded.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(closeDB);
