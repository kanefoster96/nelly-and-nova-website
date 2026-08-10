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

export const socialIcons = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
} as const;
