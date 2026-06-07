import { create } from 'zustand'
import { TOUR_STEPS } from '../tour.steps'

interface TourState {
  /** Whether the tour overlay is currently showing. */
  active: boolean
  /** Index into {@link TOUR_STEPS}. */
  stepIndex: number

  start: () => void
  next: () => void
  prev: () => void
  stop: () => void
}

/**
 * UI-only state for the guided tour. Persistence (the "seen it" flag) lives in
 * app settings and is handled by the overlay — this store just drives the
 * current step.
 */
export const useTourStore = create<TourState>()((set, get) => ({
  active: false,
  stepIndex: 0,

  start: () => set({ active: true, stepIndex: 0 }),
  next: () => {
    const last = TOUR_STEPS.length - 1
    const { stepIndex } = get()
    if (stepIndex >= last) set({ active: false, stepIndex: 0 })
    else set({ stepIndex: stepIndex + 1 })
  },
  prev: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),
  stop: () => set({ active: false, stepIndex: 0 }),
}))
