import { create } from 'zustand'
import type {
  DoctorAgentInput,
  DoctorFinding,
  DoctorReport,
} from '@/shared/types/doctor'
import { ipc } from '@/shared/ipc/ipc.client'
import { reportError } from '@/shared/lib/errors'

interface DoctorState {
  report: DoctorReport | null
  scanning: boolean
  /** Finding ids whose auto-fix is in flight. */
  fixing: Record<string, boolean>
  scan: (agents: DoctorAgentInput[]) => Promise<void>
  /** Apply a finding's fix, then re-scan so the report reflects reality. */
  fix: (finding: DoctorFinding, agents: DoctorAgentInput[]) => Promise<void>
}

export const useDoctorStore = create<DoctorState>()((set, get) => ({
  report: null,
  scanning: false,
  fixing: {},

  scan: async (agents) => {
    set({ scanning: true })
    try {
      const report = await ipc.doctorScan(agents)
      set({ report, scanning: false })
    } catch (err) {
      set({ scanning: false })
      reportError(err, { title: "Couldn't run the config doctor" })
    }
  },

  fix: async (finding, agents) => {
    if (!finding.fix) return
    set((s) => ({ fixing: { ...s.fixing, [finding.id]: true } }))
    try {
      const result = await ipc.doctorFix(finding.fix)
      if (!result.success) reportError(new Error(result.message))
      await get().scan(agents)
    } catch (err) {
      reportError(err, { title: "Couldn't apply the fix" })
    } finally {
      set((s) => {
        const fixing = { ...s.fixing }
        delete fixing[finding.id]
        return { fixing }
      })
    }
  },
}))
