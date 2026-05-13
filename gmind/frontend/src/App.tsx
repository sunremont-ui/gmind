import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { LumenCommand, LumenZap, LumenSparkles, LumenUsers } from './components/UI/LumenIcon'
import { AnimatedMount } from './components/UI/AnimatedMount'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SaveStatusBar } from './components/SaveStatus/SaveStatusBar'
import { PWAInstallPrompt } from './components/PWA/PWAInstallPrompt'
import type { Command } from './components/CommandPalette/CommandPalette'

const MindMap = lazy(() => import('./components/MindMap/MindMap').then(m => ({ default: m.MindMap })))
const AIPanel = lazy(() => import('./components/AIPanel/AIPanel').then(m => ({ default: m.AIPanel })))
const AgentPanel = lazy(() => import('./components/AgentPanel/AgentPanel').then(m => ({ default: m.AgentPanel })))
const QuickCapture = lazy(() => import('./components/QuickCapture/QuickCapture').then(m => ({ default: m.QuickCapture })))
const CommandPalette = lazy(() => import('./components/CommandPalette/CommandPalette').then(m => ({ default: m.CommandPalette })))
import { api } from './api/client'
import { useMindMapStore } from './store/mindmap'
import { offlineStorage, offlineQueue } from './utils/offline'
import { ensureInboxWorkbook } from './utils/inbox'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { saveSession, loadSession, syncPendingOps } from './utils/sync'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, sizes, transitions, gradients } from './styles/tokens'
import { Text, Button } from './components/UI/Box'

