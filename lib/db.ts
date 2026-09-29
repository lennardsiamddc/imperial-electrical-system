import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
export interface DB { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>; exec(sql:string):Promise<unknown> }
const globalDb = globalThis as unknown as { imperialPool?: Pool; imperialLocal?: PGlite };
function local() {
 if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_LOCAL_DB) throw new Error('DATABASE_URL is required in production');
 return globalDb.imperialLocal ??= new PGlite(process.env.LOCAL_DB_PATH || '.local-db');
}
function pool() { return globalDb.imperialPool ??= new Pool({connectionString:process.env.DATABASE_URL, max:10}); }
export async function transaction<T>(fn: (db: DB)=>Promise<T>):Promise<T> {
 if (!process.env.DATABASE_URL) return local().transaction(async tx=>{await tx.exec('SET LOCAL search_path TO imperial, public'); return fn(tx as DB);});
 const client=await pool().connect();
 try {await client.query('BEGIN'); await client.query('SET LOCAL search_path TO imperial, public'); const db:DB={query:async<T>(sql:string,params?:unknown[])=>({rows:(await client.query(sql,params)).rows as T[]}),exec:sql=>client.query(sql)};const result=await fn(db); await client.query('COMMIT'); return result;} catch(e){await client.query('ROLLBACK');throw e;} finally {client.release();}
}
export async function query<T = Record<string, unknown>>(sql:string,params:unknown[]=[]){return transaction(db=>db.query<T>(sql,params));}
export async function closeDB(){await globalDb.imperialLocal?.close();await globalDb.imperialPool?.end();delete globalDb.imperialLocal;delete globalDb.imperialPool;}
