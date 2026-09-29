import {requireUser} from '@/lib/auth';
import CollectionList from '@/components/collection-list';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string>>}){return <CollectionList actor={await requireUser()} filter={await searchParams}/>;}
