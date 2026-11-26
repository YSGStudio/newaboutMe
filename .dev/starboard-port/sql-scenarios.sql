\set ON_ERROR_STOP 1
create or replace function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FAIL: %', msg; end if; raise notice 'ok: %', msg; end $$;
create or replace function pg_temp.fails(q text, pat text, msg text) returns void language plpgsql as $$
begin begin execute q; exception when others then
  if sqlerrm like '%'||pat||'%' then raise notice 'ok: % (%)', msg, sqlerrm; return; end if;
  raise exception 'FAIL: % wrong error %', msg, sqlerrm; end;
  raise exception 'FAIL: % did not fail', msg; end $$;

-- 시드: 교사 A(학급 A, 학생 30), 교사 B(학급 B, 학생 1)
insert into teacher_profiles (id, name) values ('00000000-0000-0000-0000-00000000000a','김선생'), ('00000000-0000-0000-0000-00000000000b','박선생');
insert into classes (id, teacher_id) values ('00000000-0000-0000-0000-0000000000ca','00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-0000000000cb','00000000-0000-0000-0000-00000000000b');
insert into students (id, class_id, name, student_number)
select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid, '00000000-0000-0000-0000-0000000000ca', '학생' || lpad(i::text,2,'0'), i from generate_series(1,30) i;
insert into students (id, class_id, name, student_number) values ('00000000-0000-0000-0002-000000000001','00000000-0000-0000-0000-0000000000cb','다른반',1);
\set TA '\'00000000-0000-0000-0000-00000000000a\''
\set TB '\'00000000-0000-0000-0000-00000000000b\''
\set SA '\'00000000-0000-0000-0001-000000000001\''
\set SB '\'00000000-0000-0000-0001-000000000002\''
\set SC '\'00000000-0000-0000-0001-000000000003\''
\set SX '\'00000000-0000-0000-0002-000000000001\''

-- AC2 프로젝트
select pg_temp.fails($$insert into sb_projects (class_id, teacher_id, title) values ('00000000-0000-0000-0000-0000000000ca','00000000-0000-0000-0000-00000000000b','x')$$, 'class teacher', '다른 교사는 남의 학급에 프로젝트를 못 만든다');
insert into sb_projects (id, class_id, teacher_id, title) values ('00000000-0000-0000-0003-000000000001','00000000-0000-0000-0000-0000000000ca',:TA,'국어');
\set PJ '\'00000000-0000-0000-0003-000000000001\''

-- AC3/AC4 트리: 10단계, 순환 거부
do $$ declare prev uuid := null; cur uuid; first uuid; i int; begin
  for i in 1..10 loop
    insert into sb_boards (project_id, parent_id, title, position) values ('00000000-0000-0000-0003-000000000001', prev, 'L'||i, 1) returning id into cur;
    if i = 1 then first := cur; end if; prev := cur;
  end loop;
  perform pg_temp.ok((select count(*) from sb_boards) = 10, '10단계 하위 작업장');
  begin update sb_boards set parent_id = prev where id = first; raise exception 'FAIL: cycle allowed';
  exception when others then perform pg_temp.ok(sqlerrm like 'BOARD_CYCLE%', '순환 이동 거부'); end;
  delete from sb_boards where id = first;
  perform pg_temp.ok((select count(*) from sb_boards) = 0, '삭제 시 하위까지 cascade');
end $$;

insert into sb_boards (id, project_id, title, position) values ('00000000-0000-0000-0004-000000000001', :PJ, '공용', 1);
\set B1 '\'00000000-0000-0000-0004-000000000001\''
select pg_temp.ok((select default_access from sb_boards where id = :B1) = 'edit', '새 최상위 작업장 기본 권한 edit');
select pg_temp.ok((select count(*) from sb_columns where board_id = :B1) = 0, '공용 작업장은 섹션 0개로 시작');

