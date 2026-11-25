'use client';

/**
 * BoardSettingsPanel / BoardSettingsDrawer — 작업장 설정(원본 board/BoardSettings.tsx)
 * 탭: 일반 · 열 · 카드 형식 · 가리기 · 권한 · 개인 보드 · 평가 기준 (학생 개인 보드는 일반 · 열 · 권한만).
 * 작업장 화면의 오른쪽 서랍과 작업장 설정 화면이 같은 패널을 씁니다.
 * 학급 학생·학생별 권한·내 기준 목록은 패널이 직접 불러옵니다.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Access, BoardView, PermissionRow, StudentLite, TreeNode } from '@/lib/starboard/types';
import type { Criterion } from '@/lib/starboard/criteria';
import { HIDE_MODE_LABEL, type HideMode } from '@/lib/starboard/hiding';
import { COLUMN_PALETTE, MAX_COLUMNS, MIN_COLUMNS } from '@/lib/starboard/columns';
import { descendants } from '@/lib/starboard/tree';
import { FIELD_TYPE_LABEL, MAX_CARD_FIELDS, MAX_FIELD_LABEL, newFieldId, type CardField, type CardFieldType } from '@/lib/starboard/card-fields';
import { json, useSb } from './context';
import CriterionForm from './CriterionForm';
import LearningCriteriaImport from './LearningCriteriaImport';

const ACCESS_LABEL: Record<Access, string> = { none: '없음', read: '읽기', edit: '수정' };
const TABS = ['일반', '열', '카드 형식', '가리기', '권한', '개인 보드', '평가 기준'] as const;
export type Tab = (typeof TABS)[number];

type SettingsData = { students: StudentLite[]; permissions: PermissionRow[]; myCriteria: Criterion[] };

type PanelProps = {
  view: BoardView;
  projectId: string;
  tree: TreeNode[];
  onChanged: () => void;
  /** 삭제 후 이동(부모 작업장 id 또는 null) */
  onDeleted: (parentId: string | null) => void;
  initialTab?: Tab;
};

type Run = (fn: () => Promise<unknown>, success?: string) => void;

export function BoardSettingsPanel({ view, projectId, tree, onChanged, onDeleted, initialTab = '일반' }: PanelProps) {
  const { api } = useSb();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [pending, setPending] = useState(false);
  const [data, setData] = useState<SettingsData>({ students: [], permissions: [], myCriteria: [] });
  const b = view.board;
  const personal = b.kind === 'personal';

  const loadData = useCallback(async () => {
    try {
      setData(await api<SettingsData>(`/boards/${b.id}/settings-data`));
    } catch {
      // 패널은 그대로 쓰고, 학생 목록이 필요한 탭만 비어 보인다
    }
  }, [api, b.id]);
  useEffect(() => {
    loadData();
  }, [loadData]);

  const run: Run = async (fn, success) => {
    setPending(true);
    try {
      await fn();
      setError('');
      setInfo(success ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : '실패했습니다.');
      setInfo('');
    } finally {
      setPending(false);
      onChanged();
      loadData();
    }
  };

  const tabs: readonly Tab[] = personal ? TABS.filter((t) => t !== '가리기' && t !== '개인 보드' && t !== '평가 기준' && t !== '카드 형식') : TABS;
  const current: Tab = tabs.includes(tab) ? tab : '일반';

  return (
    <div className="sb-settings">
      <div className="sb-settings-tabs" role="tablist" aria-label="설정 항목">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={current === t} className={current === t ? 'sb-chip-tab is-active' : 'sb-chip-tab'} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="sb-settings-body" role="tabpanel">
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {info && (
          <p className="notice success" data-testid="settings-info">
            {info}
          </p>
        )}
        {current === '일반' && <GeneralTab view={view} projectId={projectId} tree={tree} pending={pending} run={run} onDeleted={onDeleted} setError={setError} />}
        {current === '열' && <ColumnsTab view={view} pending={pending} run={run} />}
        {current === '카드 형식' && <CardFormatTab key={JSON.stringify(b.card_fields ?? [])} view={view} pending={pending} run={run} />}
        {current === '가리기' && <HidingTab view={view} pending={pending} run={run} />}
        {current === '권한' && <PermissionsTab view={view} students={data.students} permissions={data.permissions} pending={pending} run={run} />}
        {current === '개인 보드' && <PersonalTab view={view} students={data.students} pending={pending} run={run} />}
        {current === '평가 기준' && <CriteriaTab view={view} myCriteria={data.myCriteria} pending={pending} run={run} onChanged={onChanged} />}
      </div>
    </div>
  );
}

