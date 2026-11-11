// Shared with restore validation so stored poses obey the live scene limits.
export const MIN_CAMERA_DISTANCE = 4;
export const MAX_CAMERA_DISTANCE = 90;
export const CAMERA_TARGET_BOUNDS = [[-32, 32], [-12, 12], [-12, 12]] as const;
export const STAR_OFFSET_LIMITS = [2.6, 2.4] as const;