-- AC6 섹션 60개
insert into sb_columns (board_id, name, position) select :B1, 'c'||i, i from generate_series(1,60) i;
select pg_temp.fails($$insert into sb_columns (board_id, name) values ('00000000-0000-0000-0004-000000000001','61')$$, 'COLUMN_LIMIT', '61번째 섹션 거부');
delete from sb_columns where board_id = :B1;
select pg_temp.ok(true, '마지막 섹션까지 지울 수 있다');
insert into sb_columns (id, board_id, name, position) values ('00000000-0000-0000-0005-000000000001', :B1, '발산', 1), ('00000000-0000-0000-0005-000000000002', :B1, '수렴', 2);
\set C1 '\'00000000-0000-0000-0005-000000000001\''
\set C2 '\'00000000-0000-0000-0005-000000000002\''

-- AC9 권한
update sb_boards set default_access = 'none' where id = :B1;
insert into sb_board_permissions values (:B1, :SA, 'read'), (:B1, :SB, 'edit');
select pg_temp.ok(sb_student_access(:B1, :SA) = 'read' and sb_student_access(:B1, :SB) = 'edit' and sb_student_access(:B1, :SC) = 'none', '학생별 없음/읽기/수정');
select pg_temp.ok((select count(*) from sb_get_board_tree(:PJ, null, :SC)) = 0 and sb_get_board_view(:B1, null, :SC) is null, '권한 없는 학생은 트리·뷰 0건');
select pg_temp.ok((sb_get_board_view(:B1, null, :SA)->'board'->>'can_write')::boolean = false and (sb_get_board_view(:B1, null, :SB)->'board'->>'can_write')::boolean, '읽기는 쓰기 불가, 수정은 가능');
update sb_boards set default_access = 'read' where id = :B1;
select pg_temp.ok(sb_student_access(:B1, :SC) = 'read', '기본 권한 읽기로 바꾸면 C도 본다');
delete from sb_board_permissions where board_id = :B1 and student_id = :SA;
select pg_temp.ok(sb_student_access(:B1, :SA) = 'read', '기본값 따르기로 돌아간다');
select pg_temp.fails($$insert into sb_board_permissions values ('00000000-0000-0000-0004-000000000001','00000000-0000-0000-0002-000000000001','edit')$$, 'project class', '다른 학급 학생에게 권한 부여 거부');
select pg_temp.ok(sb_student_access(:B1, :SX) = 'none' and sb_get_board_view(:B1, :TB, null) is null, '다른 학급 학생·다른 교사는 none');
update sb_boards set default_access = 'edit' where id = :B1;
delete from sb_board_permissions where board_id = :B1;

-- 하위 작업장: 부모 권한 복사
insert into sb_board_permissions values (:B1, :SC, 'none');
insert into sb_boards (id, project_id, parent_id, title) values ('00000000-0000-0000-0004-000000000002', :PJ, :B1, '하위');
select pg_temp.ok((select default_access from sb_boards where id = '00000000-0000-0000-0004-000000000002') = 'edit' and (select access from sb_board_permissions where board_id = '00000000-0000-0000-0004-000000000002' and student_id = :SC) = 'none', '하위 작업장은 부모 기본·학생별 권한 복사');
delete from sb_board_permissions where board_id = :B1;

