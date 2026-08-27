import { redirect } from "next/navigation";

/**
 * Provider notifications deep-link here, but the appointment detail screen
 * already renders the provider view when the viewer is the provider — so this
 * is a redirect rather than a second copy of the same page.
 */
export default async function ProviderBookingRedirect({
  params,
}: PageProps<"/provider/bookings/[id]">) {
  const { id } = await params;
  redirect(`/appointments/${id}`);
}
