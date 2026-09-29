import {randomBytes} from 'node:crypto';
import {query,transaction} from './db';
import {tokenHash,verifyPassword} from './password';
import type {Actor} from './permissions';

// Framework-independent authentication service; no third-party runtime service is involved.
export async function resolveSession(token:string){
 if(!/^[a-f0-9]{64}$/.test(token))return null;
 return (await query<Actor>(`SELECT u.id,u.name,u.email,u.roles,u.permission_overrides
 FROM sessions s JOIN users u ON u.id=s.user_id
 WHERE token_hash=$1 AND expires_at>now() AND u.active`,[tokenHash(token)])).rows[0]||null;
}
export async function authenticate(email:string,password:string):Promise<string|null>{
 email=email.trim().toLowerCase();
 if(!email||email.length>254||password.length>200)return null;
 const permitted=await transaction(async db=>{
  const result=await db.query<{attempts:number}>(`INSERT INTO login_attempts(key) VALUES ($1)
   ON CONFLICT(key) DO UPDATE SET
   attempts=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE login_attempts.attempts+1 END,
   window_start=CASE WHEN login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE login_attempts.window_start END
   RETURNING attempts`,[tokenHash(email)]);
  return result.rows[0].attempts<=10;
 });
 if(!permitted)return null;
 const row=(await query<{id:string;password_hash:string;version:number}>('SELECT id,password_hash,version FROM users WHERE lower(email)=$1 AND active',[email])).rows[0];
 const dummy='00000000000000000000000000000000:'+ '0'.repeat(128);
 if(!await verifyPassword(password,row?.password_hash||dummy)||!row)return null;
 return transaction(async db=>{
  // Serialize with account changes. Credentials checked before a disable/reset may not create a new session.
  const current=(await db.query('SELECT id FROM users WHERE id=$1 AND active AND version=$2 FOR SHARE',[row.id,row.version])).rows[0];
  if(!current)return null;
  const token=randomBytes(32).toString('hex');
  await db.query('DELETE FROM login_attempts WHERE key=$1',[tokenHash(email)]);
  await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '8 hours')",[tokenHash(token),row.id]);
  await db.query("INSERT INTO audit_log(actor_id,entity,record_id,action) VALUES ($1,'sessions',$1,'LOGIN')",[row.id]);
  await db.query('DELETE FROM sessions WHERE expires_at<now()');
  return token;
 });
}
export async function revokeSession(token:string){
 await transaction(async db=>{
  const row=(await db.query<{user_id:string}>('DELETE FROM sessions WHERE token_hash=$1 RETURNING user_id',[tokenHash(token)])).rows[0];
  if(row)await db.query("INSERT INTO audit_log(actor_id,entity,record_id,action) VALUES ($1,'sessions',$1,'LOGOUT')",[row.user_id]);
 });
}
