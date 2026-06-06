import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  IpcChannel,
  IpcEvent,
  IpcEventMap,
  IpcRequest,
  IpcResponse,
} from '@/shared/types/ipc'

/**
 * The only things exposed to the renderer: a typed request/response `invoke`
 * and a typed push subscription `on`. Renderer code never sees raw
 * `ipcRenderer`, keeping the contextIsolation boundary thin and auditable.
 */
const bridge = {
  invoke: <C extends IpcChannel>(
    channel: C,
    payload: IpcRequest<C>,
  ): Promise<IpcResponse<C>> => ipcRenderer.invoke(channel, payload),

  on: <E extends IpcEvent>(
    event: E,
    handler: (payload: IpcEventMap[E]) => void,
  ): (() => void) => {
    const listener = (_e: IpcRendererEvent, payload: IpcEventMap[E]) =>
      handler(payload)
    ipcRenderer.on(event, listener)
    return () => ipcRenderer.removeListener(event, listener)
  },
}

contextBridge.exposeInMainWorld('abyss', bridge)
