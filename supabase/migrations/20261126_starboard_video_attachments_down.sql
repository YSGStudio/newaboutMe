-- 20261126_starboard_video_attachments.sql 롤백
-- 영상 첨부 행이 있으면 제약을 다시 걸 수 없다. 먼저 영상 첨부와 Storage 파일을 지운 뒤 실행한다.

alter table public.sb_attachments drop constraint if exists sb_attachments_check1;
alter table public.sb_attachments
  add constraint sb_attachments_check1 check (
    (type = 'image' and storage_path is not null and size between 1 and 10485760)
    or (type = 'pdf' and storage_path is not null and size between 1 and 20971520)
    or (type = 'link' and url ~* '^https?://' and char_length(url) <= 2048)
  );
alter table public.sb_attachments drop constraint if exists sb_attachments_type_check;
alter table public.sb_attachments
  add constraint sb_attachments_type_check check (type in ('image', 'pdf', 'link'));

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
where id = 'starboard-files';
