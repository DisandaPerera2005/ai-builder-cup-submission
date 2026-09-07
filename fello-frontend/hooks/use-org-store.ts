import { create } from "zustand"

/**
 * Shares the resolved current org (internal UUID + display fields) from the org
 * layout down to pages like the dashboard chat, so the chat can tell the agent
 * route which org it's operating in. The internal `id` is the value the agent
 * binds its tenant scope from server-side.
 */
export interface ActiveOrg {
  id: string // internal org UUID (e.g. "org_8f3k2a9x")
  name: string
  slug: string
  tenantNamespace: string
}

interface OrgStore {
  activeOrg: ActiveOrg | null
  setActiveOrg: (org: ActiveOrg | null) => void
}

export const useOrgStore = create<OrgStore>((set) => ({
  activeOrg: null,
  setActiveOrg: (activeOrg) => set({ activeOrg }),
}))
