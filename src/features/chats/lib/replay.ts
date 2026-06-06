/** Playback speeds cycled by the session-replay speed button. */
export const REPLAY_SPEEDS = [0.5, 1, 2, 4] as const

export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number]
