/**
 * 라우트 통합 테스트용 인메모리 supabaseAdmin 대역.
 * 권한 판정 경로를 실제 라우트 코드로 태우는 것이 목적이다.
 * DB 트리거·cascade는 흉내 내지 않는다(그쪽은 실제 Postgres에서 따로 확인한다).
 */
type Row = Record<string, unknown>;

/** 자식 테이블 → 부모 테이블 FK */
const PARENT: Record<string, Record<string, string>> = {
  gp_projects: { gp_topics: 'topic_id' },
  gp_topics: { classes: 'class_id' },
  gp_project_members: { students: 'student_id', gp_projects: 'project_id' },
  gp_project_leaders: { students: 'student_id' },
  gp_topic_leaders: { students: 'student_id' },
  gp_task_attachments: { gp_tasks: 'task_id' },
  gp_notice_comments: { gp_notices: 'notice_id' },
  gp_tasks: { gp_projects: 'project_id' },
};

/** 부모 테이블 → 자식 목록 FK */
const CHILD: Record<string, Record<string, string>> = {
  gp_tasks: { gp_task_assignees: 'task_id' },
};

type Embed = { table: string; inner: boolean; children: Embed[] };

function parseEmbeds(select: string): Embed[] {
  const embeds: Embed[] = [];
  let i = 0;
  while (i < select.length) {
    const m = /^([a-z_]+)(!inner)?\(/.exec(select.slice(i));
    if (m) {
      let depth = 1;
      let j = i + m[0].length;
      const start = j;
      while (depth > 0) {
        if (select[j] === '(') depth++;
        if (select[j] === ')') depth--;
        j++;
      }
      embeds.push({ table: m[1], inner: Boolean(m[2]), children: parseEmbeds(select.slice(start, j - 1)) });
      i = j;
    } else {
      const next = select.indexOf(',', i);
      if (next < 0) break;
      i = next + 1;
      while (select[i] === ' ') i++;
    }
  }
  return embeds;
}

type Pred = (row: Row) => boolean;

function getPath(row: Row, path: string[]): unknown {
  let cur: unknown = row;
  for (const key of path) {
    if (Array.isArray(cur)) cur = cur[0];
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Row)[key];
  }
  return cur;
}

export class FakeDb {
  tables: Record<string, Row[]> = {};
  storageObjects = new Set<string>();
  /** rpc 결과를 테스트에서 정한다. */
  rpcHandlers: Record<string, (args: Row) => unknown> = {};
  private seq = 0;

  rows(table: string): Row[] {
    return (this.tables[table] ??= []);
  }

  newId(): string {
    this.seq += 1;
    return `90000000-0000-4000-8000-${String(this.seq).padStart(12, '0')}`;
  }

  from(table: string) {
    return new Query(this, table);
  }

  rpc(name: string, args: Row) {
    return Promise.resolve({ data: this.rpcHandlers[name]?.(args) ?? null, error: null });
  }

  storage = {
    from: () => ({
      upload: async (path: string) => {
        this.storageObjects.add(path);
        return { data: { path }, error: null };
      },
      remove: async (paths: string[]) => {
        paths.forEach((p) => this.storageObjects.delete(p));
        return { data: paths, error: null };
      },
      createSignedUrls: async (paths: string[], expiresIn: number) => ({
        data: paths.map((path) => ({ path, signedUrl: `https://signed.test/${path}?ttl=${expiresIn}`, error: null })),
        error: null,
      }),
    }),
  };

  embed(table: string, row: Row, embeds: Embed[]): Row | null {
    const out: Row = { ...row };
    for (const e of embeds) {
      const parentFk = PARENT[table]?.[e.table];
      const childFk = CHILD[table]?.[e.table];
      if (parentFk) {
        const parent = this.rows(e.table).find((r) => r.id === row[parentFk]);
        const value = parent ? this.embed(e.table, parent, e.children) : null;
        if (e.inner && !value) return null;
        out[e.table] = value;
      } else if (childFk) {
        out[e.table] = this.rows(e.table).filter((r) => r[childFk] === row.id);
      } else {
        throw new Error(`fake-supabase: ${table} → ${e.table} 관계가 정의되지 않았습니다`);
      }
    }
    return out;
  }
}

type Result = { data: unknown; error: { code?: string; message: string } | null; count?: number };

