import Link from "next/link";
import { Wordmark } from "./ui/Wordmark";
import { socialIcons } from "./ui/Icons";
import { socials, site } from "@/config/site";
import { CookieSettingsButton } from "./CookieSettingsButton";

export function Footer() {
  return (
    <footer className="bg-ink-soft">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Wordmark href="/" height={36} />
            <p className="mt-4 max-w-xs text-sm text-paper-dim">
              {site.tagline}.
            </p>
          </div>

          <div className="flex gap-3">
            {socials.map((s) => {
              const Icon = socialIcons[s.icon];
              return (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-paper transition-colors hover:bg-white/10 hover:text-accent"
                >
                  <Icon width={20} height={20} />
                </a>
              );
            })}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 text-xs text-paper-dim sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {site.year} {site.name}.
          </p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Policies">
            <Link href="/terms" className="transition-colors hover:text-accent">
              Terms &amp; Conditions
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-accent">
              Privacy Policy
            </Link>
            <Link href="/cookies" className="transition-colors hover:text-accent">
              Cookie Policy
            </Link>
            <Link href="/community-guidelines" className="transition-colors hover:text-accent">
              Community Guidelines
            </Link>
            <CookieSettingsButton />
            <Link href="/holidays" className="transition-colors hover:text-accent">
              Holidays
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
