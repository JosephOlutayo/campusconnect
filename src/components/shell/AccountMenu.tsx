"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

type Props = {
  user: {
    id: string;
    name: string;
    email: string;
    avatarSeed: string;
    role: string;
    universityName: string | null;
    hasProviderProfile: boolean;
  };
  collapsed?: boolean;
};

export function AccountMenu({ user, collapsed = false }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const signOut = async () => {
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    // Refresh clears every server-component cache holding the old session.
    router.push("/");
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-2 text-left transition-colors hover:bg-surface-muted"
      >
        <Avatar seed={user.avatarSeed} name={user.name} size={collapsed ? "sm" : "md"} />
        {!collapsed ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
            <span className="block truncate text-xs text-ink-muted">
              {user.universityName ?? user.email}
            </span>
          </span>
        ) : null}
        {!collapsed ? <Icon name="chevronDown" size={16} className="text-ink-muted" /> : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 bottom-full z-50 mb-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface py-1.5 shadow-[var(--shadow-lift)]"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
          </div>
          <MenuLink href="/profile" icon="user" onClick={() => setOpen(false)}>
            Your profile
          </MenuLink>
          <MenuLink href="/appointments" icon="calendar" onClick={() => setOpen(false)}>
            Appointments
          </MenuLink>
          {user.hasProviderProfile ? (
            <MenuLink href="/provider" icon="briefcase" onClick={() => setOpen(false)}>
              Provider dashboard
            </MenuLink>
          ) : (
            <MenuLink href="/provider/onboarding" icon="sparkle" onClick={() => setOpen(false)}>
              Start offering services
            </MenuLink>
          )}
          {user.role === "ADMIN" ? (
            <MenuLink href="/admin" icon="shield" onClick={() => setOpen(false)}>
              Admin
            </MenuLink>
          ) : null}
          <MenuLink href="/settings" icon="settings" onClick={() => setOpen(false)}>
            Settings
          </MenuLink>
          <button
            onClick={signOut}
            disabled={signingOut}
            role="menuitem"
            className="flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
          >
            <Icon name="logout" size={18} />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: React.ComponentProps<typeof Icon>["name"];
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
    >
      <Icon name={icon} size={18} className="text-ink-muted" />
      {children}
    </Link>
  );
}
