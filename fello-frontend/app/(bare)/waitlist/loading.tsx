import { Skeleton } from "@/components/ui/skeleton"
import { RoundedList, RoundedListItem } from "@/components/ui/rounded-list"

export default function WaitlistLoading() {
  return (
    <div className="flex flex-col gap-10 items-center text-center w-full">
      <div className="flex items-center gap-3 bg-muted/50 p-2 pr-4 rounded-full border">
        <Skeleton className="size-10 rounded-full shrink-0" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="flex flex-col gap-3 w-full items-center">
        <Skeleton className="h-8 w-64" />
        <div className="flex flex-col items-center gap-2 mt-4 w-full">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="h-9 w-24 rounded-full mt-4" />
      </div>

      <div className="flex flex-col w-full gap-4 text-left">
        <div className="px-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64 mt-2" />
        </div>
        
        <RoundedList className="w-full">
          {[1, 2, 3, 4, 5].map((i) => (
            <RoundedListItem key={i} className="w-full p-0 border shadow-none">
              <div className="flex w-full h-auto p-3 items-center justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-8 h-8 rounded-md" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            </RoundedListItem>
          ))}
        </RoundedList>
      </div>

      <div className="flex flex-col w-full">
        <Skeleton className="w-full h-11 rounded-md" />
      </div>
    </div>
  )
}
