import { IpcChannel } from '@/shared/types/ipc'
import { buildRelationGraph } from '@core/relations'
import { handle } from './handle'

/** The component-relation graph for one agent (Relations map page). */
export function registerRelationsIpc(): void {
  handle(IpcChannel.BuildRelationGraph, ({ agentId, basePath, projectDir }) =>
    buildRelationGraph(agentId, basePath, projectDir),
  )
}
