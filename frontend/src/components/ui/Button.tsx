import type { ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";

import {
  buttonStyles,
  type ButtonSize,
  type ButtonVariant,
} from "./button-styles";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles(variant, size, className)}
      {...props}
    />
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonStyles(variant, size, className)} {...props} />;
}
