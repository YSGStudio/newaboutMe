/**
 * 별빛보드 화면·라우트가 함께 쓰는 타입.
 * 원본(classboard src/lib/types.ts)과 같은 모양이고, 별빛로그 계정 구조에 맞춰 다음만 다르다.
 *   - Profile 없음: 교사는 teacher_profiles, 학생은 students
 *   - Project: teacher_id 대신 class_id + teacher_id, flow 없음(원본에서 쓰이지 않음)
 *   - TreeNode·BoardInfo: locked·unlocked 없음
 *   - CardView: author_login → author_number(학생 번호)
 */
import type { HideMode } from "./hiding";
import type { Criterion } from "./criteria";
import type { CardField, CardFieldValues } from "./card-fields";

export type Access = "none" | "read" | "edit";

export type Project = {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  goal: string;
  /** 과목(SUBJECT_LIST). 있으면 평가 결과가 배움성찰 교과발달상황·성장리포트에 들어간다. */
  subject: string | null;
  start_date: string | null;
  end_date: string | null;
  archived_at: string | null;
  created_at: string;
};

export type TreeNode = {
  id: string;
  parent_id: string | null;
  title: string;
  position: number;
  kind: "shared" | "personal";
  owner_id: string | null;
  accessible: boolean;
  access: Access | "teacher";
};

export type ColumnView = {
  id: string;
  name: string;
  stage: string | null;
  position: number;
  color: string;
  hide_applies: boolean;
  /** 이 섹션의 주인 학생(멤버별 섹션·개인 보드 섹션) */
  member_id?: string | null;
  effective_hide: HideMode;
  hidden_count: number;
};

export type AttachmentView = {
  id: string;
  type: "image" | "pdf" | "link";
  name: string;
  storage_path: string | null;
  thumb_path: string | null;
  url: string | null;
  size: number | null;
  page_count: number | null;
  preview: {
    title: string | null;
    description: string | null;
    image_url: string | null;
    site_name: string | null;
    ok: boolean;
  } | null;
};

export type ChecklistItem = { text: string; done: boolean };

export type CardView = {
  id: string;
  column_id: string;
  title: string;
  body: string;
  /** 보드 카드 형식의 항목별 값 */
  fields?: CardFieldValues;
  labels: string[];
  due_date: string | null;
  checklist: ChecklistItem[];
  position: number;
  created_at: string;
  updated_at: string;
  is_mine: boolean;
  author_id: string | null;
  author_name: string | null;
  /** 학생 번호(교사 카드·가려진 작성자는 null) */
  author_number?: number | null;
  author_role?: "teacher" | "student" | null;
  can_edit: boolean;
  attachments: AttachmentView[];
};

export type BoardInfo = {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  kind: "shared" | "personal";
  owner_id: string | null;
  owner_name: string | null;
  default_access: Access | null;
  hide_mode: HideMode;
  revealed: boolean;
  show_criteria: boolean;
  auto_personal: boolean;
  /** 카드 형식 (빈 배열 = 기본: 제목 + 내용). 개인 보드는 부모 작업장 것 */
  card_fields?: CardField[];
  /** 평가 작업장에서 학생끼리 평가하기 */
  peer_review?: boolean;
  /** 지금 보고 있는 사람 */
  viewer_id?: string | null;
  access: Access | "teacher";
  can_write: boolean;
  evaluation_board_id: string;
  has_personal_children: boolean;
};

export type BoardView = {
  board: BoardInfo;
  columns: ColumnView[];
  cards: CardView[];
  criteria: Criterion[];
  my_evaluation: {
    levels: Record<string, number>;
    feedback: string;
    updated_at: string;
    criteria: Criterion[];
  } | null;
};

export type Activity = {
  id: number;
  action: "create" | "update" | "move" | "delete";
  created_at: string;
  actor_name: string | null;
  from_column: string | null;
  to_column: string | null;
};

/** 설정 화면용 학생(원본 StudentLite: display_name·login_id·active → name·student_number) */
export type StudentLite = { id: string; name: string; student_number: number };
export type PermissionRow = { student_id: string; access: Access };