-- AC8 카드 쓰기 판정
insert into sb_cards (id, board_id, column_id, author_student_id, title, position) values ('00000000-0000-0000-0006-000000000001', :B1, :C1, :SA, 'A카드', 1);
insert into sb_cards (id, board_id, column_id, author_student_id, title, position) values ('00000000-0000-0000-0006-000000000002', :B1, :C1, :SB, 'B카드', 2);
insert into sb_cards (id, board_id, column_id, author_teacher_id, title, position) values ('00000000-0000-0000-0006-000000000003', :B1, :C1, :TA, '선생님카드', 3);
select pg_temp.ok(sb_can_write_card('00000000-0000-0000-0006-000000000001', null, :SA) and not sb_can_write_card('00000000-0000-0000-0006-000000000001', null, :SB) and sb_can_write_card('00000000-0000-0000-0006-000000000001', :TA, null) and not sb_can_write_card('00000000-0000-0000-0006-000000000001', :TB, null), '자기 카드만 수정, 교사는 모두, 다른 교사는 불가');
select pg_temp.fails($$update sb_cards set author_student_id = '00000000-0000-0000-0001-000000000002' where id = '00000000-0000-0000-0006-000000000001'$$, 'immutable', '작성자 바꾸기 거부');
select pg_temp.fails($$insert into sb_cards (board_id, column_id, title) values ('00000000-0000-0000-0004-000000000001','00000000-0000-0000-0005-000000000001','작성자없음')$$, 'check', '작성자 없는 카드 거부');

-- AC10 가리기
\set V 'sb_get_board_view(\'00000000-0000-0000-0004-000000000001\', null, \'00000000-0000-0000-0001-000000000003\')'
select pg_temp.ok(jsonb_array_length(:V->'cards') = 3 and (select bool_and(c->>'author_name' is not null) from jsonb_array_elements(:V->'cards') c), 'off: 모두 작성자와 함께');
update sb_boards set hide_mode = 'hidden' where id = :B1;
select pg_temp.ok(jsonb_array_length(:V->'cards') = 1 and :V->'cards'->0->>'title' = '선생님카드', 'hidden: 남의 학생 카드 없음, 교사 카드는 보임');
select pg_temp.ok(jsonb_array_length(sb_get_board_view(:B1, null, :SA)->'cards') = 2, 'hidden: 내 카드는 보임');
update sb_boards set hide_mode = 'count' where id = :B1;
select pg_temp.ok(jsonb_array_length(:V->'cards') = 1 and (:V->'columns'->0->>'hidden_count')::int = 2, 'count: 개수만(교사 카드 제외)');
update sb_boards set hide_mode = 'anonymous' where id = :B1;
select pg_temp.ok(jsonb_array_length(:V->'cards') = 3 and (select count(*) from jsonb_array_elements(:V->'cards') c where c->>'author_id' is null and c->>'author_name' is null and c->>'author_number' is null and c->>'author_role' is null) = 2, 'anonymous: 학생 카드 2장 작성자 비움');
select pg_temp.ok((select c->>'author_role' from jsonb_array_elements(:V->'cards') c where c->>'title' = '선생님카드') = 'teacher', 'anonymous: 교사 카드는 작성자 보임');
update sb_columns set hide_applies = false where id = :C1;
select pg_temp.ok((select bool_and(c->>'author_name' is not null) from jsonb_array_elements(:V->'cards') c), '섹션 단위로 가리기 끄기');
update sb_columns set hide_applies = true where id = :C1;
update sb_boards set hide_mode = 'hidden', revealed = true where id = :B1;
select pg_temp.ok(jsonb_array_length(:V->'cards') = 3, '모두 공개');
update sb_boards set revealed = false where id = :B1;
select pg_temp.ok(jsonb_array_length(:V->'cards') = 1, '다시 가리기');
select pg_temp.ok(jsonb_array_length(sb_get_board_view(:B1, :TA, null)->'cards') = 3 and (select bool_and(c->>'author_name' is not null) from jsonb_array_elements(sb_get_board_view(:B1, :TA, null)->'cards') c), '교사는 항상 모두');
select pg_temp.ok(not sb_can_read_card('00000000-0000-0000-0006-000000000001', null, :SC) and sb_can_read_card('00000000-0000-0000-0006-000000000003', null, :SC), 'hidden: 남의 카드 읽기 불가, 교사 카드 가능');
select pg_temp.ok(coalesce((select sum(count) from sb_visible_card_counts(:PJ, null, :SC)),0) = 1 and (select sum(count) from sb_visible_card_counts(:PJ, :TA, null)) = 3, '사이드바 카드 수도 가리기 반영');
update sb_boards set hide_mode = 'anonymous' where id = :B1;
select pg_temp.ok((select sum(count) from sb_visible_card_counts(:PJ, null, :SC)) = 1 and (select count(*) from sb_recent_cards(:PJ, null, :SC)) = 1, '익명 섹션 남의 카드는 목록 수·최신 카드에서 빠진다(원본 cards_select)');
update sb_boards set hide_mode = 'off' where id = :B1;

