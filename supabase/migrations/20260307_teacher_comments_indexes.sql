create index if not exists idx_teacher_comments_feed_created
  on teacher_comments (feed_id, created_at desc);

create index if not exists idx_teacher_comments_teacher_created
  on teacher_comments (teacher_id, created_at desc);
