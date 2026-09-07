import * as React from "react"
import { cn } from "@/lib/utils"

const RoundedList = React.forwardRef<
  HTMLUListElement,
  React.HTMLAttributes<HTMLUListElement>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-col space-y-3 group", className)}
    {...props}
  />
))
RoundedList.displayName = "RoundedList"

const RoundedListItem = React.forwardRef<
  HTMLLIElement,
  React.HTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn(
      "group/row border p-2 rounded-md overflow-hidden first:rounded-t-3xl last:rounded-b-3xl bg-card text-card-foreground",
      className
    )}
    {...props}
  />
))
RoundedListItem.displayName = "RoundedListItem"

const RoundedListItemIcon = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-md overflow-hidden group-first/row:rounded-tl-2xl group-last/row:rounded-bl-2xl",
      className
    )}
    {...props}
  />
))
RoundedListItemIcon.displayName = "RoundedListItemIcon"

export { RoundedList, RoundedListItem, RoundedListItemIcon }
