'use client';

/**
 * CardContentInputs / CardContentView — 카드 내용 입력칸과 보기(원본 kanban/CardContent.tsx)
 * 보드 카드 형식이 비어 있으면 기본 '내용' 한 칸, 아니면 교사가 만든 항목들(레이블 + 칸). 제목 칸은 부르는 쪽이 그립니다.
 */
import { filledFields, MAX_FIELD_VALUE, type CardField, type CardFieldValues } from '@/lib/starboard/card-fields';
import type { CardView } from '@/lib/starboard/types';

type InputProps = {
  template: CardField[];
  body: string;
  onBody: (v: string) => void;
  values: CardFieldValues;
  onValues: (v: CardFieldValues) => void;
  idPrefix: string;
  compact?: boolean;
};

export function CardContentInputs({ template, body, onBody, values, onValues, idPrefix, compact }: InputProps) {
  if (template.length === 0) {
    return (
      <div>
        <label htmlFor={`${idPrefix}-body`}>내용</label>
        <textarea
          id={`${idPrefix}-body`}
          className={compact ? 'sb-textarea-sm' : undefined}
          value={body}
          maxLength={2000}
          placeholder={compact ? '내용을 적어 주세요' : undefined}
          onChange={(e) => onBody(e.target.value)}
          data-testid="card-input-body"
        />
        {!compact && <p className="hint sb-right">{body.length}/2000</p>}
      </div>
    );
  }
  return (
    <>
      {template.map((f) => {
        const id = `${idPrefix}-f-${f.id}`;
        const set = (v: string) => onValues({ ...values, [f.id]: v });
        return (
          <div key={f.id}>
            <label htmlFor={id}>{f.label}</label>
            {f.type === 'long' ? (
              <textarea
                id={id}
                className={compact ? 'sb-textarea-sm' : undefined}
                value={values[f.id] ?? ''}
                maxLength={MAX_FIELD_VALUE}
                onChange={(e) => set(e.target.value)}
                data-testid="card-input-field"
              />
            ) : (
              <input id={id} value={values[f.id] ?? ''} maxLength={MAX_FIELD_VALUE} onChange={(e) => set(e.target.value)} data-testid="card-input-field" />
            )}
          </div>
        );
      })}
    </>
  );
}

/** 카드 내용 보기: 형식 항목(레이블 + 값) 또는 기본 내용. preview면 카드 위 미리보기(2줄·항목 3개) */
export function CardContentView({ card, template, preview }: { card: Pick<CardView, 'body' | 'fields'>; template: CardField[]; preview?: boolean }) {
  if (template.length === 0) {
    if (!card.body) return null;
    return preview ? <span className="sb-clamp-2 sb-muted-text">{card.body}</span> : <p className="sb-prewrap">{card.body}</p>;
  }
  const items = filledFields(template, card.fields);
  if (items.length === 0) return null;
  const shown = preview ? items.slice(0, 3) : items;
  return (
    <span className={preview ? 'sb-fields is-preview' : 'sb-fields'} data-testid="card-fields">
      {shown.map((f) => (
        <span key={f.id} className="sb-field">
          <span className="sb-field-label">{f.label}</span>
          <span className={preview ? 'sb-clamp-2' : 'sb-prewrap'}>{f.value}</span>
        </span>
      ))}
      {preview && items.length > shown.length && <span className="sb-meta">… {items.length - shown.length}개 더</span>}
    </span>
  );
}