-- AC14 활동(라우트가 넣는다) + 익명 이름 비움
insert into sb_activities (board_id, card_id, card_title, actor_student_id, action, to_column) values (:B1, '00000000-0000-0000-0006-000000000001', 'A카드', :SA, 'create', :C1);
insert into sb_activities (board_id, card_id, card_title, actor_student_id, action, from_column, to_column) values (:B1, '00000000-0000-0000-0006-000000000001', 'A카드', :SA, 'move', :C1, :C2);
select pg_temp.ok(jsonb_array_length(sb_get_card_activities('00000000-0000-0000-0006-000000000001', null, :SC)) = 2 and sb_get_card_activities('00000000-0000-0000-0006-000000000001', null, :SC)->1->>'to_column' = '수렴', '활동 시간순, 섹션 이름');
update sb_boards set hide_mode = 'anonymous' where id = :B1;
select pg_temp.ok(sb_get_card_activities('00000000-0000-0000-0006-000000000001', null, :SC)->0->>'actor_name' is null and sb_get_card_activities('00000000-0000-0000-0006-000000000001', null, :SA)->0->>'actor_name' = '학생01', '익명: 남에게는 행위자 비움, 본인에게는 보임');
update sb_boards set hide_mode = 'hidden' where id = :B1;
select pg_temp.ok(sb_get_card_activities('00000000-0000-0000-0006-000000000001', null, :SC) is null, 'hidden: 활동 기록도 못 읽음');
update sb_boards set hide_mode = 'off' where id = :B1;

-- AC12 개인 보드 30명
select pg_temp.fails($$select sb_create_personal_boards('00000000-0000-0000-0004-000000000001', null, '00000000-0000-0000-0000-00000000000b')$$, 'only the project teacher', '다른 교사는 개인 보드 생성 불가');
do $$ declare t0 timestamptz := clock_timestamp(); n int; begin
  n := sb_create_personal_boards('00000000-0000-0000-0004-000000000001', null, '00000000-0000-0000-0000-00000000000a');
  perform pg_temp.ok(n = 30 and (select count(*) from sb_boards where kind='personal') = 30, '30명 개인 보드');
  raise notice 'personal boards ms=%', extract(milliseconds from clock_timestamp() - t0);
