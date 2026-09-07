import { Skeleton } from "@/components/ui/skeleton"
import { RoundedList, RoundedListItem } from "@/components/ui/rounded-list"

export default function SignInLoading() {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col items-center gap-2 text-center">
        <Skeleton className="size-10 rounded-md" />
        <Skeleton className="h-8 w-48 mt-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      <RoundedList className="w-full">
        <RoundedListItem className="w-full p-0">
          <div className="flex w-full h-auto p-2 items-center">
            <Skeleton className="w-12 min-w-12 h-12 min-h-12 rounded-md group-first/row:rounded-tl-2xl group-last/row:rounded-bl-2xl mr-4" />
            <Skeleton className="h-5 w-36" />
          </div>
        </RoundedListItem>
        <RoundedListItem className="w-full p-0">
          <div className="flex w-full h-auto p-2 items-center">
            <Skeleton className="w-12 min-w-12 h-12 min-h-12 rounded-md group-first/row:rounded-tl-2xl group-last/row:rounded-bl-2xl mr-4" />
            <Skeleton className="h-5 w-40" />
          </div>
        </RoundedListItem>
      </RoundedList>

      <div className="flex flex-col gap-4 mt-2 items-center">
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  )
}
