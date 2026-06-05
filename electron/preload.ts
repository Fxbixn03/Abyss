import { contextBridge, ipcRenderer } from 'electron'
import type {
  IpcChannel,
  IpcRequest,
  IpcResponse,
} from '@/shared/types/ipc'

/**
 * The ONLY thing exposed to the renderer: a single typed `invoke`. Renderer
 * code never sees raw `ipcRenderer`, keeping the contextIsolation boundary thin
 * and auditable.
 */
const bridge = {
  invoke: <C extends IpcChannel>(
    channel: C,
    payload: IpcRequest<C>,
  ): Promise<IpcResponse<C>> => ipcRenderer.invoke(channel, payload),
}

contextBridge.exposeInMainWorld('abyss', bridge)
