import { requireAdmin } from "@/lib/guards";
import { AppShell } from "@/components/shell/AppShell";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Guarding in the layout means every admin route is covered by one check.
  await requireAdmin();
  return <AppShell area="admin">{children}</AppShell>;
}
