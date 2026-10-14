import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}
export function date(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? 'Unknown date'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d);
}
export function bytes(value: number) {
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
export function tags(value: string) {
  return [
    ...new Set(
      value
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
}
