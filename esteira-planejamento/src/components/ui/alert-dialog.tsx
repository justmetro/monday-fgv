import * as React from "react"
import { AlertDialog as P } from "radix-ui"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const AlertDialog = P.Root
const AlertDialogTrigger = P.Trigger
const AlertDialogPortal = P.Portal

function AlertDialogOverlay({ className, ...props }: React.ComponentProps<typeof P.Overlay>) {
  return <P.Overlay className={cn("fixed inset-0 z-50 bg-black/50", className)} {...props} />
}
function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <P.Content className={cn("fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 shadow-lg sm:max-w-lg", className)} {...props} />
    </AlertDialogPortal>
  )
}
const AlertDialogHeader = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("flex flex-col gap-2 text-center sm:text-left", className)} {...props} />
const AlertDialogFooter = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
const AlertDialogTitle = ({ className, ...props }: React.ComponentProps<typeof P.Title>) => <P.Title className={cn("text-lg font-semibold", className)} {...props} />
const AlertDialogDescription = ({ className, ...props }: React.ComponentProps<typeof P.Description>) => <P.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
const AlertDialogAction = ({ className, ...props }: React.ComponentProps<typeof P.Action>) => <P.Action className={cn(buttonVariants(), className)} {...props} />
const AlertDialogCancel = ({ className, ...props }: React.ComponentProps<typeof P.Cancel>) => <P.Cancel className={cn(buttonVariants({ variant: "outline" }), className)} {...props} />

export { AlertDialog, AlertDialogTrigger, AlertDialogPortal, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel }
