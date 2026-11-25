-- 별빛보드 카드 첨부에 영상 추가
--
-- 형식: MP4(video/mp4) · WebM(video/webm) · MOV(video/quicktime). 한도 50MB(52428800바이트).
-- 이미지 10MB · PDF 20MB · 링크 규칙은 그대로다. 앱(lib/starboard/upload.ts checkFile)이 같은 값으로 먼저 거르고,
-- 라우트가 Storage에 실제로 저장된 크기·형식으로 한 번 더 확인한 뒤 행을 만든다.
--
-- Storage 버킷 starboard-files는 20261125_starboard.sql 주석대로 수동으로 만든 것이다.
-- 영상이 올라가려면 버킷의 크기 한도와 허용 형식도 함께 넓혀야 해서 여기서 같이 고친다.

alter table public.sb_attachments drop constraint if exists sb_attachments_type_check;
alter table public.sb_attachments
  add constraint sb_attachments_type_check check (type in ('image', 'pdf', 'video', 'link'));

alter table public.sb_attachments drop constraint if exists sb_attachments_check1;
alter table public.sb_attachments
  add constraint sb_attachments_check1 check (
    (type = 'image' and storage_path is not null and size between 1 and 10485760)
    or (type = 'pdf' and storage_path is not null and size between 1 and 20971520)
    or (type = 'video' and storage_path is not null and size between 1 and 52428800)
    or (type = 'link' and url ~* '^https?://' and char_length(url) <= 2048)
  );

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime']
where id = 'starboard-files';

-- RLS — 새 테이블이 없다. sb_attachments는 20261125_starboard.sql에서 RLS enable + 정책 없음(deny-all)이고,
-- 제약만 바뀌므로 정책 변화는 없다. 첨부는 서명 URL로만 올리고 읽는다(라우트가 카드 쓰기 권한 확인).
--
--   테이블          | SELECT   | INSERT   | UPDATE   | DELETE
--   sb_attachments  | deny-all | deny-all | deny-all | deny-all
alter table public.sb_attachments enable row level security;