export function App() {
  const [activeWorkbookId, setActiveWorkbookId] = useState<string | null>(null)
  const [showAIPanel, setShowAIPanel] = useState(false)
  const [showAgentPanel, setShowAgentPanel] = useState(false)
  const [showQuickCapture, setShowQuickCapture] = useState(false)
  const [quickCaptureText, setQuickCaptureText] = useState('')
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const setWorkbook = useMindMapStore(s => s.setWorkbook)
  const setActiveSheet = useMindMapStore(s => s.setActiveSheet)
  const { online, wasOffline, clearReconnectedFlag } = useOnlineStatus()
  const syncingRef = useRef(false)

  const updatePendingCount = useCallback(async () => {
    setPendingCount(await offlineQueue.count())
  }, [])

  // Hydrate session on cold start
  useEffect(() => {
    (async () => {
      try {
        const session = await loadSession()
        if (!navigator.onLine && session?.lastWorkbookId) {
          const cached = await offlineStorage.getWorkbook(session.lastWorkbookId)
          if (cached) {
            setWorkbook(cached)
            setActiveWorkbookId(session.lastWorkbookId)
            if (session.lastSheetId && cached.sheets.some(s => s.id === session.lastSheetId)) {
              setActiveSheet(session.lastSheetId)
            }
          }
        }
      } catch { /* ignore */ }
      ensureInboxWorkbook().catch(() => {})
    })()
  }, [setWorkbook, setActiveSheet])

  // Handle Web Share Target (shared text from other apps)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sharedText = params.get('text')
    if (sharedText) {
      setQuickCaptureText(sharedText)
      setShowQuickCapture(true)
      window.history.replaceState(null, '', '/')
    }
  }, [])

  // Poll pending count
  useEffect(() => {
    updatePendingCount()
    const interval = setInterval(updatePendingCount, 5000)
    return () => clearInterval(interval)
  }, [updatePendingCount])

  // Sync queue on reconnect
  useEffect(() => {
    if (wasOffline && online && !syncingRef.current) {
      syncingRef.current = true
      syncPendingOps().then(({ synced }) => {
        if (synced > 0 && activeWorkbookId) {
          api.getWorkbook(activeWorkbookId)
            .then(wb => {
              setWorkbook(wb)
              offlineStorage.saveWorkbook(wb)
            })
            .catch(() => {})
        }
      }).finally(() => {
        syncingRef.current = false
        clearReconnectedFlag()
        updatePendingCount()
      })
    }
  }, [wasOffline, online, activeWorkbookId, setWorkbook, clearReconnectedFlag, updatePendingCount])

  // Save session on workbook change
  useEffect(() => {
    if (activeWorkbookId) {
      saveSession({
        lastWorkbookId: activeWorkbookId,
        lastSheetId: useMindMapStore.getState().activeSheetId,
        lastZoom: 1,
        lastPanX: 0,
        lastPanY: 0,
        lastTheme: 'default',
      })
    }
  }, [activeWorkbookId])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.altKey) && e.code === 'Space') {
        e.preventDefault()
        setShowCommandPalette(s => !s)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault()
        setShowQuickCapture(s => !s)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const commands: Command[] = [
    { id: 'quick-capture', label: 'Quick capture', shortcut: 'Ctrl+Shift+I', icon: 'zap', section: 'General', action: () => setShowQuickCapture(true) },
    { id: 'ai-assistant', label: 'Toggle AI assistant', shortcut: '', icon: 'sparkles', section: 'Panels', action: () => setShowAIPanel(s => !s) },
    { id: 'agents', label: 'Toggle agents panel', shortcut: '', icon: 'users', section: 'Panels', action: () => setShowAgentPanel(s => !s) },
    { id: 'new-workbook', label: 'New workbook', shortcut: '', icon: 'plus', section: 'Workbook', action: async () => {
      const title = prompt('Workbook title:') || 'Untitled'
      try {
        const wb = await api.createWorkbook(title)
        setWorkbook(wb)
        setActiveWorkbookId(wb.id)
      } catch {}
    }},
  ]

  const handleSelectWorkbook = async (id: string) => {
    try {
      const wb = await api.getWorkbook(id)
      setWorkbook(wb)
      setActiveWorkbookId(id)
      offlineStorage.saveWorkbook(wb).catch(() => {})
    } catch {
      const cached = await offlineStorage.getWorkbook(id)
      if (cached) {
        setWorkbook(cached)
        setActiveWorkbookId(id)
      }
    }
  }

  const title = useMindMapStore(s => s.workbook?.title)

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: colors.bg, fontFamily: fonts.ui }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${spacing.xl}px`,
          height: sizes.headerHeight,
          background: `rgba(247, 247, 248, 0.88)`,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: `1px solid ${colors.separator}`,
          zIndex: 100,
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xl }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <img src="/lumen-logo.svg" alt="Lumen" width={24} height={24} style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 15,
              fontWeight: fontWeights.semibold,
              background: gradients.aurora,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: -0.3,
              fontFamily: fonts.ui,
            }}>
              Gmind
            </span>
            {!online && (
              <span style={{
                fontSize: fontSizes.caption,
                background: colors.orange + '18',
                color: colors.orange,
                padding: '1px 7px',
                borderRadius: radii.sm,
                fontWeight: fontWeights.semibold,
                fontFamily: fonts.mono,
                letterSpacing: '0.02em',
              }}>
                OFFLINE
              </span>
            )}
          </div>
          {activeWorkbookId && title && (
            <>
              <span style={{ color: colors.separatorThick, fontSize: fontSizes.body }}>·</span>
              <Text size={fontSizes.body} weight={fontWeights.medium} color={colors.textSecondary}>{title}</Text>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: spacing.xs, alignItems: 'center' }}>
          <Button variant="ghost" size="sm" icon onClick={() => setShowCommandPalette(true)} title="Commands (Ctrl+Alt+Space)">
            <LumenCommand size={15} strokeWidth={1.8} />
          </Button>
          <Button variant="ghost" size="sm" icon onClick={() => setShowQuickCapture(true)} title="Quick capture (Ctrl+Shift+I)">
            <LumenZap size={15} strokeWidth={1.8} />
          </Button>
          {activeWorkbookId && (
            <>
              <div style={{ width: 1, height: 18, background: colors.separator, margin: `0 ${spacing.xxs}px` }} />
              <Button
                variant={showAgentPanel ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setShowAgentPanel(p => !p)}
                style={{ gap: spacing.xs }}
              >
                <LumenUsers size={14} strokeWidth={1.8} />
                Agents
              </Button>
              <Button
                variant={showAIPanel ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setShowAIPanel(p => !p)}
                style={{ gap: spacing.xs }}
              >
                <LumenSparkles size={14} strokeWidth={1.8} />
                AI
              </Button>
            </>
          )}
        </div>
      </header>

      <Suspense fallback={null}>
        {showCommandPalette && (
          <CommandPalette
            commands={commands}
            onClose={() => setShowCommandPalette(false)}
          />
        )}
      </Suspense>
      <Suspense fallback={null}>
        {showQuickCapture && (
          <QuickCapture
            initialText={quickCaptureText}
            onClose={() => { setShowQuickCapture(false); setQuickCaptureText('') }}
            onCaptured={() => setQuickCaptureText('')}
          />
        )}
      </Suspense>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          activeWorkbookId={activeWorkbookId}
          onSelectWorkbook={handleSelectWorkbook}
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(s => !s)}
        />

        <div style={{ flex: 1, position: 'relative' }}>
          {activeWorkbookId ? (
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.textQuaternary, fontSize: fontSizes.body }}>
                Loading...
              </div>
            }>
              <MindMap workbookId={activeWorkbookId} onXMindImported={(id) => { api.getWorkbook(id).then(wb => { setWorkbook(wb); setActiveWorkbookId(id) }) }} />
            </Suspense>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: colors.textQuaternary,
                fontSize: fontSizes.bodyLarge,
              }}
            >
              Select or create a workbook to start
            </div>
          )}
        </div>

        <Suspense fallback={null}>
          <AnimatedMount show={showAgentPanel && !!activeWorkbookId} type="panel-right" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 50 }}>
            {showAgentPanel && activeWorkbookId && (
              <AgentPanel workbookId={activeWorkbookId} onClose={() => setShowAgentPanel(false)} />
            )}
          </AnimatedMount>
        </Suspense>
        <Suspense fallback={null}>
          <AnimatedMount show={showAIPanel && !!activeWorkbookId} type="panel-right" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 50 }}>
            {showAIPanel && activeWorkbookId && (
              <AIPanel workbookId={activeWorkbookId} onClose={() => setShowAIPanel(false)} />
            )}
          </AnimatedMount>
        </Suspense>
      </div>

      <SaveStatusBar pendingCount={pendingCount} />
      <PWAInstallPrompt />
    </div>
  )
}


