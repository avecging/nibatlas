import {sealArtworkRoute} from '@/src/server/media/seal-artwork-route';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return sealArtworkRoute(request,(await params).id,true);}
