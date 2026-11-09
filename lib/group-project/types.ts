/** 모둠 프로젝트 DB 행과 API 응답 모양. 화면과 라우트가 함께 쓴다. */
import type { TaskStatus } from './dates';
import type { RoomKind, ScopeContext } from './scope';

export type GpTopic = {
  id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  goal: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
};

export type GpProject = {
  id: string;
  topic_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
};

export type GpGroup = {
  id: string;
  project_id: string;
  name: string;
  leader_student_id: string | null;
  created_at: string;
};

export type GpMember = { id: string; name: string };

/** 할 일 행. assignee_ids는 gp_task_assignees에서 채운다. */
export type GpTask = {
  id: string;
  project_id: string;
  group_id: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  assignee_ids: string[];
  status: TaskStatus;
  ai_generated: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type GpAttachment = {
  id: string;
  task_id: string;
  kind: 'pdf' | 'image' | 'link' | 'text';
  storage_path: string | null;
  url: string | null;
  body: string | null;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by_teacher_id: string | null;
  uploaded_by_student_id: string | null;
  created_at: string;
};

/** 화면에 내려가는 결과물. href는 서명 URL(파일) 또는 원래 주소(링크). */
export type GpAttachmentView = Omit<GpAttachment, 'storage_path'> & {
  href: string | null;
  taskTitle: string;
  uploaderName: string;
  canDelete: boolean;
};

export type GpNotice = {
  id: string;
  project_id: string;
  group_id: string | null;
  author_teacher_id: string | null;
  author_student_id: string | null;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type GpComment = {
  id: string;
  notice_id: string;
  author_teacher_id: string | null;
  author_student_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

/** 주제 전체공지. 그 주제의 모든 방 공지 탭 맨 위에 보인다. */
export type GpTopicNotice = {
  id: string;
  topic_id: string;
  teacher_id: string | null;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type GpCommentView = GpComment & { authorName: string; canEdit: boolean; canDelete: boolean };

export type GpNoticeView = GpNotice & {
  authorName: string;
  scopeLabel: string;
  canEdit: boolean;
  comments: GpCommentView[];
};

export type EditableScope = { groupId: string | null; label: string; members: GpMember[] };

export type WorkspaceSection = { key: string; title: string; groupId: string | null; tasks: GpTask[] };

/** rooms/[roomId] GET 응답 */
export type RoomBundle = {
  me: { kind: 'teacher' | 'student'; id: string; name: string };
  project: GpProject;
  topic: GpTopic;
  groups: GpGroup[];
  members: GpMember[];
  groupOf: Record<string, string>;
  scope: ScopeContext;
  kind: RoomKind;
  myGroup: GpGroup | null;
  leaderIds: string[];
  leaderNames: string[];
  names: Record<string, string>;
  editableScopes: EditableScope[];
  /** 교사만: 방에 넣을 수 있는 학급 학생과 다른 방 소속 정보 */
  classStudents?: { id: string; name: string; student_number: number; otherRoom: string | null }[];
  /** 교사만: 공동 팀장 후보(주제 팀장)와 다른 방 소속 정보 */
  leaderCandidates?: { id: string; name: string; otherRoom: string | null }[];
  /** 교사만: 같은 주제의 방 목록(방 전환용) */
  siblingRooms?: { id: string; name: string }[];
};

/** rooms/[roomId]/tasks GET 응답 */
export type WorkspaceBundle = {
  view: string | null;
  tasks: GpTask[];
  sections: WorkspaceSection[];
  names: Record<string, string>;
  unassignedInGroupRoom: boolean;
  today: string;
  attachments: GpAttachmentView[];
};

/** me/rooms GET 응답의 한 항목 */
export type StudentRoom = { project: GpProject; topic: GpTopic };

export type ActivityRow = {
  student_id: string;
  student_name: string;
  project_id: string;
  project_name: string;
  group_id: string | null;
  group_name: string | null;
  is_group_room: boolean;
  member_role: 'leader' | 'group_leader' | 'member';
  task_count: number;
  todo_count: number;
  doing_count: number;
  done_count: number;
  overdue_count: number;
  attachment_count: number;
  notice_count: number;
  comment_count: number;
  last_activity_at: string | null;
};

export type WorkAttachment = GpAttachmentView & { projectId: string };

export type StudentWork = {
  tasks: (GpTask & { attachments: WorkAttachment[] })[];
  uploads: WorkAttachment[];
  notices: GpNotice[];
  comments: (GpComment & { noticeTitle: string; projectId: string })[];
  timeline: { at: string; kind: 'task' | 'attachment' | 'notice' | 'comment'; id: string; label: string }[];
};
