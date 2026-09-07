"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"
import { ArrowRightIcon, BuildingIcon, SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"

export default function JoinOrgPage() {
  const router = useRouter()
  const [search, setSearch] = React.useState("")

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    // Mock sending request
    alert("Request sent to " + search)
    router.push("/")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground mb-2">
          <BuildingIcon className="size-6" />
        </div>
        <h1 className="text-2xl font-bold">Join an Organization</h1>
        <p className="text-sm text-muted-foreground">
          Search for your organization or student body to request access.
        </p>
      </div>

      <form onSubmit={handleJoin}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="org-search">Organization Name</FieldLabel>
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="org-search"
                type="search"
                placeholder="e.g. FOSS SLIIT"
                required
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </Field>
          
          <Button type="submit" className="w-full mt-4">
            Request to Join
            <ArrowRightIcon className="ml-2 size-4" />
          </Button>
          
          <Button variant="ghost" type="button" onClick={() => router.push("/")} className="w-full mt-2">
            Back
          </Button>
        </FieldGroup>
      </form>
    </div>
  )
}
