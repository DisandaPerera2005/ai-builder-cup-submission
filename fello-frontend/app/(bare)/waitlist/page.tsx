import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getDomainWaitlistCount, getTopWaitlistDomains } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { UserProfile, WaitlistGreeting } from "./UserProfile"
import { ShareButton } from "./ShareButton"
import { RoundedList, RoundedListItem, RoundedListItemIcon } from "@/components/ui/rounded-list"

type WaitlistDomain = Awaited<ReturnType<typeof getTopWaitlistDomains>>[number] & {
  isUserOutsideTop?: boolean
}

export default async function WaitlistPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get("waitlist_domain")?.value

  // Cookie is the only way in — no URL param, no direct access
  if (!raw) redirect("/sign-in")

  const domain = decodeURIComponent(raw)

  const [count, topDomains] = await Promise.all([
    getDomainWaitlistCount(domain),
    getTopWaitlistDomains(),
  ])

  const isFirst = count <= 1
  const yourRank = topDomains.findIndex((d) => d.domain === domain) + 1
  
  const displayDomains: WaitlistDomain[] = [...topDomains]
  if (yourRank === 0 && count > 0) {
    displayDomains.push({ domain, count, isUserOutsideTop: true })
  }

  return (
    <div className="flex flex-col gap-10 items-center text-center max-w-md w-full">
      <UserProfile />

      <div className="flex flex-col gap-3 w-full">
        <WaitlistGreeting count={count} domain={domain} isFirst={isFirst} />
        <div className="text-sm text-muted-foreground space-y-4">
          <p>
            Invite your team to help move your domain up the leaderboard. The top 5 domains get the earliest access.
          </p>
          <div className="flex justify-center">
            <ShareButton domain={domain} />
          </div>
        </div>
      </div>

      <div className="flex flex-col w-full gap-4 text-left">
        <div className="px-2">
          <h2 className="font-semibold text-base">Top Requested Domains</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Updated in real time. The top 5 domains get the earliest access.
          </p>
        </div>
        
        <RoundedList className="w-full">
          {displayDomains.map((d, i) => {
            const isUser = d.domain === domain;
            return (
            <RoundedListItem 
              key={d.domain} 
              className={`w-full p-0 border shadow-none transition-colors ${isUser ? 'border-primary/50 bg-primary/5' : ''}`}
            >
              <div className="flex w-full h-auto p-3 items-center justify-between">
                <div className="flex items-center gap-4">
                  <RoundedListItemIcon 
                    className={`w-8 min-w-8 h-8 min-h-8 flex items-center justify-center font-bold text-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}
                  >
                    {d.isUserOutsideTop ? "-" : i + 1}
                  </RoundedListItemIcon>
                  <span className={`font-medium text-sm ${isUser ? "text-foreground font-bold" : ""}`}>
                    {d.domain}
                  </span>
                </div>
                <span className={`text-sm font-semibold pr-2 ${isUser ? 'text-primary' : ''}`}>
                  {d.count} <span className="text-muted-foreground font-normal text-xs ml-0.5">requests</span>
                </span>
              </div>
            </RoundedListItem>
          )})}
          {displayDomains.length === 0 && (
            <RoundedListItem className="w-full p-6 text-sm text-muted-foreground text-center border shadow-none">
              No requests yet — you could be first!
            </RoundedListItem>
          )}
        </RoundedList>
      </div>

      <div className="flex flex-col w-full">
        <Button variant="ghost" className="w-full h-11" asChild>
          <Link href="https://fello.live">Return to landing page</Link>
        </Button>
      </div>
    </div>
  )
}
