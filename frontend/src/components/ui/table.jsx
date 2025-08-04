import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto rounded-xl border border-[#e2e8f0] shadow-md">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-base min-w-[800px]", className)}
      {...props}
    />
  </div>
))

const TableHeader = React.forwardRef(({ className, ...props }, ref) => (
  <thead className={cn("[&_tr]:border-b [&_tr]:border-[#e2e8f0] bg-[#f8fafc]", className)} {...props} ref={ref} />
))

function TableBody({
  className,
  ...props
}) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props} />
  );
}

function TableFooter({
  className,
  ...props
}) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("bg-muted/50 border-t font-medium [&>tr]:last:border-b-0", className)}
      {...props} />
  );
}

const TableRow = React.forwardRef(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-[#e2e8f0] transition-colors hover:bg-[#60a5fa]/10 min-h-[56px] data-[state=selected]:bg-[#f8fafc]",
      className
    )}
    {...props}
  />
))

function TableHead({
  className,
  ...props
}) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props} />
  );
}

const TableCell = React.forwardRef(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("px-6 py-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))

const TableCaption = React.forwardRef(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-base text-[#6b7280]", className)}
    {...props}
  />
))

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}