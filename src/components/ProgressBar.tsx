
export default function ProgressBar({ value = 0 }) {
  return (
    <div className="w-full bg-brand-subtle rounded-full h-3 overflow-hidden">
      <div className="h-3 bg-brand-solid" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}


