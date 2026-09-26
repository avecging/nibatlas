import { SavedPublicPreview } from '@/src/features/admin/SavedPublicPreview';

export default async function PreviewPage({params, searchParams}: {
  params: Promise<{id:string}>;
  searchParams: Promise<{revision?:string;mode?:string}>;
}) {
  const [{id},{revision,mode}] = await Promise.all([params,searchParams]);
  return <SavedPublicPreview id={id} revision={revision ?? ''} selected={mode === 'selection'}/>;
}