end $$;
select sb_create_personal_boards(:B1, null, :TA);
select pg_temp.ok((select count(*) from sb_boards where kind='personal') = 30, '다시 눌러도 중복 없음');
\set PB '(select id from sb_boards where owner_student_id = \'00000000-0000-0000-0001-000000000001\')'
select pg_temp.ok(sb_student_access(:PB, :SA) = 'edit' and sb_student_access(:PB, :SB) = 'none', '본인 것만 접근');
select pg_temp.ok((select count(*) from sb_columns where board_id = :PB and member_student_id = :SA and name = '학생01') = 1, '개인 보드는 학생 이름 섹션 1개(주인 연결)');
select pg_temp.ok((select auto_personal from sb_boards where id = :B1), '전체 배당 표시');
insert into students (id, class_id, name, student_number) values ('00000000-0000-0000-0001-000000000031','00000000-0000-0000-0000-0000000000ca','학생31',31);
select pg_temp.ok(sb_auto_personal_for_student('00000000-0000-0000-0001-000000000031') = 1, '31번째 학생 자동 생성 호출');
select pg_temp.ok((select count(*) from sb_boards where kind='personal') = 31, '31번째 학생 자동 생성');
select pg_temp.fails($$update sb_boards set parent_id = null where kind = 'personal' and owner_student_id = '00000000-0000-0000-0001-000000000001'$$, 'cannot be moved', '개인 보드는 다른 부모로 못 옮김');
select pg_temp.ok(jsonb_array_length(sb_get_board_view(:B1, null, :SC)->'cards') = 3, '부모 보드는 계속 칸반');
-- 개인 보드 아래 하위: 주인 수정 보장
insert into sb_boards (id, project_id, parent_id, title) values ('00000000-0000-0000-0004-000000000003', :PJ, (select id from sb_boards where owner_student_id = :SA), '내 하위');
select pg_temp.ok(sb_student_access('00000000-0000-0000-0004-000000000003', :SA) = 'edit', '개인 보드 아래 하위 작업장도 주인 수정');
-- 트리: 접근 가능한 것 + 조상 흐리게
update sb_boards set default_access = 'none' where id = :B1;
select pg_temp.ok((select count(*) from sb_get_board_tree(:PJ, null, :SA) where accessible) >= 2 and (select accessible from sb_get_board_tree(:PJ, null, :SA) where id = :B1) = false, '상위는 이름만(accessible=false)');
update sb_boards set default_access = 'edit' where id = :B1;

-- AC13 학생별 보기
select pg_temp.ok(jsonb_array_length(sb_get_board_student_summary(:B1, :TA)->'students') = 31 and ((sb_get_board_student_summary(:B1, :TA)->'students'->0->'counts'->>'00000000-0000-0000-0005-000000000001')::int) = 1, '학생별 보기 숫자');
select pg_temp.fails($$select sb_get_board_student_summary('00000000-0000-0000-0004-000000000001','00000000-0000-0000-0000-00000000000b')$$, 'only the project teacher', '다른 교사는 학생별 보기 불가');

-- AC18 기준·평가
select pg_temp.fails($$insert into sb_criteria (teacher_id, name, levels) values ('00000000-0000-0000-0000-00000000000a','x','[{"name":"a","score":1}]')$$, 'levels_check', '단계 1개 거부');
select pg_temp.fails($$insert into sb_criteria (teacher_id, name, levels) values ('00000000-0000-0000-0000-00000000000a','x',(select jsonb_agg(jsonb_build_object('name','l'||i,'score',i)) from generate_series(1,6) i))$$, 'levels_check', '단계 6개 거부');
insert into sb_criteria (id, teacher_id, name, levels) values ('00000000-0000-0000-0007-000000000001', :TA, '협력', '[{"name":"노력","score":1},{"name":"보통","score":2},{"name":"잘함","score":3}]');
select pg_temp.fails($$insert into sb_board_criteria values ((select id from sb_boards where owner_student_id='00000000-0000-0000-0001-000000000001'),'00000000-0000-0000-0007-000000000001',1)$$, 'must be shared', '개인 보드에는 기준을 못 붙임');
insert into sb_board_criteria values (:B1, '00000000-0000-0000-0007-000000000001', 1);
update sb_boards set peer_review = false, show_criteria = false where id = :B1;
select pg_temp.ok(jsonb_array_length(sb_get_board_view(:B1, null, :SA)->'criteria') = 0, '미리 보여주기·동료평가 끄면 학생은 기준 없음');
update sb_boards set show_criteria = true where id = :B1;
select pg_temp.ok(jsonb_array_length(sb_get_board_view(:PB, null, :SA)->'criteria') = 1, '켜면 개인 보드에서도 부모 기준 보임');
update sb_boards set show_criteria = false, peer_review = true where id = :B1;
select pg_temp.ok(jsonb_array_length(sb_get_board_view(:B1, null, :SA)->'criteria') = 1, '동료평가가 켜져 있으면 학생도 기준을 본다');
insert into sb_evaluations (board_id, student_id, levels, feedback) values (:B1, :SA, '{"00000000-0000-0000-0007-000000000001": 2}', '잘했어요');
select pg_temp.ok(sb_get_board_view(:PB, null, :SA)->'my_evaluation' = 'null'::jsonb, '공개 전 0건');
update sb_evaluations set published = true where student_id = :SA;
select pg_temp.ok(sb_get_board_view(:PB, null, :SA)->'my_evaluation'->>'feedback' = '잘했어요' and sb_get_board_view(:B1, null, :SB)->'my_evaluation' = 'null'::jsonb, '공개 후 본인 것만');
select pg_temp.fails($$update sb_criteria set levels = '[{"name":"a","score":1},{"name":"b","score":2}]' where id = '00000000-0000-0000-0007-000000000001'$$, 'CRITERION_LOCKED', '잠긴 기준 단계 수정 거부');
select pg_temp.fails($$delete from sb_criteria where id = '00000000-0000-0000-0007-000000000001'$$, 'CRITERION_LOCKED', '잠긴 기준 삭제 거부');
update sb_criteria set name = '협력하기' where id = '00000000-0000-0000-0007-000000000001';
select pg_temp.ok(true, '잠긴 기준도 이름은 바꿀 수 있다');
select pg_temp.fails($$insert into sb_evaluations (board_id, student_id) values ('00000000-0000-0000-0004-000000000001','00000000-0000-0000-0002-000000000001')$$, 'student of its class', '다른 학급 학생 평가 거부');

