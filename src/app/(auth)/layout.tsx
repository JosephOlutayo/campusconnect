import Link from "next/link";

import { APP_NAME } from "@/lib/constants";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col lg:p-5">
      <div className="app-shell mx-auto flex w-full max-w-[1200px] flex-1 overflow-hidden lg:rounded-[2rem]">
        {/* Left: the pitch. Hidden on phones where the form is the whole point. */}
        <aside className="relative hidden w-[46%] shrink-0 flex-col justify-between bg-feature p-10 text-white lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -left-16 size-80 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle,#7c7cf0,transparent 70%)" }}
          />
          <Link href="/" className="relative flex items-center gap-3">
            <span
              className="grid size-9 place-items-center rounded-xl text-sm font-black"
              style={{ backgroundImage: "linear-gradient(135deg,#6366f1,#4338ca)" }}
            >
              C
            </span>
            <span className="text-[15px] font-bold tracking-tight">{APP_NAME}</span>
          </Link>

          <div className="relative">
            <h2 className="text-[2.5rem] leading-[1.05] font-bold tracking-tight">
              Find someone on campus who can do it.
            </h2>
            <p className="mt-4 max-w-sm text-[15px] text-white/60">
              Barbers, braiders, nail techs, tutors, photographers and trainers — all students and
              local pros near your campus, bookable in about thirty seconds.
            </p>

            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
              <div>
                <dt className="text-xs text-white/50">Providers</dt>
                <dd className="text-xl font-bold">20+</dd>
              </div>
              <div>
                <dt className="text-xs text-white/50">Categories</dt>
                <dd className="text-xl font-bold">16</dd>
              </div>
              <div>
                <dt className="text-xs text-white/50">Campuses</dt>
                <dd className="text-xl font-bold">6</dd>
              </div>
            </dl>
          </div>

          <p className="relative text-xs text-white/40">
            By continuing you agree to our{" "}
            <Link href="/legal/terms" className="underline">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline">
              privacy policy
            </Link>
            .
          </p>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col justify-center px-5 py-10 sm:px-10">
          <div className="mx-auto w-full max-w-sm">
            <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
              <span
                className="grid size-9 place-items-center rounded-xl text-sm font-black text-white"
                style={{ backgroundImage: "linear-gradient(135deg,#6366f1,#4338ca)" }}
              >
                C
              </span>
              <span className="text-[15px] font-bold tracking-tight">{APP_NAME}</span>
            </Link>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
