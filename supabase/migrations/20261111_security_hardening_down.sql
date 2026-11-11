-- 20261111_security_hardening.sql 롤백.
-- 주의: 정책을 되살리면 교사가 anon 키로 자기 teacher_profiles.role을 바꿀 수 있는 경로가 다시 열린다.
-- 학생 로그인 라우트가 student_login_attempt를 부르므로, 함수를 지우기 전에 라우트를 먼저 되돌린다.
drop function if exists public.student_login_attempt(uuid, int, int);

alter function public.voyage_add_fuel(uuid, integer, integer, date, boolean) reset search_path;

create policy "teacher profile self" on public.teacher_profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "teacher class access" on public.classes for all
  using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);
create policy "teacher student access" on public.students for all
  using (exists (select 1 from public.classes c where c.id = students.class_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from public.classes c where c.id = students.class_id and c.teacher_id = auth.uid()));
create policy "teacher feed access" on public.emotion_feeds for select
  using (exists (select 1 from public.students s join public.classes c on c.id = s.class_id
                 where s.id = emotion_feeds.student_id and c.teacher_id = auth.uid()));
create policy "teacher reaction read" on public.feed_reactions for select
  using (exists (select 1 from public.emotion_feeds f join public.students s on s.id = f.student_id
                 join public.classes c on c.id = s.class_id
                 where f.id = feed_reactions.feed_id and c.teacher_id = auth.uid()));
create policy "teacher comment access" on public.teacher_comments for all
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
