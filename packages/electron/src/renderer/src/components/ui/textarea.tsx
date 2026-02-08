import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input/75 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/35 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-lg border bg-[color-mix(in_oklab,var(--surface)_78%,transparent)] px-3.5 py-2 text-base shadow-[inset_0_1px_0_hsl(0_0%_100%_/_0.03)] transition-[color,box-shadow,border-color,background-color] outline-none focus-visible:bg-[color-mix(in_oklab,var(--surface)_86%,transparent)] focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
