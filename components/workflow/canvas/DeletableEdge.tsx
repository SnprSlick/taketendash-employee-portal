import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useState } from "react";
import type { FlowEdge } from "@/lib/workflow/flow/types";

export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  style,
  data,
  selected,
}: EdgeProps<FlowEdge> & { data?: { onDelete?: (edgeId: string) => void; pickMode?: boolean } }) {
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ ...style, strokeWidth: style?.strokeWidth ?? (hovered || selected ? 2.5 : 1.5) }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan flex items-center gap-1"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {typeof label === "string" && label && (
            <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 shadow-sm">
              {label}
            </span>
          )}
          {!data?.pickMode && (hovered || selected) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                data?.onDelete?.(id);
              }}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-slate-400 shadow-sm hover:bg-red-50 hover:text-red-500"
              title="Delete connection"
            >
              ✕
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
