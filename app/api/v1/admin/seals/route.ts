import {sealRoute} from '@/src/server/stamps/seal-route';
export const GET=(request:Request)=>sealRoute(request,true);
export const POST=GET;
