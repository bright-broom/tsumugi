import { clsx } from 'clsx';
import type { ComponentPropsWithoutRef } from 'react';

type Variant = 'primary' | 'secondary';
const variants: Record<Variant, string> = { primary: 'btn-1', secondary: 'btn-2' };
export interface ActionAppearance {
  variant?: Variant;
  className?: string;
}

/** One visual contract; navigation remains a link and form submission remains a button. */
export function ActionLink({
  variant = 'primary',
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<'a'>, 'className' | 'href'> &
  ActionAppearance & { href: string }) {
  return <a className={clsx('btn', variants[variant], className)} {...props} />;
}

export function ActionButton({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: Omit<ComponentPropsWithoutRef<'button'>, 'className'> & ActionAppearance) {
  return <button className={clsx('btn', variants[variant], className)} type={type} {...props} />;
}
