create or replace function public.sb_visible_counts_for_boards(p_project uuid, p_teacher uuid, p_student uuid, p_boards uuid[])
returns table (board_id uuid, count bigint)
language sql stable security definer set search_path = public as $$
  select c.board_id, count(*)
  from sb_cards c join sb_boards b on b.id = c.board_id
  where b.project_id = p_project and c.board_id = any(p_boards)
    and public.sb_card_listed(c, p_teacher, p_student)
  group by c.board_id
$$;
revoke execute on function public.sb_visible_counts_for_boards(uuid, uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.sb_visible_counts_for_boards(uuid, uuid, uuid, uuid[]) to service_role;

-- 첨부 열람은 익명 카드까지 허용하는 기존 카드 읽기 권한을 따른다.
create or replace function public.sb_readable_attachment_paths(p_board uuid, p_teacher uuid, p_student uuid, p_paths text[])
returns table (path text)
language sql stable security definer set search_path = public as $$
  select distinct requested.path
  from sb_cards c join sb_attachments a on a.card_id = c.id
  cross join lateral (values (a.storage_path), (a.thumb_path)) requested(path)
  where c.board_id = p_board and requested.path = any(p_paths)
    and public.sb_can_read_card(c.id, p_teacher, p_student)
$$;
revoke execute on function public.sb_readable_attachment_paths(uuid, uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.sb_readable_attachment_paths(uuid, uuid, uuid, text[]) to service_role;
