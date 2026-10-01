import {notFound} from 'next/navigation';
import {SealEditor} from '@/src/features/admin/SealEditor';
import {isShopId} from '@/src/api/v1/saved-shops';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!isShopId(id))notFound();return <SealEditor id={id}/>;}
