import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/shell/PageHeader";

/**
 * Placeholder policy text. These are honest drafts describing how the product
 * actually behaves — they are NOT legal advice and must be reviewed by a lawyer
 * before the platform takes real money from real students.
 */
const DOCS = {
  terms: {
    title: "Terms of service",
    updated: "Draft — not yet reviewed by counsel",
    sections: [
      {
        heading: "What CampusConnect is",
        body: `${APP_NAME} is a marketplace. We connect students who need a service with students and local providers who offer one. We are not the provider. We do not employ providers, supervise their work, or guarantee any particular result.`,
      },
      {
        heading: "Accounts",
        body: "You must be 18 or older, or have your guardian's permission, to create an account. You are responsible for what happens under your account. One person, one account. Providing false information — including impersonating a student at a campus you do not attend — is grounds for removal.",
      },
      {
        heading: "Bookings and cancellations",
        body: "A booking is an agreement between you and the provider. Each provider sets their own cancellation policy, shown before you confirm. Repeatedly cancelling late or failing to show up may result in restrictions on your account.",
      },
      {
        heading: "Payments and fees",
        body: "The platform charges providers a marketplace fee on each completed booking. The exact percentage is shown to providers before they list and on every booking summary. Prices displayed to students always include what they will pay.",
      },
      {
        heading: "Prohibited services",
        body: "No services that require a licence the provider does not hold, nothing illegal, nothing sexual, and no medical or cosmetic procedures beyond what local regulation allows for the provider's certification. We remove listings and accounts that break this.",
      },
      {
        heading: "Meeting in person",
        body: "Services involve meeting real people, often in private spaces. You are responsible for your own safety. We give you tools — verification, reviews, in-app messaging, reporting and blocking — but we cannot supervise a meeting.",
      },
      {
        heading: "Termination",
        body: "We may suspend or remove any account that breaks these terms, and you can stop using the platform at any time.",
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    updated: "Draft — not yet reviewed by counsel",
    sections: [
      {
        heading: "What we collect",
        body: "Your name, email, university, and anything you add to your profile. For providers: business details, service listings, availability and payout information. We record bookings, messages sent through the app, and reviews.",
      },
      {
        heading: "What we show other people",
        body: "Your name, avatar, campus and verification badges are visible to providers you book. Providers' approximate location is public; their exact address is only released to a customer after a booking is confirmed. Phone numbers are never displayed to other users.",
      },
      {
        heading: "Messages",
        body: "Messages sent in the app are stored so both sides have a record and so we can investigate reports. Do not send anything you would not want a moderator to read during a dispute.",
      },
      {
        heading: "Payments",
        body: "When real payments are enabled, card details are handled by Stripe and never touch our servers. We store only the amount, the fee split and Stripe's reference id.",
      },
      {
        heading: "Your choices",
        body: "You can edit or delete your profile information at any time, block other users, and request deletion of your account. Deleting an account removes your profile; bookings and payment records are retained where we are required to keep them.",
      },
      {
        heading: "Contact",
        body: "Questions about your data go to privacy@campusconnect.app.",
      },
    ],
  },
  guidelines: {
    title: "Community guidelines",
    updated: "Draft — not yet reviewed by counsel",
    sections: [
      {
        heading: "Show up",
        body: "If you book, be there. If you cannot make it, cancel as early as you can. A late cancellation costs a student provider real money — often an hour they turned someone else away for.",
      },
      {
        heading: "Be honest in listings",
        body: "Portfolio photos must be your own work. Prices shown must be the prices you charge. If a service usually runs long, say so in the description rather than surprising someone mid-appointment.",
      },
      {
        heading: "Reviews are earned",
        body: "You can only review a provider after completing an appointment with them. Do not trade reviews, ask for a specific rating, or offer a discount in exchange for five stars. We remove reviews that break this, and repeated attempts cost you your account.",
      },
      {
        heading: "Keep it in the app",
        body: "Message through CampusConnect. If something goes wrong, that record is what lets us help. Moving to text or cash off-platform means we cannot see what was agreed.",
      },
      {
        heading: "Safety first",
        body: "Meet somewhere you are comfortable. Tell a friend where you are going. If a provider or customer makes you feel unsafe, block them and report — you never owe anyone an explanation for leaving.",
      },
      {
        heading: "No harassment, no discrimination",
        body: "Refusing service based on race, gender, religion, disability, sexuality or nationality is not allowed here. Neither is harassment of any kind. This is the one rule where the first strike can be the last.",
      },
    ],
  },
} as const;

type DocKey = keyof typeof DOCS;

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  const entry = DOCS[doc as DocKey];
  return { title: entry?.title ?? "Not found" };
}

export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  const entry = DOCS[doc as DocKey];
  if (!entry) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={entry.updated} title={entry.title} />

      <div className="card space-y-6 p-6">
        {entry.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-base font-semibold text-ink">{section.heading}</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{section.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-5 rounded-2xl bg-warning-soft px-4 py-3 text-xs text-warning">
        These documents are working drafts written to match how the product behaves today. Have a
        lawyer review them before {APP_NAME} handles real payments or launches publicly.
      </p>
    </div>
  );
}
