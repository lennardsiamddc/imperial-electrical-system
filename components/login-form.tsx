'use client';
import {useActionState} from 'react';
import {signIn} from '@/app/actions';
export default function LoginForm(){const [state,action,pending]=useActionState(signIn,{error:''});return <form action={action}>{state.error&&<div role="alert" className="error">{state.error}</div>}<label>Email address<input autoComplete="username" name="email" type="email" required maxLength={254}/></label><label>Password<input autoComplete="current-password" name="password" type="password" required maxLength={200}/></label><button disabled={pending}>{pending?'Signing in…':'Sign in'}</button><p className="muted">Use your individual Imperial account. Contact your administrator for access.</p></form>;}
