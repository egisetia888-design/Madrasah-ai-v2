import * as React from "react";
import { cn } from "../../utils/cn";

type MetadataItem = React.ReactNode | string | number | false | null | undefined;

interface MetadataRowProps {
  items: MetadataItem[];
  className?: string;
}

export function MetadataRow({ items, className }: MetadataRowProps) {
  const validItems = items.filter(
    (item): item is React.ReactNode | string | number =>
      item !== null && item !== undefined && item !== false && item !== ""
  );

  if (validItems.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-gray-500 font-mono tabular-nums",
        className
      )}
    >
      {validItems.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && (
            <span aria-hidden="true" className="text-gray-300 select-none">
              ·
            </span>
          )}
          <span className="inline-flex items-center gap-1 min-w-0">{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
