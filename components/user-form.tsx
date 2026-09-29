'use client';
import {useActionState,useState} from 'react';
import Link from 'next/link';
import {saveAccount} from '@/app/actions';
import {roles,roleLabels,permissionKeys,permissionLabels,allows,type Role,type Overrides} from '@/lib/permissions';
import {Notice} from './ui';
export default function UserForm({user}:{user?:Record<string,unknown>}){
 const [state,action,pending]=useActionState(saveAccount.bind(null,user?String(user.id):undefined,user?Number(user.version):undefined),{error:''});
 const [selectedRoles,setRoles]=useState<Role[]>((user?.roles as Role[])||[]);
 const [overrides,setOverrides]=useState<Overrides>((user?.permission_overrides as Overrides)||{});
 const owner=selectedRoles.includes('PRESIDENT_ADMIN');
 const preview={id:'preview',name:'',email:'',roles:selectedRoles,permission_overrides:overrides};
 return <form className="panel" action={action}>
 <h2>{user?'Edit employee access':'Create employee'}</h2>
 {state.error&&<Notice kind="error">{state.error}</Notice>}
 <div className="form-grid">
 <label>Name<input name="name" required maxLength={200} defaultValue={String(user?.name||'')}/></label>
 <label>Individual email<input name="email" type="email" autoComplete="off" required defaultValue={String(user?.email||'')}/></label>
 <label className="wide">{user?'New password (leave blank to keep current)':'Initial password (12+ characters)'}<input name="password" type="password" autoComplete="new-password" required={!user} minLength={12} maxLength={200}/></label>
 <fieldset className="wide"><legend>Departments / roles</legend><p className="muted">Multiple employees may share a role. Select more than one when responsibilities overlap.</p><div className="role-options">{roles.map(role=><label className="check" key={role}><input type="checkbox" name="roles" value={role} checked={selectedRoles.includes(role)} onChange={e=>setRoles(e.target.checked?[...selectedRoles,role]:selectedRoles.filter(r=>r!==role))}/>{roleLabels[role]}</label>)}</div></fieldset>
 <label className="check"><input type="checkbox" name="active" defaultChecked={user?Boolean(user.active):true}/>Account enabled</label>
 </div>
 <section className="permission-section" aria-label="Individual permissions"><h3>Individual permissions</h3><p className="muted">Use role defaults, allow extra access, or deny a permission for this employee. Denying a directory also blocks its edits and sensitive fields. Sensitive-field access permits editing only when directory editing is also allowed.</p>
 {owner&&<Notice>Owner/Admin always has full access, including user management and audit history. Overrides are retained but do not limit an Owner/Admin.</Notice>}
 <div className="table-wrap"><table className="permission-table"><thead><tr><th>Permission</th><th>Setting</th><th>Effective access</th></tr></thead><tbody>{permissionKeys.map(key=><tr key={key}><td>{permissionLabels[key]}</td><td><select aria-label={permissionLabels[key]} name={'permission:'+key} value={overrides[key]||'inherit'} onChange={e=>setOverrides(previous=>{const next={...previous};if(e.target.value==='inherit')delete next[key];else next[key]=e.target.value as 'allow'|'deny';return next;})}><option value="inherit">Use role default</option><option value="allow">Allow</option><option value="deny">Deny</option></select></td><td><span className={'badge '+(allows(preview,key)?'':'off')}>{allows(preview,key)?'Allowed':'Blocked'}</span></td></tr>)}</tbody></table></div>
 </section>
 <p className="muted">Only Owner/Admin can manage access. Saving an existing employee ends all their active sessions. Disabled employees and their historical records remain in the system.</p>
 <div className="actions"><button disabled={pending||!selectedRoles.length}>{pending?'Saving…':'Save employee'}</button><Link className="button secondary" href="/administration">Cancel</Link></div>
 </form>;
}
