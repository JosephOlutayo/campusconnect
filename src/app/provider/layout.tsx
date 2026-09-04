import { getSessionUser } from "@/lib/api";
import { AppShell } from "@/components/shell/AppShell";

/**
 * Onboarding is intentionally NOT guarded here — a student with no provider
 * profile has to be able to reach it. Every other provider page calls
 * requireProvider() for itself.
 */
export default async function ProviderLayout({ children }: LayoutProps<"/provider">) {
  const user = await getSessionUser();
  return <AppShell area={user?.providerProfileId ? "provider" : "app"}>{children}</AppShell>;
}