/** 작업장 화면의 설정 창(오른쪽 서랍) */
export function BoardSettingsDrawer({ onClose, ...props }: PanelProps & { onClose: () => void }) {
  const { go } = useSb();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sb-overlay is-drawer" onClick={onClose}>
      <aside className="sb-drawer" onClick={(e) => e.stopPropagation()} aria-label="보드 설정" role="dialog">
        <div className="sb-modal-head">
          <h2 className="sb-modal-title">보드 설정</h2>
          <button type="button" className="sb-btn ghost is-small" onClick={() => go({ name: 'settings', projectId: props.projectId, boardId: props.view.board.id })}>
            ⚙ 작업장 설정 페이지
          </button>
          <button type="button" className="sb-icon-btn sb-close" onClick={onClose} aria-label="설정 닫기" title="닫기">
            ×
          </button>
        </div>
        <BoardSettingsPanel {...props} />
      </aside>
    </div>
  );
}

function GeneralTab({
  view,
  projectId,
  tree,
  pending,
  run,
  onDeleted,
  setError,
}: {
  view: BoardView;
  projectId: string;
  tree: TreeNode[];
  pending: boolean;
  run: Run;
  onDeleted: (parentId: string | null) => void;
  setError: (e: string) => void;
}) {
  const { api } = useSb();
  const b = view.board;
  const [title, setTitle] = useState(b.title);
  const [target, setTarget] = useState<string>(b.parent_id ?? '');
  const [confirm, setConfirm] = useState(false);
  const blocked = descendants(tree, b.id);
  blocked.add(b.id);
  return (
    <>
      <form
        className="sb-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api(`/boards/${b.id}`, json('PATCH', { title })), '이름을 바꿨습니다.');
        }}
      >
        <input aria-label="보드 이름" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
        <button className="sb-btn ghost" disabled={pending}>
          이름 저장
        </button>
      </form>
      <div className="sb-row-wrap">
        <span>순서</span>
        <button type="button" className="sb-btn ghost" onClick={() => run(() => api(`/boards/${b.id}/place`, json('POST', { mode: 'reorder', direction: 'up' })))} disabled={pending}>
          ▲ 위로
        </button>
        <button type="button" className="sb-btn ghost" onClick={() => run(() => api(`/boards/${b.id}/place`, json('POST', { mode: 'reorder', direction: 'down' })))} disabled={pending}>
          ▼ 아래로
        </button>
      </div>
      {b.kind === 'shared' && (
        <form
          className="sb-stack"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api(`/boards/${b.id}/place`, json('POST', { mode: 'parent', parentId: target || null })), '보드를 옮겼습니다.');
          }}
        >
          <label htmlFor="move-target">다른 보드 아래로 옮기기</label>
          <div className="sb-inline-form">
            <select id="move-target" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">(최상위)</option>
              {tree
                .filter((n) => n.kind === 'shared')
                .map((n) => (
                  <option key={n.id} value={n.id} disabled={blocked.has(n.id)}>
                    {n.title}
                    {blocked.has(n.id) ? ' (불가)' : ''}
                  </option>
                ))}
            </select>
            <button className="sb-btn ghost" disabled={pending}>
              옮기기
            </button>
          </div>
        </form>
      )}
      <div className="sb-divider">
        {confirm ? (
          <button
            type="button"
            className="sb-btn is-danger"
            onClick={async () => {
              try {
                const r = await api<{ parentId: string | null }>(`/boards/${b.id}`, json('DELETE'));
                onDeleted(r.parentId ?? null);
              } catch (e) {
                setError(e instanceof Error ? e.message : '삭제하지 못했습니다.');
              }
            }}
          >
            정말 삭제(하위 보드·카드 모두 삭제)
          </button>
        ) : (
          <button type="button" className="sb-btn is-danger" onClick={() => setConfirm(true)}>
            보드 삭제
          </button>
        )}
      </div>
      <p className="sb-meta">프로젝트: {projectId.slice(0, 8)}</p>
    </>
  );
}

