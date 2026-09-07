"use client"

import * as React from "react"

import { NavMain } from "@/components/layout/nav-main"
import { NavProjects } from "@/components/layout/nav-projects"
import { NavSecondary } from "@/components/layout/nav-secondary"
import { NavUser } from "@/components/layout/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LifeBuoy,
  Users,
  CheckSquare,
  MessageSquareHeart,
} from "lucide-react"
import { VscGithubProject } from "react-icons/vsc"
import { FaWhatsapp } from "react-icons/fa"
import { TbSettings2 } from "react-icons/tb"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select"

import { useRouter } from "next/navigation"
import { PiSealWarningBold } from "react-icons/pi"
import { GeminiSVG } from "@/components/ui/gemini-svg"

const data = {
  navMain: [
    {
      title: "Task Board",
      url: "#",
      icon: <CheckSquare />,
      items: [
        {
          title: "Active Tasks",
          url: "#",
        },
        {
          title: "Auto Reminders",
          url: "#",
        },
        {
          title: "Assigned Members",
          url: "#",
        },
      ],
    },
    {
      title: "Directory",
      url: "#",
      icon: <Users />,
      items: [
        {
          title: "All Members",
          url: "#",
        },
        {
          title: "Roles & Capabilities",
          url: "#",
        },
        {
          title: "Invites & Access",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support",
      url: "#",
      icon: <LifeBuoy />,
    },
    {
      title: "Feedback",
      url: "#",
      icon: <MessageSquareHeart />,
    },
  ],
}

import { useAuth } from "@/hooks/use-auth"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  currentOrg?: {
    id: string
    name: string
    logo: string
    slug: string
    verified?: boolean
  }
  userOrgs?: Array<{
    id: string
    name: string
    logo: string
    slug: string
    verified?: boolean
  }>
  projects?: Array<{
    id: string
    name: string
    icon?: string
    iconUrl?: string
  }>
}

export function AppSidebar({ currentOrg, userOrgs = [], projects = [], ...props }: AppSidebarProps) {
  const router = useRouter()
  const { user } = useAuth()

  const activeOrgName = currentOrg?.name || "Select Org"

  const navUser = {
    name: user?.displayName || "User",
    email: user?.email || "",
    avatar: user?.photoURL || "",
  }

  const tenantNamespace = user?.email?.split('@')[1]?.toLowerCase()?.replace(/\./g, '-') || 'my-sliit-lk';
  const orgSlug = currentOrg?.slug || '';

  const navMainItems = React.useMemo(() => {
    const settingsBase = orgSlug ? `/org/${tenantNamespace}/${orgSlug}/settings` : "#"
    const projectsUrl = orgSlug ? `/org/${tenantNamespace}/${orgSlug}/projects` : "#"
    const directoryUrl = orgSlug ? `/org/${tenantNamespace}/${orgSlug}/directory` : "#"
    const whatsappUrl = orgSlug ? `/org/${tenantNamespace}/${orgSlug}/whatsapp` : "#"

    const mappedNavMain = data.navMain.map((item) => {
      if (item.title === "Task Board") {
        return {
          ...item,
          title: "Projects",
          icon: <VscGithubProject className="size-4 shrink-0" />,
          url: projectsUrl,
          items: [
            { title: "All Projects", url: `${projectsUrl}#all-projects` },
            { title: "New Project", url: orgSlug ? `/org/${tenantNamespace}/${orgSlug}/projects/new` : "#" },
            { title: "Configure manually", url: orgSlug ? `/org/${tenantNamespace}/${orgSlug}/projects/new?mode=manual` : "#" },
          ],
        }
      }
      if (item.title === "Directory") {
        return {
          ...item,
          url: directoryUrl,
          items: item.items?.map((subItem) => {
            if (subItem.title === "All Members") {
              return { ...subItem, url: directoryUrl }
            }
            return subItem
          }),
        }
      }
      return item
    })

    const projectsItem = mappedNavMain.find((item) => item.title === "Projects")
    const otherItems = mappedNavMain.filter((item) => item.title !== "Projects")

    return [
      {
        title: "Fello Agent",
        url: orgSlug ? `/org/${tenantNamespace}/${orgSlug}` : "#",
        icon: <GeminiSVG className="size-4 shrink-0 grayscale" />,
      },
      ...(projectsItem ? [projectsItem] : []),
      ...otherItems,
      {
        title: "WhatsApp",
        url: whatsappUrl,
        icon: <FaWhatsapp className="size-4 shrink-0" />,
      },
      {
        title: "Settings",
        url: settingsBase,
        icon: <TbSettings2 className="size-4 shrink-0" />,
        items: [
          { title: "Organization", url: `${settingsBase}#organization` },
          { title: "Google Workspace", url: `${settingsBase}#google-workspace` },
          { title: "WhatsApp", url: `${settingsBase}#whatsapp` },
          { title: "Danger Zone", url: `${settingsBase}#danger-zone` },
        ],
      },
    ]
  }, [tenantNamespace, orgSlug])

  const navProjects = React.useMemo(() => {
    return projects.map((project) => ({
      ...project,
      url: orgSlug ? `/org/${tenantNamespace}/${orgSlug}/projects/${project.id}` : "#",
    }))
  }, [projects, tenantNamespace, orgSlug])

  const renderLogo = (logoStr: string, nameStr: string) => {
    if (logoStr && (logoStr.startsWith("http://") || logoStr.startsWith("https://"))) {
      return <img src={logoStr} alt={nameStr} className="size-full object-contain p-1.5 !rounded-lg" />
    }
    return <div className="font-bold text-base uppercase">{nameStr.charAt(0)}</div>
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Select
              value={activeOrgName}
              onValueChange={(val) => {
                const selected = userOrgs.find(o => o.name === val);
                if (selected) {
                  const tenantNamespace = user?.email?.split('@')[1]?.toLowerCase()?.replace(/\./g, '-') || 'my-sliit-lk';
                  router.push(`/org/${tenantNamespace}/${selected.slug}`);
                }
              }}
            >
              <SelectTrigger className="w-full !h-auto !py-3 px-3 bg-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground border-0 shadow-none focus:ring-0 rounded-lg [&>svg]:size-4 [&>svg]:shrink-0">
                {currentOrg ? (
                  <div className="flex items-center gap-3 text-left w-full">
                    <div className="relative shrink-0">
                      <div className="size-10 flex items-center justify-center bg-slate-100 text-foreground !rounded-lg overflow-hidden">
                        {renderLogo(currentOrg.logo, currentOrg.name)}
                      </div>
                      {!currentOrg.verified && (
                        <PiSealWarningBold 
                          color="white"
                          style={{ color: 'white', fill: 'white' }}
                          className="absolute bottom-0 right-0 size-3 !text-white bg-yellow-500 rounded-full p-0.5 select-none shadow-sm" 
                          title="Unverified Workspace" 
                        />
                      )}
                    </div>
                    <div className="flex flex-col items-start flex-1 min-w-0">
                      <span className="font-medium text-sm leading-tight text-foreground truncate w-full">{currentOrg.name}</span>
                      <span className="text-xs text-muted-foreground leading-tight mt-0.5">Workspace</span>
                    </div>
                  </div>
                ) : (
                  <SelectValue placeholder="Select Org" />
                )}
                <span className="sr-only">
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {userOrgs.map((org) => (
                    <SelectItem
                      key={org.id}
                      value={org.name}
                      className="!py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="size-10 flex items-center justify-center bg-slate-100 text-foreground !rounded-lg overflow-hidden">
                            {renderLogo(org.logo, org.name)}
                          </div>
                          {!org.verified && (
                            <PiSealWarningBold 
                              color="white"
                              style={{ color: 'white', fill: 'white' }}
                              className="absolute bottom-0 right-0 size-3 !text-white bg-yellow-500 rounded-full p-0.5 select-none shadow-sm" 
                              title="Unverified Workspace" 
                            />
                          )}
                        </div>
                        <div className="flex flex-col items-start flex-1 text-left">
                          <span className="font-medium text-sm leading-tight">{org.name}</span>
                          <span className="text-xs text-muted-foreground leading-tight">Workspace</span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainItems} />
        <NavProjects projects={navProjects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
