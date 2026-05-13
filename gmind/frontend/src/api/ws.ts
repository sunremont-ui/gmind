import type { WSMessage } from '../types'

type MessageHandler = (msg: WSMessage) => void

export class WSClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<MessageHandler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private workbookId: string | null = null
  private userId: string | null = null
  private userName: string = ''
  private userColor: string = ''

  connect(workbookId: string, userId: string, userName?: string, userColor?: string) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    this.workbookId = workbookId
    this.userId = userId
    this.userName = userName || ''
    this.userColor = userColor || '#5B6CFF'
    this.doConnect()
  }

  private doConnect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    this.ws = new WebSocket(`${protocol}//${host}/ws`)

    this.ws.onopen = () => {
      this.send({
        type: 'join',
        payload: {
          workbook_id: this.workbookId,
          user_id: this.userId,
          user_name: this.userName,
          user_color: this.userColor,
        },
      })
    }

    this.ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        const typeHandlers = this.handlers.get(msg.type)
        if (typeHandlers) {
          typeHandlers.forEach(h => h(msg))
        }
        const allHandlers = this.handlers.get('*')
        if (allHandlers) {
          allHandlers.forEach(h => h(msg))
        }
      } catch { /* ignore parse errors */ }
    }

    this.ws.onclose = () => {
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      // onerror is followed by onclose
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.workbookId && this.userId) {
        this.doConnect()
      }
    }, 3000)
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close()
      }
    }
    this.ws = null
  }

  send(msg: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  sendCursor(x: number, y: number) {
    this.send({
      type: 'cursor',
      payload: {
        user_id: this.userId,
        user_name: this.userName,
        user_color: this.userColor,
        x,
        y,
      },
    })
  }

  sendOperation(op: string, data: unknown) {
    this.send({
      type: 'operation',
      payload: { op, data },
    })
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }
}

export const wsClient = new WSClient()
