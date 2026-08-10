import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-wide " +
  "transition-transform transition-colors duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] " +
  "active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent " +
  "select-none";

const variants: Record<Variant, string> = {
  // Warm accent fill — primary call to action.
  primary:
    "bg-accent text-accent-ink hover:bg-accent-strong shadow-[0_6px_24px_-8px_rgba(232,177,90,0.7)]",
  // Outlined on dark.
  secondary:
    "border border-paper/30 text-paper hover:border-accent hover:text-accent bg-transparent",
  // Minimal text button.
  ghost: "text-paper/90 hover:text-accent bg-transparent",
};

// min-h/min-w 44px keeps every button a comfortable touch target.
const sizes: Record<Size, string> = {
  md: "min-h-[44px] px-5 text-sm",
  lg: "min-h-[52px] px-7 text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
};

type ButtonAsLink = CommonProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, "className"> & { href: string };

type ButtonAsButton = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, "className"> & { href?: undefined };

export type ButtonProps = ButtonAsLink | ButtonAsButton;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const classes = `${base} ${variants[variant]} ${sizes[size]} ${className}`;

  if ("href" in props && props.href !== undefined) {
    const { href, ...rest } = props;
    return (
      <Link href={href} className={classes} {...rest} />
    );
  }

  const { type, ...rest } = props as ButtonAsButton;
  return <button type={type ?? "button"} className={classes} {...rest} />;
}