-- AC20 동료평가
select pg_temp.fails($$select sb_save_peer_review('00000000-0000-0000-0004-000000000001','00000000-0000-0000-0001-000000000001','00000000-0000-0000-0001-000000000001','{}')$$, 'PEER_SELF', '자기 자신 평가 거부');
select pg_temp.fails($$select sb_save_peer_review('00000000-0000-0000-0004-000000000001','00000000-0000-0000-0001-000000000002','00000000-0000-0000-0002-000000000001','{}')$$, 'PEER_FORBIDDEN', '다른 학급 학생 평가 거부');
select pg_temp.ok(sb_save_peer_review(:B1, :SB, :SA, '{"00000000-0000-0000-0007-000000000001": 9, "zzz": 1}') = '{}'::jsonb, '범위 밖·모르는 기준은 버린다');
select pg_temp.ok(sb_save_peer_review(:B1, :SB, :SA, '{"00000000-0000-0000-0007-000000000001": 3}') = '{"00000000-0000-0000-0007-000000000001": 3}'::jsonb, '저장');
select sb_save_peer_review(:B1, :SC, :SA, '{"00000000-0000-0000-0007-000000000001": 2}');
select sb_save_peer_review(:B1, :SB, :SA, '{"00000000-0000-0000-0007-000000000001": 1}');
select pg_temp.ok((select count(*) from sb_peer_reviews) = 2, '다시 저장하면 덮어쓴다');
select pg_temp.ok((sb_get_review_summary(:B1, :SA, null, :SA)->>'peer_count')::int = 2 and (sb_get_review_summary(:B1, :SA, null, :SA)->'peer_avg'->>'00000000-0000-0000-0007-000000000001')::numeric = 1.5 and sb_get_review_summary(:B1, :SA, null, :SA)::text not like '%0001-000000000002%', '평균·인원만, 평가자 미노출');
select pg_temp.ok(sb_get_review_summary(:B1, :SA, null, :SB) is null and sb_get_review_summary(:B1, :SA, :TA, null) is not null, '남의 요약 불가, 교사 가능');
update sb_evaluations set published = false where student_id = :SA;
select pg_temp.ok(sb_get_review_summary(:B1, :SA, null, :SA)->'teacher' = 'null'::jsonb and sb_get_review_summary(:B1, :SA, :TA, null)->'teacher'->>'published' = 'false', '교사 평가는 공개 후에만 학생 요약에');
update sb_boards set peer_review = false where id = :B1;
select pg_temp.fails($$select sb_save_peer_review('00000000-0000-0000-0004-000000000001','00000000-0000-0000-0001-000000000002','00000000-0000-0000-0001-000000000001','{}')$$, 'PEER_FORBIDDEN', '동료평가 끄면 저장 불가');
update sb_boards set peer_review = true where id = :B1;
select sb_save_peer_review(:B1, :SB, :SA, '{}');
select pg_temp.ok((select count(*) from sb_peer_reviews) = 1, '빈 별점이면 지운다');

