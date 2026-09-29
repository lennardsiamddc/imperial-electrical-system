import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {authenticate,resolveSession} from './sessions';
export async function currentUser(){const token=(await cookies()).get('imperial_session')?.value;return token?resolveSession(token):null;}
export async function requireUser(){const actor=await currentUser();if(!actor)redirect('/login');return actor;}
export async function login(email:string,password:string){
 const token=await authenticate(email,password);if(!token)return false;
 (await cookies()).set('imperial_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:28800});return true;
}
