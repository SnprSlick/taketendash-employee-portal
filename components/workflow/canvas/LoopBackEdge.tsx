import { EdgeLabelRenderer, useReactFlow, type EdgeProps } from "@xyflow/react";
import { useState } from "react";
import type { FlowEdge } from "@/lib/workflow/flow/types";

export function LoopBackEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  label,
  data,
  selected,
}: EdgeProps<FlowEdge> & { data?: { onDelete?: (edgeId: string) => void; pickMode?: boolean } }) {
  const { getNode } = useReactFlow();
  const [hovered, setHovered] = useState(false);

  const sourceNode = getNode(source);
  const targetNode = getNode(target);
  const sourceWidth = (sourceNode?.measured?.width ?? sourceNode?.width ?? 180) as number;
  const targetWidth = (targetNode?.measured?.width ?? targetNode?.width ?? 180) as number;

  // Route out to the right of the source, down/up along the side, then into the right of the target.
  const bulge = Math.max(sourceWidth, targetWidth) / 2 + 60;
  const exitX = sourceX + bulge;
  const enterX = targetX + bulge;
  const railX = Math.max(exitX, enterX);

  // Step straight out from each node a few px in its handle's direction before
  // curving toward the rail, so the loop visibly separates from the node edge.
  const STUB = 10;
  const sourceStubY = sourceY + (sourceY >= targetY ? STUB : -STUB);
  const targetStubY = targetY + (targetY >= sourceY ? STUB : -STUB);

  const path = `M ${sourceX},${sourceY}
    L ${sourceX},${sourceStubY}
    C ${sourceX + bulge * 0.6},${sourceStubY} ${railX},${sourceStubY} ${railX},${sourceStubY}
    L ${railX},${targetStubY}
    C ${railX},${targetStubY} ${targetX + bulge * 0.6},${targetStubY} ${targetX},${targetStubY}
    L ${targetX},${targetY}`;

  const labelX = railX;
  const labelY = (sourceStubY + targetStubY) / 2;

  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <path
        d={path}
        fill="none"
        markerEnd={markerEnd}
        strokeDasharray="6 4"
        style={{
          ...style,
          stroke: style?.stroke ?? "#f97316",
          strokeWidth: style?.strokeWidth ?? (hovered || selected ? 2.5 : 1.5),
        }}
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
          <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 shadow-sm">
            ↺ {typeof label === "string" && label ? label : "loop back"}
          </span>
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