-- 보관하면 학생 접근 없음
update sb_projects set archived_at = now() where id = :PJ;
select pg_temp.ok(sb_student_access(:B1, :SA) = 'none' and (select count(*) from sb_get_board_tree(:PJ, null, :SA)) = 0, '보관 프로젝트는 학생에게 0건');
update sb_projects set archived_at = null where id = :PJ;

-- 변경 신호
select pg_temp.ok((select count(*) from sb_board_events where project_id = :PJ) > 30, '변경 신호가 작업장마다 남는다');
do $$ declare s0 timestamptz; c0 timestamptz; begin
  select structure_at, content_at into s0, c0 from sb_board_events where board_id = '00000000-0000-0000-0004-000000000001';
  update sb_cards set title = '수정' where id = '00000000-0000-0000-0006-000000000001';
  perform pg_temp.ok((select content_at > c0 and structure_at = s0 from sb_board_events where board_id = '00000000-0000-0000-0004-000000000001'), '카드 수정은 content만');
  insert into sb_board_permissions values ('00000000-0000-0000-0004-000000000001','00000000-0000-0000-0001-000000000005','read');
  perform pg_temp.ok((select structure_at > s0 from sb_board_events where board_id = '00000000-0000-0000-0004-000000000001'), '권한 변경은 structure');
end $$;

-- AC21 삭제 경로(cascade)
delete from students where id = :SA;
select pg_temp.ok((select count(*) from sb_boards where owner_student_id is null and kind='personal') = 0 and (select count(*) from sb_cards where author_student_id = :SA) = 0 and (select count(*) from sb_evaluations) = 0, '학생 삭제: 개인 보드·카드·평가 정리');
select pg_temp.ok((select count(*) from sb_activities) = 2 and (select count(*) from sb_activities where actor_student_id is null) = 2, '학생 삭제: 활동 기록은 남고 행위자 set null');
delete from classes where id = '00000000-0000-0000-0000-0000000000ca';
select pg_temp.ok((select count(*) from sb_projects) = 0 and (select count(*) from sb_boards) = 0 and (select count(*) from sb_cards) = 0 and (select count(*) from sb_board_events) = 0, '학급 삭제: 별빛보드 데이터 0행');
select pg_temp.ok((select count(*) from sb_criteria) = 1, '기준은 교사 소유라 학급 삭제 후에도 남는다');
delete from teacher_profiles where id = :TA;
select pg_temp.ok((select count(*) from sb_criteria) = 0, '회원 탈퇴: 기준까지 0행');

-- AC3 RLS·권한
select pg_temp.ok((select bool_and(relrowsecurity) from pg_class where relname like 'sb\_%' and relkind = 'r') and (select count(*) from pg_policies where tablename like 'sb\_%') = 0, 'RLS 켜짐·정책 0');
select pg_temp.ok(not has_function_privilege('anon', 'sb_get_board_view(uuid,uuid,uuid)', 'execute') and not has_function_privilege('authenticated', 'sb_student_access(uuid,uuid)', 'execute') and has_function_privilege('service_role', 'sb_get_board_view(uuid,uuid,uuid)', 'execute'), '함수는 service_role 전용');
