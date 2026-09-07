export default function Loading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-10 w-28 rounded bg-muted animate-pulse" />
      </div>

      <div className="p-6 flex-1 bg-muted/20">
        <div className="max-w-4xl mx-auto space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 w-full rounded-md border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
