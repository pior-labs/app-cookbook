import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Merges conditional class lists and lets a caller's utility win over a
// component's default rather than depending on stylesheet order.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
