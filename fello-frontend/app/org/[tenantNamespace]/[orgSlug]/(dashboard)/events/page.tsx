import { redirect } from "next/navigation"

export default async function EventsPage({
  params,
}: {
  params: Promise<{ tenantNamespace: string; orgSlug: string }>
}) {
  const { tenantNamespace, orgSlug } = await params
  redirect(`/org/${tenantNamespace}/${orgSlug}/projects`)
}
