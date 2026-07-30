/**
 * Tabs — 탭 메뉴
 * items(탭 목록) 중 value에 해당하는 탭을 활성 표시하고, 클릭 시 onChange(key)로 알립니다.
 * 실제로 어떤 화면을 보여줄지는 부모(예: 교사 대시보드)가 value로 판단해 결정합니다.
 * disabled=true인 탭은 흐리게 표시되고 클릭이 막힙니다.
 */
export type TabItem = {
  key: string;
  label: string;
  icon?: string;
  disabled?: boolean;
};

type Props = {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
};

export default function Tabs({ items, value, onChange }: Props) {
  return (
    <div className="tabs" role="tablist" aria-label="탭 메뉴">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={value === item.key}
          className={value === item.key ? 'tab active' : 'tab'}
          disabled={item.disabled}
          style={item.disabled ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
          onClick={() => onChange(item.key)}
        >
          {item.icon && <span className="tab-icon" aria-hidden="true">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
