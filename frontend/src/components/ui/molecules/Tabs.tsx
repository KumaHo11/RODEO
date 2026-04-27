import { twMerge } from 'tailwind-merge';

interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
}

export function Tabs<T extends string>({
  items,
  activeTab,
  onChange,
  className,
}: TabsProps<T>) {
  return (
    <div className={twMerge('flex gap-1 p-1 bg-[var(--color-bg-muted)] rounded-xl', className)}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={twMerge(
            'flex-1 py-2 text-sm font-bold rounded-lg transition-all capitalize',
            activeTab === item.id
              ? 'bg-white text-[var(--color-primary)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
