import { Wordmark } from "./ui/Wordmark";
import { socialIcons, PhoneIcon, MailIcon } from "./ui/Icons";
import {
  footerLinks,
  socials,
  contact,
  site,
} from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-soft">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <Wordmark href="#top" height={38} />
            <p className="mt-4 max-w-xs text-sm text-paper-dim">
              {site.tagline}.
            </p>
            <div className="mt-5 flex gap-3">
              {socials.map((s) => {
                const Icon = socialIcons[s.icon];
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-white/15 text-paper transition-colors hover:text-accent hover:ring-accent/60"
                  >
                    <Icon width={20} height={20} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Quick links — appear as sections are built (config/site.ts) */}
          {footerLinks.length > 0 && (
            <nav aria-label="Footer">
              <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
                Explore
              </h2>
              <ul className="mt-4 space-y-1">
                {footerLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="inline-flex min-h-[40px] items-center text-sm text-paper/85 transition-colors hover:text-accent"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* Contact */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              Get in touch
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href={`tel:${contact.phone.replace(/\s+/g, "")}`}
                  className="inline-flex min-h-[40px] items-center gap-3 text-paper/85 transition-colors hover:text-accent"
                >
                  <PhoneIcon width={18} height={18} className="text-accent" />
                  {contact.phoneLabel}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex min-h-[40px] items-center gap-3 text-paper/85 transition-colors hover:text-accent"
                >
                  <MailIcon width={18} height={18} className="text-accent" />
                  {contact.email}
                </a>
              </li>
            </ul>
            <p className="mt-4 text-xs text-paper-dim">
              Contact details are placeholders — swap in config/site.ts.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-paper-dim sm:flex-row sm:items-center">
          <p>
            © {site.year} {site.name}.
          </p>
          <p>{site.tagline}.</p>
        </div>
      </div>
    </footer>
  );
}
