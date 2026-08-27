import { AppShell } from "@/components/shell/AppShell";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return <AppShell area="app">{children}</AppShell>;
}
