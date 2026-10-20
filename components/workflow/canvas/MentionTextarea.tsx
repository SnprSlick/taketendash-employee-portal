import { useRef, useState, type KeyboardEvent } from "react";
import { mentionToken } from "@/lib/workflow/flow/mentions";
import type { Role } from "@/lib/workflow/flow/types";

export function MentionTextarea({
  value,
  onChange,
  onCommit,
  onCancel,
  roles,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  roles: Role[];
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = query === null ? [] : roles.filter((r) => r.title.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  function updateMentionQuery(text: string, caret: number) {
    const upToCaret = text.slice(0, caret);
    const atIndex = upToCaret.lastIndexOf("@");
    if (atIndex === -1) {
      setQuery(null);
      return;
    }
    const between = upToCaret.slice(atIndex + 1);
    if (/[\s)]/.test(between) || between.includes("[")) {
      setQuery(null);
      return;
    }
    setQuery(between);
    setActiveIndex(0);
  }

  function insertMention(role: Role) {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const upToCaret = value.slice(0, caret);
    const atIndex = upToCaret.lastIndexOf("@");
    const token = mentionToken(role.title, role.id);
    const next = value.slice(0, atIndex) + token + " " + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = atIndex + token.length + 1;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (query !== null && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(matches[activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onCommit();
    if (e.key === "Escape") onCancel();
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        autoFocus
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          updateMentionQuery(e.target.value, e.target.selectionStart);
        }}
        onKeyUp={(e) => updateMentionQuery(e.currentTarget.value, e.currentTarget.selectionStart)}
        onClick={(e) => updateMentionQuery(e.currentTarget.value, e.currentTarget.selectionStart)}
        onBlur={() => {
          setTimeout(() => setQuery(null), 100);
          onCommit();
        }}
        onKeyDown={handleKeyDown}
        className="w-full resize-none rounded border border-blue-300 p-1 text-sm text-slate-900 outline-none nodrag"
        rows={rows}
      />
      {query !== null && matches.length > 0 && (
        <div className="nodrag absolute left-0 top-full z-30 mt-1 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {matches.map((role, i) => (
            <button
              key={role.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(role);
              }}
              className={`flex w-full items-center gap-2 px-2 py-1 text-left text-xs ${i === activeIndex ? "bg-slate-100" : ""}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
              {role.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
