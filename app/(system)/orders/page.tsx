import CommercialList from '@/components/commercial-list';
export default function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){return <CommercialList kind="SO" searchParams={searchParams}/>;}
