import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-xl text-base font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive min-h-[48px] px-8 py-4 shadow-md",
  {
    variants: {
      variant: {
        default:
          "bg-[#2563eb] text-white shadow-lg hover:bg-[#1e3a8a] hover:shadow-xl",
        destructive:
          "bg-red-600 text-white shadow-lg hover:bg-red-700 hover:shadow-xl focus-visible:ring-red-300",
        outline:
          "border-2 border-[#2563eb] bg-transparent text-[#2563eb] shadow-sm hover:bg-[#2563eb]/10 hover:shadow-md",
        secondary:
          "bg-[#0891b2] text-white shadow-lg hover:bg-[#0e7490] hover:shadow-xl",
        ghost:
          "hover:bg-[#f8fafc] hover:text-[#1e3a8a] dark:hover:bg-[#f8fafc]/50",
        link: "text-[#2563eb] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} />
  );
}

export { Button, buttonVariants }