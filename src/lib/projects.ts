// Shared by server pages and client components (no "use client" here, so
// server components can call these).
export const PROJECT_STAGES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "off_plan", label: "Off-plan" },
  { value: "under_construction", label: "Under construction" },
  { value: "completed", label: "Completed" },
];

const PHOTO_TYPES = ["image", "photo"];

export function isPhoto(item: { media_type: string }) {
  return PHOTO_TYPES.includes(item.media_type) || item.media_type.startsWith("image/");
}
