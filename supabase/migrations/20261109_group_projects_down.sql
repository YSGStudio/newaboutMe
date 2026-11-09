-- 20261109_group_projects.sql 롤백
-- 모둠 프로젝트 데이터를 모두 지운다. group-project-files 버킷의 파일은 따로 비워야 한다.

drop function if exists public.gp_ai_usage_today(uuid, uuid);
drop function if exists public.gp_topic_student_activity(uuid);

-- 트리거 함수는 테이블을 지운 뒤에 지운다(트리거가 함께 사라진다).
drop table if exists public.gp_ai_generation_log;
drop table if exists public.gp_notice_comments;
drop table if exists public.gp_notices;
drop table if exists public.gp_task_attachments;
drop table if exists public.gp_task_assignees;
drop table if exists public.gp_tasks;
drop table if exists public.gp_group_members;
drop table if exists public.gp_groups;
drop table if exists public.gp_project_members;
drop table if exists public.gp_project_leaders;
drop table if exists public.gp_projects;
drop table if exists public.gp_topic_leaders;
drop table if exists public.gp_topics;

drop function if exists public.gp_touch_comment();
drop function if exists public.gp_check_notice();
drop function if exists public.gp_check_task_assignee();
drop function if exists public.gp_on_task_scope_changed();
drop function if exists public.gp_check_task();
drop function if exists public.gp_on_group_member_left();
drop function if exists public.gp_check_group_member();
drop function if exists public.gp_check_group();
drop function if exists public.gp_on_project_member_removed();
drop function if exists public.gp_check_project_member();
drop function if exists public.gp_add_project_leader_as_member();
drop function if exists public.gp_check_project_leader();
drop function if exists public.gp_check_project();
drop function if exists public.gp_on_topic_leader_removed();
drop function if exists public.gp_check_topic_leader();
drop function if exists public.gp_today_kst();

-- task_drafts 기록이 남아 있으면 이전 check를 걸 수 없다.
delete from public.ai_usage_logs where feature = 'task_drafts';
alter table public.ai_usage_logs drop constraint ai_usage_logs_feature_check;
alter table public.ai_usage_logs add constraint ai_usage_logs_feature_check
  check (feature in ('growth_report', 'holland_report', 'subject_report'));
