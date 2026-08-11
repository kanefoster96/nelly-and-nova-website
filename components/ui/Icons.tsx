import type { SVGProps } from "react";

/**
 * Inline, currentColor-driven icons. Decorative by default (aria-hidden);
 * pass a `title` / aria-label from the caller when an icon conveys meaning.
 */
type IconProps = SVGProps<SVGSVGElement>;

const iconBase = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export const MenuIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const PhoneIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export const MailIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <polyline points="22,7 12,13 2,7" />
  </svg>
);

export const FacebookIcon = (p: IconProps) => (
  <svg {...iconBase} fill="currentColor" stroke="none" {...p}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

export const InstagramIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

export const WhatsAppIcon = (p: IconProps) => (
  <svg {...iconBase} fill="currentColor" stroke="none" {...p}>
    <path d="M12.04 2A9.95 9.95 0 0 0 2.1 11.95a9.86 9.86 0 0 0 1.33 4.96L2 22l5.25-1.38a9.94 9.94 0 0 0 4.79 1.22h.004A9.95 9.95 0 0 0 22 11.96 9.95 9.95 0 0 0 12.04 2zm5.8 14.06c-.24.68-1.4 1.3-1.94 1.34-.5.06-1.13.08-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.8-4.17-4.94-4.36-.15-.19-1.19-1.58-1.19-3.01 0-1.43.75-2.13 1.01-2.42.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.82 2.01.89 2.16.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.29.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.69-.8.87-1.08.18-.28.36-.23.61-.14.25.1 1.6.75 1.87.89.28.14.46.21.53.32.07.12.07.66-.17 1.34z"/>
  </svg>
);

export const MessageIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export const CardIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
    <line x1="9" y1="6.5" x2="15" y2="6.5" />
    <line x1="9" y1="10" x2="15" y2="10" />
    <line x1="9" y1="13.5" x2="13" y2="13.5" />
  </svg>
);

export const InsuredIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <path d="M7 4c-1.5 3.5-1.5 8 0.5 12.5C8.7 19 10.3 20.5 12 21" />
    <path d="M17 4c1.5 3.5 1.5 8-0.5 12.5C15.3 19 13.7 20.5 12 21" />
    <path d="M9.5 11.5 11.5 13.5 15 9.5" />
  </svg>
);

export const CheckCircleIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M8 12.5 11 15.5 16.5 9" />
  </svg>
);

export const StarIcon = (p: IconProps) => (
  <svg {...iconBase} fill="currentColor" stroke="none" {...p}>
    <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47L2.6 9.9l6.5-.95L12 2.5z" />
  </svg>
);

export const PawIcon = (p: IconProps) => (
  <svg {...iconBase} fill="currentColor" stroke="none" {...p}>
    <circle cx="5.6" cy="11" r="2" />
    <circle cx="9.6" cy="7" r="2" />
    <circle cx="14.4" cy="7" r="2" />
    <circle cx="18.4" cy="11" r="2" />
    <path d="M12 11.2c3 0 5.3 2.3 5.3 4.9 0 2.2-2.1 3.5-5.3 3.5s-5.3-1.3-5.3-3.5c0-2.6 2.3-4.9 5.3-4.9z" />
  </svg>
);

export const HelpCircleIcon = (p: IconProps) => (
  <svg {...iconBase} {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.9-2.8 2.9" />
    <line x1="12" y1="17.4" x2="12.01" y2="17.4" />
  </svg>
);

export const socialIcons = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
} as const;

/** Icons used by the "We understand" pain-point cards. */
export const painIcons = {
  paw: PawIcon,
  help: HelpCircleIcon,
  cross: CloseIcon,
} as const;

export type PainIconName = keyof typeof painIcons;

export const benefitIcons = {
  message: MessageIcon,
  close: CloseIcon,
  card: CardIcon,
  insured: InsuredIcon,
  check: CheckCircleIcon,
} as const;

export type BenefitIconName = keyof typeof benefitIcons;
