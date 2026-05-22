import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { LumenCommand, LumenZap } from './components/UI/LumenIcon'
import { AnimatedMount } from './components/UI/AnimatedMount'
import { Sidebar } from './components/Sidebar/Sidebar'
import { SaveStatusBar } from './components/SaveStatus/SaveStatusBar'
import { PWAInstallPrompt } from './components/PWA/PWAInstallPrompt'
import { SettingsModal } from './components/Settings/SettingsModal'
import { NavRail } from './components/NavRail/NavRail'
import type { Command } from './components/CommandPalette/CommandPalette'
import { MODULE_REGISTRY, getModule } from './modules/registry'
import { useShellStore } from './store/shell'

const MindMap = lazy(() => import('./components/MindMap/MindMap').then(m => ({ default: m.MindMap })))
const QuickCapture = lazy(() => import('./components/QuickCapture/QuickCapture').then(m => ({ default: m.QuickCapture })))
const CommandPalette = lazy(() => import('./components/CommandPalette/CommandPalette').then(m => ({ default: m.CommandPalette })))
import { api } from './api/client'
import { secrets } from './api/secrets'
import { useAgentStore } from './store/agent'
import { useMindMapStore } from './store/mindmap'
import { offlineStorage, offlineQueue } from './utils/offline'
import { ensureInboxWorkbook } from './utils/inbox'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { saveSession, loadSession, syncPendingOps } from './utils/sync'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, sizes, transitions, gradients } from './styles/tokens'
import { Text, Button } from './components/UI/Box'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

function SplashScreen() {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: colors.bg, gap: spacing.lg,
    }}>
      <img src="/lumen-logo.svg" alt="Gmind" width={48} height={48} style={{ opacity: 0.9 }} />
      <span style={{
        fontSize: fontSizes.title,
        fontWeight: fontWeights.semibold,
        background: gradients.aurora,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        fontFamily: fonts.ui,
        letterSpacing: -0.5,
      }}>
        Gmind
      </span>
      <span style={{ fontSize: fontSizes.body, color: colors.textQuaternary, fontFamily: fonts.ui }}>
        Starting…
      </span>
    </div>
  )
}

