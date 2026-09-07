import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type ButtonVariant = "dark" | "light" | "blue";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
};

const variantClass: Record<ButtonVariant, string> = {
  dark: "btn-dark",
  light: "btn-light",
  blue: "btn-blue"
};

export function Button({ className, variant = "dark", ...props }: ButtonProps) {
  return <button className={cn("btn", variantClass[variant], className)} {...props} />;
}

export function ButtonLink({ className, variant = "dark", ...props }: ButtonLinkProps) {
  return <a className={cn("btn", variantClass[variant], className)} {...props} />;
}
