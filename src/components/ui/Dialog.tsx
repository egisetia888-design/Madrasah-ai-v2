import * as React from "react"
import { cn } from "../../utils/cn"
import { X } from "lucide-react"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  maxWidthClass?: string
}

export function Dialog({ open, onOpenChange, children, maxWidthClass = "max-w-lg" }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      <div 
        className="fixed inset-0 bg-black/45 backdrop-blur-[4px] transition-opacity duration-300"
        onClick={() => onOpenChange(false)}
      />
      <div className={cn(`relative z-[100] w-full bg-white rounded-2xl shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90dvh] overflow-hidden`, maxWidthClass)}>
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer z-[100]"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col space-y-1.5 p-5 sm:p-6 pb-4 border-b border-gray-100 shrink-0 pr-12", className)} {...props}>
      {children}
    </div>
  )
}

export function DialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-lg sm:text-xl font-bold font-display leading-none tracking-tight text-gray-900", className)} {...props}>
      {children}
    </h2>
  )
}

export function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 text-sm text-gray-600 leading-relaxed", className)} {...props}>
      {children}
    </div>
  )
}

export function DialogFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-5 sm:p-6 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl shrink-0 gap-2 sm:gap-0", className)} {...props}>
      {children}
    </div>
  )
}
