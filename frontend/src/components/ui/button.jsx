import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-xl text-base font-medium transition-all duration-250 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive min-h-[48px] px-8 py-4 shadow-md",
  {
    variants: {
      variant: {
        default:
          "bg-[#1a3aa3] text-white shadow-lg hover:bg-[#152e82] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(26,58,163,.35)]",
        destructive:
          "bg-red-600 text-white shadow-lg hover:bg-red-700 hover:shadow-xl focus-visible:ring-red-300",
        outline:
          "border-2 border-[#1a3aa3] bg-transparent text-[#1a3aa3] shadow-sm hover:bg-[#1a3aa3]/10 hover:shadow-md hover:-translate-y-0.5",
        secondary:
          "bg-[#b8942e] text-white shadow-lg hover:bg-[#9a7a24] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(184,148,46,.35)]",
        ghost:
          "hover:bg-[#f8fafc] hover:text-[#1a3aa3] dark:hover:bg-[#f8fafc]/50",
        link: "text-[#1a3aa3] underline-offset-4 hover:underline",
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