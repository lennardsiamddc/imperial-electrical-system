import Link from 'next/link';
import {requireUser} from '@/lib/auth';
import {has,roles,roleLabels,type Role} from '@/lib/permissions';
import {listUsers,getUser} from '@/lib/users';
import UserForm from '@/components/user-form';
import {PageHeader,StatusBadge,Notice} from '@/components/ui';
import {z} from 'zod';
export default async function Administration({searchParams}:{searchParams:Promise<{user?:string;saved?:string;q?:string;status?:string;role?:string}>}){
 const actor=await requireUser();
 if(!has(actor))return <div className="panel"><h1>Access restricted</h1><p>User management is available only to Owner/Admin accounts.</p></div>;
 const s=await searchParams,users=await listUsers(actor,s.q,s.status,s.role);
 const user=s.user&&z.uuid().safeParse(s.user).success?await getUser(actor,s.user):undefined;
 return <>
 <PageHeader eyebrow="Administration" title="Employees & access" description="Individual logins. Shared departments. Access controlled by the Owner." actions={<Link className="button secondary" href="/administration/audit">View audit history →</Link>}/>
 <p><Link className="button secondary" href="/administration/tax">Tax Settings →</Link> <Link className="button secondary" href="/administration/sales">Sales & Returns Settings →</Link></p>
 {s.saved&&<Notice kind="success">Employee saved and audited. Existing sessions for an edited account have ended.</Notice>}
 <form className="panel toolbar"><label>Search employees<input name="q" defaultValue={s.q} placeholder="Name or email"/></label><label>Account status<select name="status" defaultValue={s.status||''}><option value="">All accounts</option><option value="true">Active</option><option value="false">Disabled</option></select></label><label>Role<select name="role" defaultValue={s.role||''}><option value="">All roles</option>{roles.map(r=><option value={r} key={r}>{roleLabels[r]}</option>)}</select></label><button>Filter</button><Link className="button secondary" href="/administration">Reset</Link></form>
 <p className="muted">{users.length} matching employees · No fixed employee limit</p>
 <div className="table-wrap" style={{marginBottom:24}}><table><thead><tr><th>Employee</th><th>Roles</th><th>Individual rules</th><th>Status</th><th></th></tr></thead><tbody>{users.map(u=><tr key={String(u.id)}><td><strong>{String(u.name)}</strong><br/><small>{String(u.email)}</small></td><td><div className="role-badges">{(u.roles as Role[]).map(r=><span className="badge role" key={r}>{roleLabels[r]}</span>)}</div></td><td>{Object.keys(u.permission_overrides as object).length||'Role defaults'}</td><td><StatusBadge active={Boolean(u.active)}/></td><td><Link href={'?user='+u.id+'#employee-form'}>Manage access</Link></td></tr>)}</tbody></table>{!users.length&&<div className="empty">No employees match these filters.</div>}</div>
 {s.user&&!user&&<Notice kind="error">Employee not found. Select an existing employee or create a new one.</Notice>}
 {user&&<p><Link href="/administration#employee-form">+ Create another employee</Link></p>}
 <div id="employee-form"><UserForm key={String(user?.id||'new')} user={user}/></div>
 </>;
}