class Query implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private conflict: string[] = [];
  private selectStr = '*';
  private payload: Row[] = [];
  private patch: Row = {};
  private preds: Pred[] = [];
  private orderKeys: { key: string; asc: boolean }[] = [];
  private rangeBounds: [number, number] | null = null;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private head = false;
  private wantCount = false;
  private returning = false;

  constructor(
    private db: FakeDb,
    private table: string,
  ) {}

  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    this.selectStr = cols;
    if (this.op !== 'select') this.returning = true;
    if (opts?.head) this.head = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }
  insert(v: Row | Row[]) {
    this.op = 'insert';
    this.payload = Array.isArray(v) ? v : [v];
    return this;
  }
  upsert(v: Row[], opts: { onConflict: string }) {
    this.op = 'upsert';
    this.payload = v;
    this.conflict = opts.onConflict.split(',');
    return this;
  }
  update(v: Row) {
    this.op = 'update';
    this.patch = v;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  private add(path: string, test: (v: unknown) => boolean) {
    const keys = path.split('.');
    this.preds.push((r) => test(getPath(r, keys)));
    return this;
  }
  eq(p: string, v: unknown) {
    return this.add(p, (x) => x === v);
  }
  neq(p: string, v: unknown) {
    return this.add(p, (x) => x !== v);
  }
  in(p: string, vs: unknown[]) {
    return this.add(p, (x) => vs.includes(x));
  }
  gte(p: string, v: string) {
    return this.add(p, (x) => String(x) >= v);
  }
  not(p: string, _op: string, _v: unknown) {
    return this.add(p, (x) => x !== null && x !== undefined);
  }
  or(expr: string) {
    const parts = expr.split(',').map((s) => {
      const [col, op, ...rest] = s.split('.');
      return { col, op, val: rest.join('.') };
    });
    this.preds.push((r) =>
      parts.some(({ col, op, val }) => {
        const x = r[col];
        if (x === null || x === undefined) return false;
        return op === 'lt' ? String(x) < val : String(x) > val;
      }),
    );
    return this;
  }
  order(key: string, opts?: { ascending?: boolean }) {
    this.orderKeys.push({ key, asc: opts?.ascending !== false });
    return this;
  }
  range(from: number, to: number) {
    this.rangeBounds = [from, to];
    return this;
  }
  limit(n: number) {
    this.rangeBounds = [0, n - 1];
    return this;
  }
  single() {
    this.mode = 'single';
    return this;
  }
  maybeSingle() {
    this.mode = 'maybe';
    return this;
  }

  private matching(): Row[] {
    const embeds = parseEmbeds(this.selectStr);
    return this.db
      .rows(this.table)
      .map((r) => ({ raw: r, view: this.db.embed(this.table, r, embeds) }))
      .filter((x) => x.view && this.preds.every((p) => p(x.view as Row)))
      .map((x) => x.raw);
  }

  private run(): Result {
    const embeds = parseEmbeds(this.selectStr);
    let rows: Row[];
    if (this.op === 'upsert') {
      rows = this.payload.map((p) => {
        const hit = this.db.rows(this.table).find((r) => this.conflict.every((c) => r[c] === p[c]));
        if (hit) return Object.assign(hit, p);
        const row: Row = { id: this.db.newId(), ...p };
        this.db.rows(this.table).push(row);
        return row;
      });
    } else if (this.op === 'insert') {
      rows = this.payload.map((p) => {
        const row: Row = { id: this.db.newId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...p };
        this.db.rows(this.table).push(row);
        return row;
      });
    } else if (this.op === 'update') {
      rows = this.matching();
      rows.forEach((r) => Object.assign(r, this.patch, { updated_at: new Date().toISOString() }));
    } else if (this.op === 'delete') {
      rows = this.matching();
      this.db.tables[this.table] = this.db.rows(this.table).filter((r) => !rows.includes(r));
    } else {
      rows = this.matching();
    }

    if (this.op !== 'select' && !this.returning) return { data: null, error: null };

    for (const { key, asc } of [...this.orderKeys].reverse()) {
      rows = [...rows].sort((a, b) => (String(a[key]) < String(b[key]) ? -1 : String(a[key]) > String(b[key]) ? 1 : 0) * (asc ? 1 : -1));
    }
    const count = rows.length;
    if (this.rangeBounds) rows = rows.slice(this.rangeBounds[0], this.rangeBounds[1] + 1);
    const views = rows.map((r) => this.db.embed(this.table, r, embeds));

    if (this.head) return { data: null, error: null, count };
    if (this.mode === 'many') return { data: views, error: null, count: this.wantCount ? count : undefined };
    if (views.length === 0) return this.mode === 'maybe' ? { data: null, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    return { data: views[0], error: null };
  }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(ok, fail);
  }
}
