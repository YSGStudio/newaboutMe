import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Params = { params: { reportId: string } };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireTeacher();
  if ('error' in auth) return auth.error;

  // 내 보고서인지 확인
  const { data: report } = await supabaseAdmin
    .from('eval_reports')
    .select('id')
    .eq('id', params.reportId)
    .eq('teacher_id', auth.teacher.id)
    .maybeSingle();

  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });

  // 이미지 개수 확인
  const { count } = await supabaseAdmin
    .from('eval_report_images')
    .select('id', { count: 'exact', head: true })
    .eq('report_id', params.reportId);

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: '이미지는 최대 5장까지 업로드할 수 있습니다.' }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'JPG, PNG, WEBP 파일만 업로드 가능합니다.' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: '파일 크기는 10MB를 초과할 수 없습니다.' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const storagePath = `${auth.teacher.id}/${params.reportId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('eval-images')
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: imageRow, error: dbError } = await supabaseAdmin
    .from('eval_report_images')
    .insert({ report_id: params.reportId, storage_path: storagePath, sort_order: count ?? 0 })
    .select('id,storage_path,sort_order')
    .single();

  if (dbError) {
    await supabaseAdmin.storage.from('eval-images').remove([storagePath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ image: imageRow }, { status: 201 });
}