/** 카드 형식: 기본(제목 + 내용) 또는 교사가 레이블과 칸을 추가해 만든 형식 */
function CardFormatTab({ view, pending, run }: { view: BoardView; pending: boolean; run: Run }) {
  const { api } = useSb();
  const saved = view.board.card_fields ?? [];
  const [fields, setFields] = useState<CardField[]>(saved);
  const dirty = JSON.stringify(fields) !== JSON.stringify(saved);
  const set = (i: number, patch: Partial<CardField>) => setFields((cur) => cur.map((f, k) => (k === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) =>
    setFields((cur) => {
      const j = i + d;
      if (j < 0 || j >= cur.length) return cur;
      const n = [...cur];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const save = (next: CardField[], msg: string) => run(() => api(`/boards/${view.board.id}`, json('PATCH', { card_fields: next })), msg);

  return (
    <div className="sb-stack" data-testid="card-format">
      <p className="hint">
        카드를 쓸 때 나오는 칸을 정해요. 항목이 없으면 기본 형식(<b>제목 + 내용</b>)이에요. 제목은 늘 맨 위에 있고, 항목을 추가하면 &lsquo;내용&rsquo; 대신 그 칸들이 나와요.
        학생 개인 보드는 이 작업장의 형식을 따라요.
      </p>
      <div className="sb-stack is-tight">
        <div className="sb-format-fixed">
          <b>제목</b>
          <span className="sb-meta">· 한 줄 · 고정</span>
        </div>
        {fields.length === 0 && (
          <div className="sb-format-default">
            <b>내용</b> · 여러 줄 (기본)
          </div>
        )}
        {fields.map((f, i) => (
          <div key={f.id} className="sb-format-row" data-testid="card-format-field">
            <input
              className="sb-flex-1"
              aria-label={`항목 ${i + 1} 레이블`}
              placeholder="레이블 (예: 읽은 책, 느낀 점)"
              maxLength={MAX_FIELD_LABEL}
              value={f.label}
              onChange={(e) => set(i, { label: e.target.value })}
            />
            <select className="sb-auto" aria-label={`항목 ${i + 1} 칸 종류`} value={f.type} onChange={(e) => set(i, { type: e.target.value as CardFieldType })}>
              {(Object.keys(FIELD_TYPE_LABEL) as CardFieldType[]).map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <button type="button" className="sb-icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로" title="위로">
              ▲
            </button>
            <button type="button" className="sb-icon-btn" onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label="아래로" title="아래로">
              ▼
            </button>
            <button type="button" className="sb-icon-btn" onClick={() => setFields((cur) => cur.filter((_, k) => k !== i))} aria-label={`항목 ${i + 1} 빼기`} title="빼기">
              🗑
            </button>
          </div>
        ))}
        <button
          type="button"
          className="sb-add-btn"
          disabled={fields.length >= MAX_CARD_FIELDS}
          onClick={() => setFields((cur) => [...cur, { id: newFieldId(), label: '', type: cur.length === 0 ? 'long' : 'short' }])}
        >
          ＋ 항목 추가 {fields.length > 0 && <span className="sb-meta">({fields.length}/{MAX_CARD_FIELDS})</span>}
        </button>
      </div>
      <div className="sb-row-wrap">
        <button type="button" className="sb-btn" disabled={pending || !dirty} onClick={() => save(fields, '카드 형식을 저장했어요.')}>
          형식 저장
        </button>
        {dirty && (
          <button type="button" className="sb-btn ghost" onClick={() => setFields(saved)}>
            되돌리기
          </button>
        )}
        {saved.length > 0 && (
          <button type="button" className="sb-btn ghost sb-push-right" disabled={pending} onClick={() => save([], '기본 형식(제목 + 내용)으로 바꿨어요.')}>
            기본 형식으로
          </button>
        )}
      </div>
      <p className="hint">형식을 바꿔도 이미 쓴 카드의 값은 지워지지 않아요. 뺀 항목은 화면에서만 안 보여요.</p>
    </div>
  );
}

function ColumnsTab({ view, pending, run }: { view: BoardView; pending: boolean; run: Run }) {
  const { api } = useSb();
  const [name, setName] = useState('');
  const cols = [...view.columns].sort((a, b) => a.position - b.position);
  const [color, setColor] = useState<string>(COLUMN_PALETTE[cols.length % COLUMN_PALETTE.length]);
  return (
    <>
      <p className="hint">
        열은 {MIN_COLUMNS}~{MAX_COLUMNS}개. 지금 {cols.length}개.
      </p>
      <ul className="sb-stack is-tight">
        {cols.map((c, i) => (
          <ColumnRow key={c.id} c={c} first={i === 0} last={i === cols.length - 1} pending={pending} run={run} />
        ))}
      </ul>
      <form
        className="sb-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => api(`/boards/${view.board.id}/columns`, json('POST', { name, color })), '열을 추가했습니다.');
          setName('');
          setColor(COLUMN_PALETTE[(cols.length + 1) % COLUMN_PALETTE.length]);
        }}
      >
        <input aria-label="새 열 이름" placeholder="새 열 이름" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        <input type="color" aria-label="새 열 색" value={color} onChange={(e) => setColor(e.target.value)} className="sb-color" />
        <button className="sb-btn ghost" disabled={pending || !name.trim()}>
          열 추가
        </button>
      </form>
    </>
  );
}

function ColumnRow({ c, first, last, pending, run }: { c: BoardView['columns'][number]; first: boolean; last: boolean; pending: boolean; run: Run }) {
  const { api } = useSb();
  const [name, setName] = useState(c.name);
  const [confirm, setConfirm] = useState(false);
  const patch = (body: Record<string, unknown>) => run(() => api(`/columns/${c.id}`, json('PATCH', body)));
  return (
    <li className="sb-row-wrap" data-testid="column-row">
      <input type="color" aria-label={`${c.name} 색`} value={c.color} onChange={(e) => patch({ color: e.target.value })} className="sb-color" />
      <input className="sb-column-name-input" aria-label={`${c.name} 이름`} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== c.name && patch({ name })} />
      <button type="button" className="sb-icon-btn" disabled={first || pending} onClick={() => run(() => api(`/columns/${c.id}/move`, json('POST', { direction: 'left' })))} aria-label={`${c.name} 왼쪽으로`}>
        ◀
      </button>
      <button type="button" className="sb-icon-btn" disabled={last || pending} onClick={() => run(() => api(`/columns/${c.id}/move`, json('POST', { direction: 'right' })))} aria-label={`${c.name} 오른쪽으로`}>
        ▶
      </button>
      {confirm ? (
        <button type="button" className="sb-btn is-danger is-small" onClick={() => run(() => api(`/columns/${c.id}`, json('DELETE')))}>
          카드까지 삭제
        </button>
      ) : (
        <button type="button" className="sb-btn is-danger is-small" onClick={() => setConfirm(true)} aria-label={`${c.name} 열 삭제`}>
          삭제
        </button>
      )}
    </li>
  );
}

function HidingTab({ view, pending, run }: { view: BoardView; pending: boolean; run: Run }) {
  const { api } = useSb();
  const b = view.board;
  const cols = [...view.columns].sort((a, c) => a.position - c.position);
  const patchBoard = (body: Record<string, unknown>, msg?: string) => run(() => api(`/boards/${b.id}`, json('PATCH', body)), msg);
  return (
    <>
      <fieldset className="sb-fieldset">
        <legend>가리기 방식(학생에게 다른 학생 카드를)</legend>
        <div className="sb-row-wrap">
          {(Object.keys(HIDE_MODE_LABEL) as HideMode[]).map((m) => (
            <label key={m} className="sb-choice">
              <input type="radio" name="hide_mode" checked={b.hide_mode === m} disabled={pending} onChange={() => patchBoard({ hide_mode: m })} />
              {HIDE_MODE_LABEL[m]}
            </label>
          ))}
        </div>
        <p className="hint">숨김=안 보임 · 개수만=카드 수만 · 익명=내용은 보이고 작성자 숨김. 교사는 항상 전체를 보고, 교사가 쓴 카드는 가리기와 상관없이 모두에게 보입니다.</p>
      </fieldset>
      <fieldset className="sb-fieldset">
        <legend>적용할 열</legend>
        <div className="sb-row-wrap">
          {cols.map((c) => (
            <label key={c.id} className="sb-choice">
              <input type="checkbox" checked={c.hide_applies} disabled={pending} onChange={(e) => run(() => api(`/columns/${c.id}`, json('PATCH', { hide_applies: e.target.checked })))} />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      {b.hide_mode !== 'off' && (
        <div className="sb-row-wrap">
          {b.revealed ? (
            <button type="button" className="sb-btn ghost" onClick={() => patchBoard({ revealed: false }, '다시 가렸습니다.')}>
              다시 가리기
            </button>
          ) : (
            <button type="button" className="sb-btn" onClick={() => patchBoard({ revealed: true }, '모두 공개했습니다.')}>
              모두 공개
            </button>
          )}
        </div>
      )}
    </>
  );
}

function PermissionsTab({ view, students, permissions, pending, run }: { view: BoardView; students: StudentLite[]; permissions: PermissionRow[]; pending: boolean; run: Run }) {
  const { api } = useSb();
  const b = view.board;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const perm = new Map(permissions.map((p) => [p.student_id, p.access]));
  const def = (b.default_access ?? 'none') as Access;
  const effective = (id: string): Access => perm.get(id) ?? (b.kind === 'personal' && b.owner_id === id ? 'edit' : def);
  const all = students.length > 0 && selected.size === students.length;
  const apply = (a: Access | 'default') => {
    const ids = [...selected];
    run(() => api(`/boards/${b.id}/permissions`, json('PUT', { studentIds: ids, access: a })), `${ids.length}명의 권한을 바꿨습니다.`);
  };
  return (
    <>
      <fieldset className="sb-fieldset">
        <legend>기본 권한(모든 학생)</legend>
        <div className="sb-row-wrap">
          {(['none', 'read', 'edit'] as Access[]).map((a) => (
            <label key={a} className="sb-choice">
              <input type="radio" name="default_access" checked={def === a} disabled={pending} onChange={() => run(() => api(`/boards/${b.id}`, json('PATCH', { default_access: a })))} />
              {ACCESS_LABEL[a]}
            </label>
          ))}
        </div>
        <p className="hint">학생별 권한이 기본 권한보다 우선합니다. 없음=트리에도 안 보임.</p>
      </fieldset>
      <div className="sb-perm-bar">
        <span>{selected.size}명 선택</span>
        <button type="button" className="sb-btn is-small" disabled={!selected.size || pending} onClick={() => apply('read')}>
          읽기 주기
        </button>
        <button type="button" className="sb-btn is-small" disabled={!selected.size || pending} onClick={() => apply('edit')}>
          수정 주기
        </button>
        <button type="button" className="sb-btn is-danger is-small" disabled={!selected.size || pending} onClick={() => apply('none')}>
          권한 회수
        </button>
        <button type="button" className="sb-btn ghost is-small" disabled={!selected.size || pending} onClick={() => apply('default')}>
          기본값 따르기
        </button>
      </div>
      <div className="sb-table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" aria-label="전체 선택" checked={all} onChange={() => setSelected(all ? new Set() : new Set(students.map((s) => s.id)))} />
              </th>
              <th>학생</th>
              <th>권한</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const explicit = perm.get(s.id);
              return (
                <tr key={s.id} data-testid={`perm-${s.student_number}`}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${s.name} 선택`}
                      checked={selected.has(s.id)}
                      onChange={() =>
                        setSelected((cur) => {
                          const n = new Set(cur);
                          if (n.has(s.id)) n.delete(s.id);
                          else n.add(s.id);
                          return n;
                        })
                      }
                    />
                  </td>
                  <td>
                    {s.name} <span className="sb-meta">{s.student_number}번</span>
                  </td>
                  <td>
                    {ACCESS_LABEL[effective(s.id)]}
                    {explicit ? <span className="sb-meta sb-strong"> (학생별)</span> : <span className="sb-meta"> (기본)</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PersonalTab({ view, students, pending, run }: { view: BoardView; students: StudentLite[]; pending: boolean; run: Run }) {
  const { api } = useSb();
  const b = view.board;
  const [mode, setMode] = useState<'all' | 'some'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <>
      <p className="hint">
        이 작업장 바로 아래에 학생마다 개인 보드를 하나씩 만듭니다. 이 작업장은 그대로 칸반으로 쓸 수 있습니다. 개인 보드는 학생 이름 섹션 하나로 시작하고, 배당된 학생과 선생님만 볼 수 있습니다.
      </p>
      {b.auto_personal && <p className="notice info">전체 학생 배당됨 — 새로 등록하는 학생에게도 자동으로 만들어집니다.</p>}
      <fieldset className="sb-fieldset">
        <label className="sb-choice">
          <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} /> 전체 학생 ({students.length}명, 이후 등록 학생 포함)
        </label>
        <label className="sb-choice">
          <input type="radio" checked={mode === 'some'} onChange={() => setMode('some')} /> 선택한 학생만
        </label>
      </fieldset>
      {mode === 'some' && (
        <div className="sb-check-grid">
          {students.map((s) => (
            <label key={s.id} className="sb-choice">
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() =>
                  setSelected((cur) => {
                    const n = new Set(cur);
                    if (n.has(s.id)) n.delete(s.id);
                    else n.add(s.id);
                    return n;
                  })
                }
              />
              {s.name}
            </label>
          ))}
        </div>
      )}
      <button
        type="button"
        className="sb-btn sb-auto"
        disabled={pending || (mode === 'some' && !selected.size)}
        onClick={() =>
          run(
            () => api(`/boards/${b.id}/personal-boards`, json('POST', { studentIds: mode === 'all' ? null : [...selected] })),
            '학생별 개인 보드를 만들었습니다.',
          )
        }
      >
        {pending ? '만드는 중…' : '학생별 개인 보드 만들기'}
      </button>
    </>
  );
}

function CriteriaTab({ view, myCriteria, pending, run, onChanged }: { view: BoardView; myCriteria: Criterion[]; pending: boolean; run: Run; onChanged: () => void }) {
  const { api } = useSb();
  const b = view.board;
  const attached = new Set(view.criteria.map((c) => c.id));
  const [pick, setPick] = useState('');
  const [creating, setCreating] = useState(false);
  const crit = (method: string, body: Record<string, unknown>, msg?: string) => run(() => api(`/boards/${b.id}/criteria`, json(method, body)), msg);
  return (
    <>
      <label className="sb-choice">
        <input type="checkbox" checked={b.show_criteria} disabled={pending} onChange={(e) => run(() => api(`/boards/${b.id}`, json('PATCH', { show_criteria: e.target.checked })))} />
        학생에게 기준 미리 보여주기
      </label>
      <label className="sb-choice is-top">
        <input
          type="checkbox"
          checked={b.peer_review ?? true}
          disabled={pending}
          onChange={(e) => run(() => api(`/boards/${b.id}`, json('PATCH', { peer_review: e.target.checked })))}
          data-testid="peer-review-toggle"
        />
        <span>
          학생끼리 평가하기(동료평가)
          <span className="hint sb-block">
            멤버별 섹션 머리의 ⭐로 친구를 이 기준에 따라 별점으로 평가해요(자기 자신은 안 돼요). 각자 자기 섹션의 📊에서 선생님 평가와 친구 평가 총평균을 봐요. 켜 두면 학생도 기준을 봐요.
          </span>
        </span>
      </label>
      <ol className="sb-stack is-tight">
        {view.criteria.map((c, i) => (
          <li key={c.id} className="sb-criterion-row">
            <span className="sb-flex-1">
              {i + 1}. {c.name}
            </span>
            <button type="button" className="sb-icon-btn" disabled={i === 0} onClick={() => crit('PATCH', { criterionId: c.id, direction: 'up' })} aria-label="위로">
              ▲
            </button>
            <button type="button" className="sb-icon-btn" disabled={i === view.criteria.length - 1} onClick={() => crit('PATCH', { criterionId: c.id, direction: 'down' })} aria-label="아래로">
              ▼
            </button>
            <button type="button" className="sb-btn is-danger is-small" onClick={() => crit('DELETE', { criterionId: c.id })}>
              떼기
            </button>
          </li>
        ))}
        {!view.criteria.length && <li className="sb-meta">붙은 기준이 없습니다.</li>}
      </ol>
      <form
        className="sb-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (pick) crit('POST', { criterionId: pick }, '기준을 붙였습니다.');
          setPick('');
        }}
      >
        <select aria-label="붙일 기준" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">내 기준 목록에서 고르기</option>
          {myCriteria
            .filter((c) => !attached.has(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <button className="sb-btn ghost" disabled={!pick || pending}>
          붙이기
        </button>
      </form>
      {creating ? (
        <div className="sb-subpanel">
          <CriterionForm
            attachToBoardId={b.id}
            onDone={() => {
              setCreating(false);
              onChanged();
            }}
          />
        </div>
      ) : (
        <button type="button" className="sb-btn ghost sb-auto" onClick={() => setCreating(true)}>
          ＋ 새 기준 만들어 붙이기
        </button>
      )}
      <details className="sb-subpanel">
        <summary>배움성찰 평가요소 불러와서 붙이기</summary>
        <LearningCriteriaImport attachToBoardId={b.id} onDone={onChanged} />
      </details>
    </>
  );
}
