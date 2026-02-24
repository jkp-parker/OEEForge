import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function oeeColor(value: number | null | undefined): string {
  if (value == null) return "text-muted-foreground";
  if (value >= 0.85) return "text-green-600";
  if (value >= 0.60) return "text-yellow-600";
  return "text-red-600";
}
