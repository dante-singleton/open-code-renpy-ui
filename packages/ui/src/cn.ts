import clsx, { type ClassValue } from 'clsx';

/** Thin wrapper around clsx, mainly for the nicer import name. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
