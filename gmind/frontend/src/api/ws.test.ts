import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WSClient } from './ws'

class MockWebSocket {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSED = 3

  readyState: number
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []

  constructor(public url: string) {
    this.readyState = MockWebSocket.CONNECTING
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.onopen?.()
    }, 0)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    // NOTE: we do NOT call this.onclose here automatically —
    // real browser behaviour fires it async; our fix nulls it before close anyway.
  }
}

let mockWsInstance: MockWebSocket | null = null

vi.stubGlobal('WebSocket', class extends MockWebSocket {
  constructor(url: string) {
    super(url)
    mockWsInstance = this
  }
})

// Reset window.location for ws URL building
Object.defineProperty(window, 'location', {
  value: { protocol: 'http:', host: 'localhost' },
  writable: true,
})

describe('WSClient', () => {
  let client: WSClient

  beforeEach(() => {
    mockWsInstance = null
    vi.useFakeTimers()
    client = new WSClient()
  })

  it('registers and calls operation handlers', async () => {
    const handler = vi.fn()
    client.on('operation', handler)
    client.connect('wb1', 'user1')
    await vi.runAllTimersAsync()

    const msg = JSON.stringify({ type: 'operation', payload: { op: 'topic_created', data: {} } })
    mockWsInstance!.onmessage!({ data: msg })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('unsub removes handler', async () => {
    const handler = vi.fn()
    const unsub = client.on('operation', handler)
    unsub()

    client.connect('wb1', 'user1')
    await vi.runAllTimersAsync()

    const msg = JSON.stringify({ type: 'operation', payload: {} })
    mockWsInstance!.onmessage!({ data: msg })

    expect(handler).not.toHaveBeenCalled()
  })

  it('disconnect nulls onclose so scheduleReconnect is not triggered', async () => {
    client.connect('wb1', 'user1')
    await vi.runAllTimersAsync()

    const ws = mockWsInstance!
    client.disconnect()

    // After disconnect, onclose must be null
    expect(ws.onclose).toBeNull()
    expect(ws.onerror).toBeNull()
  })

  it('does NOT create a second connection after disconnect (regression: ghost session)', async () => {
    client.connect('wb1', 'user1')
    await vi.runAllTimersAsync()

    const firstWs = mockWsInstance

    // Simulate React cleanup: disconnect then reconnect (StrictMode pattern)
    client.disconnect()
    client.connect('wb1', 'user1')
    await vi.runAllTimersAsync()

    const secondWs = mockWsInstance

    // Advance past the 3s reconnect delay — should NOT create a third connection
    vi.advanceTimersByTime(5000)
    await vi.runAllTimersAsync()

    expect(mockWsInstance).toBe(secondWs)
    expect(mockWsInstance).not.toBe(firstWs)
  })

  it('reconnects automatically after unexpected close', async () => {
    client.connect('wb1', 'user1')
    await vi.runAllTimersAsync()

    const firstWs = mockWsInstance!
    // Simulate unexpected close (server dropped connection)
    firstWs.readyState = MockWebSocket.CLOSED
    firstWs.onclose!()

    vi.advanceTimersByTime(3001)
    await vi.runAllTimersAsync()

    expect(mockWsInstance).not.toBe(firstWs)
    expect(mockWsInstance!.readyState).toBe(MockWebSocket.OPEN)
  })

  it('connect is idempotent when already OPEN', async () => {
    client.connect('wb1', 'user1')
    await vi.runAllTimersAsync()
    const firstWs = mockWsInstance

    client.connect('wb1', 'user1')
    await vi.runAllTimersAsync()

    expect(mockWsInstance).toBe(firstWs)
  })

  it('sendOperation sends correct JSON', async () => {
    client.connect('wb1', 'user1')
    await vi.runAllTimersAsync()

    client.sendOperation('topic_created', { id: 'x', title: 'Test' })

    const parsed = JSON.parse(mockWsInstance!.sent.at(-1)!)
    expect(parsed.type).toBe('operation')
    expect(parsed.payload.op).toBe('topic_created')
    expect(parsed.payload.data.id).toBe('x')
  })
})
