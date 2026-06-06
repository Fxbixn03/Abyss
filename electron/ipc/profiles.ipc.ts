import { IpcChannel } from '@/shared/types/ipc'
import { exportBundle, applyBundle } from '@core/bundle'
import {
  listProfiles,
  saveProfile,
  readProfile,
  deleteProfile,
  renameProfile,
} from '@core/profiles'
import { handle } from './handle'
import type { IpcContext } from './context'

export function registerProfilesIpc(ctx: IpcContext): void {
  handle(IpcChannel.ProfileList, () => listProfiles())

  handle(
    IpcChannel.ProfileSave,
    async ({ name, agentIds, description, icon }) => {
      // Capture the current on-disk config as the profile's bundle.
      const bundle = await exportBundle(ctx.env, { agentIds })
      return saveProfile(name, bundle, { description, icon })
    },
  )

  handle(IpcChannel.ProfileRead, ({ id }) => readProfile(id))

  handle(IpcChannel.ProfileApply, async ({ id, agentIds, dryRun }) => {
    const profile = await readProfile(id)
    if (!profile) return []
    const bundle = agentIds
      ? {
          ...profile.bundle,
          agents: profile.bundle.agents.filter((a) =>
            agentIds.includes(a.agentId),
          ),
        }
      : profile.bundle
    return applyBundle(bundle, { dryRun })
  })

  handle(IpcChannel.ProfileRename, ({ id, name }) => renameProfile(id, name))

  handle(IpcChannel.ProfileDelete, async ({ id }) => ({
    success: await deleteProfile(id),
  }))
}
