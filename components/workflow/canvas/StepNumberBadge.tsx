// Small outline number (e.g. "1.1.2") pinned to a node's top-left corner.
export function StepNumberBadge({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <span
      className="absolute -left-2 -top-3 z-10 rounded-full border border-slate-300 bg-white px-1.5 text-[10px] font-semibold leading-4 text-slate-600 shadow-sm"
      title="Step number"
    >
      {value}
    </span>
  );
}
