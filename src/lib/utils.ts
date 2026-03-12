// lib/utils.ts
// ShadCN required cn() helper.
// Merges Tailwind class strings, resolving conflicts via tailwind-merge.

import { clsx, type ClassValue } from 'clsx'
import { twMerge }               from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}