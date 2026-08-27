import { AppShell } from "@/components/shell/AppShell";

export default function ProviderLayout({ children }: LayoutProps<"/provider">) {
  return <AppShell area="provider">{children}</AppShell>;
}