export function App() {
  const [backendReady, setBackendReady] = useState(!isTauri)
  const [startupError, setStartupError] = useState(false)
  const pollCancelRef = useRef<boolean>(false)

  const [activeWorkbookId, setActiveWorkbookId] = useState<string | null>(null)
  const [showQuickCapture, setShowQuickCapture] = useState(false)
  const [quickCaptureText, setQuickCaptureText] = useState('')
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  const setWorkbook = useMindMapStore(s => s.setWorkbook)
  const fetchAgents = useAgentStore(s => s.fetchAgents)
  const setActiveSheet = useMindMapStore(s => s.setActiveSheet)
  const { online, wasOffline, clearReconnectedFlag } = useOnlineStatus()
  const syncingRef = useRef(false)

  const activeModuleId = useShellStore(s => s.activeModuleId)
  const toggleModule = useShellStore(s => s.toggleModule)
  const closeModule = useShellStore(s => s.closeModule)

  const startBackendPoll = useCallback(() => {
    if (!isTauri) return
    pollCancelRef.current = false
    setStartupError(false)
    const deadline = Date.now() + 60_000
    const poll = async () => {
      while (!pollCancelRef.current) {
        if (Date.now() > deadline) { setStartupError(true); return }
        try {
          const r = await fetch('http://localhost:1010/health')
          if (r.ok) { setBackendReady(true); return }
        } catch { /* connection refused — server not up yet */ }
        await new Promise(res => setTimeout(res, 500))
      }
    }
    poll()
  }, [])

  useEffect(() => {
    startBackendPoll()
    return () => { pollCancelRef.current = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updatePendingCount = useCallback(async () => {
    setPendingCount(await offlineQueue.count())
  }, [])

  useEffect(() => {
    if (!backendReady) return
    ;(async () => {
      const [openai, yandex] = await Promise.all([
        secrets.loadOpenAIConfig(),
        secrets.loadYandexConfig(),
      ])
      const cfg: Record<string, string> = {}
      if (openai?.apiKey) {
        cfg.openai_api_key = openai.apiKey
        if (openai.endpoint) cfg.openai_endpoint = openai.endpoint
        if (openai.model) cfg.openai_model = openai.model
      }
      if (yandex?.apiKey) {
        cfg.yandex_api_key = yandex.apiKey
        if (yandex.folderId) cfg.yandex_folder_id = yandex.folderId
        if (yandex.model) cfg.yandex_model = yandex.model
      }
      if (Object.keys(cfg).length > 0) {
        try { await api.applyConfig(cfg) } catch { /* ignore */ }
      }
    })()
  }, [backendReady])

  useEffect(() => {
    if (!backendReady) return
    fetchAgents().catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendReady])

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sharedText = params.get('text')
    if (sharedText) {
      setQuickCaptureText(sharedText)
      setShowQuickCapture(true)
      window.history.replaceState(null, '', '/')
    }
  }, [])

  useEffect(() => {
    updatePendingCount()
    const interval = setInterval(updatePendingCount, 5000)
    return () => clearInterval(interval)
  }, [updatePendingCount])

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
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === 'Space') {
        e.preventDefault()
        setShowCommandPalette(s => !s)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault()
        setShowQuickCapture(s => !s)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('gmind:focus-note-input'))
        toggleModule('notes')
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleModule])

  const moduleContext = {
    workbookId: activeWorkbookId,
    activeSheetId: useMindMapStore.getState().activeSheetId,
    selectedTopicId: useMindMapStore.getState().selectedTopicId,
  }

  const commands: Command[] = [
    { id: 'quick-capture', label: 'Quick capture', shortcut: 'Ctrl+Shift+I', icon: 'zap', section: 'General', action: () => setShowQuickCapture(true) },
    { id: 'new-workbook', label: 'New workbook', shortcut: '', icon: 'plus', section: 'Workbook', action: async () => {
      const title = prompt('Workbook title:') || 'Untitled'
      try {
        const wb = await api.createWorkbook(title)
        setWorkbook(wb)
        setActiveWorkbookId(wb.id)
      } catch {}
    }},
    // Aggregate commands from all modules
    ...MODULE_REGISTRY.flatMap(m => m.commands ? m.commands(moduleContext) : []),
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

  const handleNavRailToggle = (moduleId: string) => {
    // Mindmap module closes any open panel and returns to canvas
    if (moduleId === 'mindmap') {
      closeModule()
      return
    }
    toggleModule(moduleId)
  }

  const title = useMindMapStore(s => s.workbook?.title)
  const activeModule = activeModuleId ? getModule(activeModuleId) : null

  if (startupError) return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: colors.bg, gap: spacing.lg,
      fontFamily: fonts.ui,
    }}>
      <img src="/lumen-logo.svg" alt="Gmind" width={48} height={48} style={{ opacity: 0.4 }} />
      <span style={{ fontSize: fontSizes.title, fontWeight: fontWeights.semibold, color: colors.text }}>
        Не удалось запустить сервер
      </span>
      <span style={{ fontSize: fontSizes.body, color: colors.textTertiary, textAlign: 'center', maxWidth: 320 }}>
        Сервер не ответил за 60 секунд. Подожди немного или нажми «Повторить».
      </span>
      <Button variant="primary" size="sm" onClick={startBackendPoll}>
        Повторить
      </Button>
    </div>
  )
  if (!backendReady) return <SplashScreen />

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: colors.bg, fontFamily: fonts.ui }}>
      {/* Header */}
      <header style={{
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
      }}>
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
        </div>
      </header>

      {/* Modals */}
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

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {/* Main layout: [NavRail][Sidebar][Canvas][Panel] */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Nav Rail */}
        <NavRail
          modules={MODULE_REGISTRY}
          activeModuleId={activeModuleId}
          onToggleModule={handleNavRailToggle}
          onOpenSettings={() => setShowSettings(true)}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(s => !s)}
        />

        {/* Workbook Sidebar */}
        <Sidebar
          activeWorkbookId={activeWorkbookId}
          onSelectWorkbook={handleSelectWorkbook}
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(s => !s)}
        />

        {/* Canvas + Panel wrapper */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
          {/* MindMap canvas — always rendered */}
          <div style={{ flex: 1, position: 'relative' }}>
            {activeWorkbookId ? (
              <Suspense fallback={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.textQuaternary, fontSize: fontSizes.body }}>
                  Loading...
                </div>
              }>
                <MindMap
                  workbookId={activeWorkbookId}
                  onXMindImported={(id) => {
                    api.getWorkbook(id).then(wb => { setWorkbook(wb); setActiveWorkbookId(id) })
                  }}
                />
              </Suspense>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: colors.textQuaternary,
                fontSize: fontSizes.bodyLarge,
              }}>
                Select or create a workbook to start
              </div>
            )}
          </div>

          {/* Active module panel — slides in from right */}
          <Suspense fallback={null}>
            <AnimatedMount
              show={!!activeModule && activeModule.id !== 'mindmap'}
              type="panel-right"
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 50 }}
            >
              {activeModule && activeModule.id !== 'mindmap' && (
                <activeModule.panel
                  workbookId={activeWorkbookId}
                  onClose={closeModule}
                />
              )}
            </AnimatedMount>
          </Suspense>
        </div>
      </div>

      <SaveStatusBar pendingCount={pendingCount} />
      <PWAInstallPrompt />
    </div>
  )
}
