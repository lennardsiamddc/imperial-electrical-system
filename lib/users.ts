import {z} from 'zod';
import {transaction} from './db';
import {freshActor} from './masters';
import {assertAllowed,has,roles,permissionKeys,type Actor} from './permissions';
import {hashPassword} from './password';
const schema=z.object({name:z.string().trim().min(1).max(200),email:z.string().trim().pipe(z.email()).transform(v=>v.toLowerCase()),roles:z.array(z.enum(roles)).min(1).transform(v=>[...new Set(v)]),active:z.boolean(),password:z.string().max(200),permission_overrides:z.partialRecord(z.enum(permissionKeys),z.enum(['allow','deny'])).default({})}).strict();
export async function saveUser(actor:Actor,input:unknown,id?:string,version?:number){const data=schema.parse(input);if(id)z.uuid().parse(id);if((!id||data.password)&&data.password.length<12)throw new Error('Use a password of at least 12 characters.');const hash=data.password?await hashPassword(data.password):null;
 return transaction(async db=>{
 // Recheck Owner privileges after taking the account-management lock.
 await db.query('LOCK TABLE users IN EXCLUSIVE MODE');const current=await freshActor(db,actor.id);assertAllowed(has(current));await db.query("SELECT set_config('imperial.actor_id',$1,true)",[current.id]);
 if(id){const old=(await db.query<{roles:string[]}>('SELECT roles FROM users WHERE id=$1',[id])).rows[0];if(!old)throw new Error('User not found.');
 if(old.roles.includes('PRESIDENT_ADMIN')&&(!data.active||!data.roles.includes('PRESIDENT_ADMIN'))){const remaining=await db.query("SELECT id FROM users WHERE active AND 'PRESIDENT_ADMIN'=ANY(roles) AND id<>$1",[id]);if(!remaining.rows.length)throw new Error('Keep at least one active President/Admin.');}
 const r=await db.query('UPDATE users SET name=$1,email=$2,roles=$3,active=$4,password_hash=COALESCE($5,password_hash),permission_overrides=$8,version=version+1 WHERE id=$6 AND version=$7 RETURNING id',[data.name,data.email,data.roles,data.active,hash,id,version,JSON.stringify(data.permission_overrides)]);if(!r.rows.length)throw new Error('User changed. Reload before saving.');await db.query('DELETE FROM sessions WHERE user_id=$1',[id]);
 if(hash)await db.query("INSERT INTO audit_log(actor_id,entity,record_id,action) VALUES ($1,'users',$2,'PASSWORD_RESET')",[current.id,id]);return id;
 }else return String((await db.query('INSERT INTO users(name,email,roles,active,password_hash,permission_overrides) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',[data.name,data.email,data.roles,data.active,hash,JSON.stringify(data.permission_overrides)])).rows[0].id);
 });
}
export async function listUsers(actor:Actor,search='',status='',role=''){
 return transaction(async db=>{const current=await freshActor(db,actor.id);assertAllowed(has(current));
 return (await db.query(`SELECT id,name,email,roles,active,version,permission_overrides,created_at FROM users
 WHERE (name ILIKE $1 OR email ILIKE $1) AND ($2='' OR active::text=$2) AND ($3='' OR $3=ANY(roles)) ORDER BY name,id`,
 [`%${search.slice(0,100)}%`,['true','false'].includes(status)?status:'',roles.includes(role as typeof roles[number])?role:''])).rows;});
}
export async function getUser(actor:Actor,id:string){z.uuid().parse(id);return transaction(async db=>{const current=await freshActor(db,actor.id);assertAllowed(has(current));return (await db.query('SELECT id,name,email,roles,active,version,permission_overrides FROM users WHERE id=$1',[id])).rows[0];});}
