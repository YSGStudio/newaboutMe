export type TabItem = {
  key: string;
  label: string;
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
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
