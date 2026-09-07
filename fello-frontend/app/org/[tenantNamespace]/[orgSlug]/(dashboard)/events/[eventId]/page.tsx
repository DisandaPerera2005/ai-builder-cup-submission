import { redirect } from "next/navigation"

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ tenantNamespace: string; orgSlug: string; eventId: string }>
}) {
  const { tenantNamespace, orgSlug, eventId } = await params
  redirect(`/org/${tenantNamespace}/${orgSlug}/projects/${eventId}`)
}
