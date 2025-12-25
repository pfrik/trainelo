import { Activity, Bike, Waves, Dumbbell, Trophy, Calendar, LucideIcon } from "lucide-react";

export type SportType = "Run" | "Bike" | "Swim" | "Strength" | "Triathlon" | "Other";

export interface SportConfig {
  icon: LucideIcon;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
}

export const sportConfigs: Record<SportType, SportConfig> = {
  Run: {
    icon: Activity,
    color: "#22c55e",
    bgClass: "bg-green-500",
    textClass: "text-green-600 dark:text-green-400",
    borderClass: "border-green-500",
    badgeClass: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500",
  },
  Bike: {
    icon: Bike,
    color: "#3b82f6",
    bgClass: "bg-blue-500",
    textClass: "text-blue-600 dark:text-blue-400",
    borderClass: "border-blue-500",
    badgeClass: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500",
  },
  Swim: {
    icon: Waves,
    color: "#06b6d4",
    bgClass: "bg-cyan-500",
    textClass: "text-cyan-600 dark:text-cyan-400",
    borderClass: "border-cyan-500",
    badgeClass: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500",
  },
  Strength: {
    icon: Dumbbell,
    color: "#f97316",
    bgClass: "bg-orange-500",
    textClass: "text-orange-600 dark:text-orange-400",
    borderClass: "border-orange-500",
    badgeClass: "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500",
  },
  Triathlon: {
    icon: Trophy,
    color: "#8b5cf6",
    bgClass: "bg-violet-500",
    textClass: "text-violet-600 dark:text-violet-400",
    borderClass: "border-violet-500",
    badgeClass: "bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500",
  },
  Other: {
    icon: Calendar,
    color: "#6b7280",
    bgClass: "bg-gray-500",
    textClass: "text-gray-600 dark:text-gray-400",
    borderClass: "border-gray-500",
    badgeClass: "bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500",
  },
};

export function getSportConfig(discipline: string): SportConfig {
  return sportConfigs[discipline as SportType] || sportConfigs.Other;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins}m`;
}
