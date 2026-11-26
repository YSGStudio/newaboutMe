\set ON_ERROR_STOP 1
insert into teacher_profiles (id, name) values ('00000000-0000-0000-0000-00000000000a','김선생');
insert into classes (id, teacher_id) values ('00000000-0000-0000-0000-0000000000ca','00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-0000000000cc','00000000-0000-0000-0000-00000000000a');
insert into students (id, class_id, name, student_number) select ('00000000-0000-0000-0001-'||lpad(i::text,12,'0'))::uuid, case when i<=5 then '00000000-0000-0000-0000-0000000000ca'::uuid else '00000000-0000-0000-0000-0000000000cc'::uuid end, '학생'||i, i from generate_series(1,10) i;
create or replace function pg_temp.fill(cls uuid) returns void language plpgsql as $$
declare pj uuid; b uuid; col uuid; s record; cr uuid; card uuid;
begin
  insert into sb_projects (class_id, teacher_id, title) values (cls, '00000000-0000-0000-0000-00000000000a', 'p') returning id into pj;
  insert into sb_boards (project_id, title) values (pj, '공용') returning id into b;
  insert into sb_columns (board_id, name) values (b, '공지') returning id into col;
  insert into sb_criteria (teacher_id, name, levels) values ('00000000-0000-0000-0000-00000000000a', '기준', '[{"name":"a","score":1},{"name":"b","score":2}]') returning id into cr;
  insert into sb_board_criteria values (b, cr, 1);
  perform sb_create_personal_boards(b, null, '00000000-0000-0000-0000-00000000000a');
  for s in select id from students where class_id = cls loop
    insert into sb_columns (board_id, name, member_student_id) values (b, '멤버'||s.id, s.id);
    insert into sb_cards (board_id, column_id, author_student_id, title) values (b, col, s.id, 't') returning id into card;
    insert into sb_attachments (card_id, type, url, created_by_student_id) values (card, 'link', 'https://ex.com', s.id);
    insert into sb_activities (board_id, card_id, actor_student_id, action) values (b, card, s.id, 'create');
    insert into sb_board_permissions values (b, s.id, 'edit');
    insert into sb_evaluations (board_id, student_id, levels) values (b, s.id, jsonb_build_object(cr::text, 1));
  end loop;
  insert into sb_cards (board_id, column_id, author_teacher_id, title) values (b, col, '00000000-0000-0000-0000-00000000000a', '교사');
  insert into sb_activities (board_id, card_id, actor_teacher_id, action) values (b, gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'create');
  perform sb_save_peer_review(b, s1.id, s2.id, jsonb_build_object(cr::text, 2))
    from (select id from students where class_id = cls order by student_number limit 1) s1,
         (select id from students where class_id = cls order by student_number offset 1 limit 1) s2;
end $$;
select pg_temp.fill('00000000-0000-0000-0000-0000000000ca');
select pg_temp.fill('00000000-0000-0000-0000-0000000000cc');
-- 학생 한 명 삭제(멤버 섹션 set null, 활동 set null, 동료평가 cascade)
delete from students where id = '00000000-0000-0000-0001-000000000001';
select 'after student delete', (select count(*) from sb_peer_reviews), (select count(*) from sb_columns where name like '멤버%' and member_student_id is null);
-- 학급 삭제
delete from classes where id = '00000000-0000-0000-0000-0000000000ca';
select 'after class delete', (select count(*) from sb_projects), (select count(*) from sb_boards);
-- 교사 삭제(회원 탈퇴): 남은 학급·기준·평가 모두
delete from teacher_profiles where id = '00000000-0000-0000-0000-00000000000a';
select 'after teacher delete', (select count(*) from sb_projects) + (select count(*) from sb_boards) + (select count(*) from sb_cards) + (select count(*) from sb_criteria) + (select count(*) from sb_evaluations) + (select count(*) from sb_activities) + (select count(*) from sb_peer_reviews) + (select count(*) from sb_attachments) as remaining;
