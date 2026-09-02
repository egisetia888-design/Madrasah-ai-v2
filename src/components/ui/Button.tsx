import * as React from "react"
import { cn } from "../../utils/cn"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "lg"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          {
            "bg-gray-900 text-gray-50 shadow-sm hover:bg-gray-800": variant === "default",
            "border border-gray-200 bg-transparent hover:bg-gray-50 text-gray-900": variant === "outline",
            "hover:bg-gray-50 hover:text-gray-900": variant === "ghost",
            "bg-gray-500 text-white shadow-sm hover:bg-gray-900": variant === "destructive",
            "h-11 md:h-9 px-4 py-2": size === "default",
            "h-9 md:h-8 rounded-xl px-3 text-xs md:text-sm": size === "sm",
            "h-12 md:h-10 rounded-xl px-8": size === "lg",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
export { Button }
