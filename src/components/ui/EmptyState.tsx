import * as React from "react";
import { cn } from "../../utils/cn";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center border border-dashed border-gray-200 rounded-2xl bg-white/80 px-6",
        compact ? "py-10" : "py-16 sm:py-20",
        className
      )}
    >
      <div
        className={cn(
          "bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 border border-gray-100",
          compact ? "w-11 h-11 mb-3" : "w-14 h-14 mb-4"
        )}
      >
        <Icon className={compact ? "w-5 h-5" : "w-7 h-7"} />
      </div>
      <h3 className="text-base font-semibold text-gray-900 font-display">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-gray-500 mt-1.5 mb-5 max-w-sm leading-relaxed">
        {description}
      </p>
      {action && <div className="w-full sm:w-auto flex justify-center">{action}</div>}
    </div>
  );
}
