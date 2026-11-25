-- 20261125_starboard.sql 롤백
-- 별빛보드 데이터를 모두 지운다. starboard-files 버킷의 파일은 따로 비워야 한다.

drop function if exists public.sb_get_review_summary(uuid, uuid, uuid, uuid);
drop function if exists public.sb_save_peer_review(uuid, uuid, uuid, jsonb);
drop function if exists public.sb_recent_cards(uuid, uuid, uuid, int);
drop function if exists public.sb_visible_card_counts(uuid, uuid, uuid);
drop function if exists public.sb_get_board_student_summary(uuid, uuid);
drop function if exists public.sb_get_card_activities(uuid, uuid, uuid);
drop function if exists public.sb_get_board_view(uuid, uuid, uuid);
drop function if exists public.sb_get_board_tree(uuid, uuid, uuid);
drop function if exists public.sb_auto_personal_for_student(uuid);
drop function if exists public.sb_create_personal_boards(uuid, uuid[], uuid);
drop function if exists public.sb_create_personal_board(uuid, uuid);

-- 테이블을 지우면 트리거가 함께 사라진다. 트리거·판정 함수는 그 뒤에 지운다.
drop table if exists public.sb_peer_reviews;
drop table if exists public.sb_evaluations;
drop table if exists public.sb_board_criteria;
drop table if exists public.sb_criteria;
drop table if exists public.sb_board_events;
drop table if exists public.sb_activities;
drop table if exists public.sb_link_previews;
drop table if exists public.sb_attachments;
drop function if exists public.sb_card_listed(public.sb_cards, uuid, uuid);
drop table if exists public.sb_cards;
drop table if exists public.sb_columns;
drop table if exists public.sb_board_permissions;
drop table if exists public.sb_boards;
drop table if exists public.sb_projects;

drop function if exists public.sb_evaluations_after();
drop function if exists public.sb_evaluations_before();
drop function if exists public.sb_board_criteria_after();
drop function if exists public.sb_board_criteria_check();
drop function if exists public.sb_criteria_lock();
drop function if exists public.sb_board_permissions_after();
drop function if exists public.sb_board_permissions_check();
drop function if exists public.sb_attachments_after();
drop function if exists public.sb_cards_after();
drop function if exists public.sb_cards_before();
drop function if exists public.sb_columns_after();
drop function if exists public.sb_columns_limit();
drop function if exists public.sb_boards_after();
drop function if exists public.sb_boards_before();
drop function if exists public.sb_projects_check();
drop function if exists public.sb_touch_board(uuid, text);
drop function if exists public.sb_evaluation_board(uuid);
drop function if exists public.sb_can_write_card(uuid, uuid, uuid);
drop function if exists public.sb_can_read_card(uuid, uuid, uuid);
drop function if exists public.sb_column_hide_mode(uuid);
drop function if exists public.sb_student_access(uuid, uuid);
drop function if exists public.sb_is_board_teacher(uuid, uuid);
drop function if exists public.sb_valid_levels(jsonb);
