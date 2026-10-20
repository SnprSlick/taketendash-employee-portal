"use client";

import { useState } from "react";

export const NODE_COLORS = [
  { name: "Default", value: undefined },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
] as const;

export function ColorPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (color: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-4 w-4 rounded-full border border-black/10 shadow-sm"
        style={{ backgroundColor: value ?? "#cbd5e1" }}
        title="Color"
      />
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="nodrag absolute right-0 top-6 z-20 flex w-32 flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            {NODE_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                onClick={() => {
                  onChange(c.value);
                  setOpen(false);
                }}
                className="h-5 w-5 rounded-full border border-black/10"
                style={{
                  backgroundColor: c.value ?? "#e2e8f0",
                  outline: value === c.value ? "2px solid #3b82f6" : undefined,
                  outlineOffset: 1,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
