export const CHANNEL_CHARACTER_LIMITS = {
  linkedin: 3000,
  instagram: 2200,
  x: 280,
  facebook: 63206,
} as const;

export type ContentChannel = keyof typeof CHANNEL_CHARACTER_LIMITS;
