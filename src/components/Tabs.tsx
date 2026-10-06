
interface TabsProps {
  tabs: string[];
  value: number;
  onChange: (index: number) => void;
  className?: string;
}

export default function Tabs({ tabs = [], value, onChange, className = "" }: TabsProps) {
  return (
    <div className={`bg-muted rounded-lg p-1 inline-flex ${className}`}>
      {tabs.map((t, i) => (
        <button
          key={t}
          onClick={() => onChange(i)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
            value === i 
              ? 'bg-card shadow-sm text-foreground border border-border' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}


