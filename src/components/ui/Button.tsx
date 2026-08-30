import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

import styles from "./Button.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "quiet"
  /** Collect Stamp before collection: solid Plum, `--action-collect`. */
  | "stamp"
  /** View Atlas Stamp after collection: the restrained Vermilion visited step. */
  | "collected";

function classNames(
  variant: ButtonVariant,
  fullWidth: boolean,
  compact: boolean,
  className?: string,
): string {
  return [
    styles.button,
    styles[variant],
    fullWidth ? styles.full : null,
    compact ? styles.compact : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly fullWidth?: boolean;
  readonly compact?: boolean;
  readonly children: ReactNode;
}

export function Button({
  variant = "primary",
  fullWidth = false,
  compact = false,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames(variant, fullWidth, compact, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  readonly href: string;
  readonly variant?: ButtonVariant;
  readonly fullWidth?: boolean;
  readonly compact?: boolean;
  readonly className?: string;
  readonly external?: boolean;
  readonly children: ReactNode;
  readonly onClick?: (() => void) | undefined;
}

export function ButtonLink({
  href,
  variant = "primary",
  fullWidth = false,
  compact = false,
  className,
  external = false,
  children,
  onClick,
}: ButtonLinkProps) {
  const composed = classNames(variant, fullWidth, compact, className);

  if (external) {
    return (
      <a
        className={composed}
        href={href}
        rel="noreferrer noopener"
        target="_blank"
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link className={composed} href={href} {...(onClick ? { onClick } : {})}>
      {children}
    </Link>
  );
}
