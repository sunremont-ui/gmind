import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react'
import { LumenCommand, LumenZap } from './components/UI/LumenIcon'
import { AnimatedMount } from './components/UI/AnimatedMount'
import { Sidebar } from './components/Sidebar/Sidebar'
import { DocumentContextBar } from './components/DocumentContextBar/DocumentContextBar'
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
import { searchApi } from './api/search'
import { useAgentStore } from './store/agent'
import { useMindMapStore } from './store/mindmap'
import { useMASysMemoryStore } from './store/masysMemory'
// Импорт нужен на старте: при восстановлении из localStorage стор наполняет
// реестр корпусов, иначе первый рендер холста прошёл бы без своих корпусов.
import { useMemoryPackagesStore } from './store/memoryPackages'
import { useComponentLibraryStore } from './store/componentLibrary'
import { useThemeStore } from './store/theme'
import { offlineStorage, offlineQueue } from './utils/offline'
import { ensureInboxWorkbook } from './utils/inbox'
import { createMemoryLabWorkbook } from './utils/memoryLab'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { saveSession, loadSession, syncPendingOps } from './utils/sync'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, sizes, gradients } from './styles/tokens'
import { Text, Button } from './components/UI/Box'
import type { Workbook } from './types'
import { OPEN_WORKBOOK_EVENT, openTopicLink, type OpenWorkbookEventDetail } from './utils/openTopicLink'
import {
  EMPTY_DOCUMENT_NAVIGATION,
  captureCurrentNavigationEntry,
  createNavigationEntry,
  pushDocumentNavigation,
  resetDocumentNavigation,
  resolveProjectRoot,
  normalizeFsPath,
  projectRootFromWorkbook,
  type DocumentNavigationState,
} from './utils/documentNavigation'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

function SplashScreen() {
  const theme = useThemeStore(s => s.theme)
  const isMidnight = theme.id === 'midnight'
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: theme.background, gap: spacing.lg,
    }}>
      <img src={isMidnight ? '/lumen-logo-dark.svg' : '/lumen-logo.svg'} alt="Gmind" width={48} height={48} style={{ opacity: 0.9 }} />
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
      <span style={{ fontSize: fontSizes.body, color: theme.topic.textColor, opacity: 0.68, fontFamily: fonts.ui }}>
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
  const [documentNavigation, setDocumentNavigation] = useState<DocumentNavigationState>(EMPTY_DOCUMENT_NAVIGATION)
  const currentThemeId = useThemeStore(s => s.currentThemeId)
  const darkThemeActive = currentThemeId === 'midnight'
  const logoSrc = darkThemeActive ? '/lumen-logo-dark.svg' : '/lumen-logo.svg'

  const setWorkbook = useMindMapStore(s => s.setWorkbook)
  const fetchAgents = useAgentStore(s => s.fetchAgents)
  const setActiveSheet = useMindMapStore(s => s.setActiveSheet)
  const { online, wasOffline, clearReconnectedFlag } = useOnlineStatus()
  const syncingRef = useRef(false)

  const activeModuleId = useShellStore(s => s.activeModuleId)
  const toggleModule = useShellStore(s => s.toggleModule)
  const closeModule = useShellStore(s => s.closeModule)

  const activateWorkbook = useCallback((
    workbook: Workbook,
    options: {
      mode?: 'push' | 'reset'
      activeSheetId?: string | null
      selectedTopicId?: string | null
    } = {},
  ) => {
    const current = useMindMapStore.getState()
    const activeSheetId = options.activeSheetId && workbook.sheets.some(sheet => sheet.id === options.activeSheetId)
      ? options.activeSheetId
      : workbook.sheets[0]?.id ?? null
    const selectedTopicId = options.selectedTopicId ?? null

    setDocumentNavigation(previous => {
      const captured = captureCurrentNavigationEntry(
        previous,
        current.workbook,
        current.activeSheetId,
        current.selectedTopicId,
      )
      const previousRoot = options.mode === 'reset'
        ? null
        : captured.entries[captured.index]?.projectRoot ?? null
      const entry = createNavigationEntry(
        workbook,
        activeSheetId,
        selectedTopicId,
        resolveProjectRoot(workbook, previousRoot),
      )
      return options.mode === 'reset'
        ? resetDocumentNavigation(entry)
        : pushDocumentNavigation(captured, entry)
    })

    setWorkbook(workbook)
    setActiveWorkbookId(workbook.id)
    if (activeSheetId) setActiveSheet(activeSheetId)
    useMindMapStore.getState().setSelectedTopic(selectedTopicId)
    offlineStorage.saveWorkbook(workbook).catch(() => {})
  }, [setActiveSheet, setWorkbook])

  const restoreNavigationIndex = useCallback((targetIndex: number) => {
    const target = documentNavigation.entries[targetIndex]
    if (!target) return
    const current = useMindMapStore.getState()
    setDocumentNavigation(previous => ({
      ...captureCurrentNavigationEntry(
        previous,
        current.workbook,
        current.activeSheetId,
        current.selectedTopicId,
      ),
      index: targetIndex,
    }))
    setWorkbook(target.workbook)
    setActiveWorkbookId(target.workbook.id)
    if (target.activeSheetId && target.workbook.sheets.some(sheet => sheet.id === target.activeSheetId)) {
      setActiveSheet(target.activeSheetId)
    }
    useMindMapStore.getState().setSelectedTopic(target.selectedTopicId)
  }, [documentNavigation.entries, setActiveSheet, setWorkbook])

  const goDocumentBack = useCallback(() => {
    if (documentNavigation.index > 0) restoreNavigationIndex(documentNavigation.index - 1)
  }, [documentNavigation.index, restoreNavigationIndex])

  const goDocumentForward = useCallback(() => {
    if (documentNavigation.index < documentNavigation.entries.length - 1) {
      restoreNavigationIndex(documentNavigation.index + 1)
    }
  }, [documentNavigation.entries.length, documentNavigation.index, restoreNavigationIndex])

  const recordTopicNavigation = useCallback((topicId: string) => {
    const current = useMindMapStore.getState()
    if (!current.workbook) return
    setDocumentNavigation(previous => {
      const previousTopicId = previous.entries[previous.index]?.selectedTopicId ?? null
      const captured = captureCurrentNavigationEntry(
        previous,
        current.workbook,
        current.activeSheetId,
        previousTopicId,
      )
      const projectRoot = captured.entries[captured.index]?.projectRoot ?? null
      return pushDocumentNavigation(captured, createNavigationEntry(
        current.workbook!,
        current.activeSheetId,
        topicId,
        projectRoot,
      ))
    })
  }, [])

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

  useEffect(() => {
    document.documentElement.dataset.theme = darkThemeActive ? 'dark' : 'light'
    document.documentElement.style.colorScheme = darkThemeActive ? 'dark' : 'light'
  }, [darkThemeActive])

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

  // MASys подключается сам: как только поднялся бэкенд, начинаем следить за
  // связью — панели MASys/Memory Workbench открываются уже с готовым статусом.
  useEffect(() => {
    if (!backendReady) return
    return useMASysMemoryStore.getState().startHealthWatch()
  }, [backendReady])

  // Держим сторы корпусов и компонентов живыми: их подписки наполняют реестры
  // оформления узлов и библиотеки заготовок при восстановлении из localStorage.
  useMemoryPackagesStore(s => s.custom)
  useComponentLibraryStore(s => s.custom)

  const masysHealth = useMASysMemoryStore(s => s.health)
  const masysStatusByModule = useMemo(() => {
    const status = {
      ok: !!masysHealth?.reachable,
      label: masysHealth?.reachable
        ? `MASys подключён (${masysHealth.base_url})`
        : 'MASys недоступен',
    }
    return { masys: status, 'memory-workbench': status }
  }, [masysHealth])

  useEffect(() => {
    (async () => {
      try {
        const session = await loadSession()
        if (!navigator.onLine && session?.lastWorkbookId) {
          const cached = await offlineStorage.getWorkbook(session.lastWorkbookId)
          if (cached) {
            activateWorkbook(cached, {
              mode: 'reset',
              activeSheetId: session.lastSheetId,
            })
          }
        }
      } catch { /* ignore */ }
      ensureInboxWorkbook().catch(() => {})
    })()
  }, [activateWorkbook])

  useEffect(() => {
    const handleWorkbookOpen = (event: Event) => {
      const openEvent = event as CustomEvent<OpenWorkbookEventDetail>
      if (!openEvent.detail?.workbook) return
      event.preventDefault()
      activateWorkbook(openEvent.detail.workbook)
    }
    window.addEventListener(OPEN_WORKBOOK_EVENT, handleWorkbookOpen)
    return () => window.removeEventListener(OPEN_WORKBOOK_EVENT, handleWorkbookOpen)
  }, [activateWorkbook])

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
        lastTheme: currentThemeId,
      })
    }
  }, [activeWorkbookId, currentThemeId])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isEditing = target?.isContentEditable
        || target?.tagName === 'INPUT'
        || target?.tagName === 'TEXTAREA'
        || target?.tagName === 'SELECT'
      if (!isEditing && e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        goDocumentBack()
        return
      }
      if (!isEditing && e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowRight') {
        e.preventDefault()
        goDocumentForward()
        return
      }
      // Quick capture (быстрые заметки) — Ctrl+Alt+Space
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === 'Space') {
        e.preventDefault()
        setShowQuickCapture(s => !s)
        return
      }
      // Command palette — Ctrl+K / ⌘K
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setShowCommandPalette(s => !s)
        return
      }
      // Quick capture alias — Ctrl+Shift+I
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
  }, [goDocumentBack, goDocumentForward, toggleModule])

  const moduleContext = {
    workbookId: activeWorkbookId,
    activeSheetId: useMindMapStore.getState().activeSheetId,
    selectedTopicId: useMindMapStore.getState().selectedTopicId,
  }

  const commands: Command[] = [
    { id: 'quick-capture', label: 'Quick capture', shortcut: 'Ctrl+Alt+Space', icon: 'zap', section: 'General', action: () => setShowQuickCapture(true) },
    { id: 'new-workbook', label: 'New workbook', shortcut: '', icon: 'plus', section: 'Workbook', action: async () => {
      const title = prompt('Workbook title:') || 'Untitled'
      try {
        const wb = await api.createWorkbook(title)
        activateWorkbook(wb)
      } catch {}
    }},
    { id: 'new-memory-lab', label: 'New Memory Lab', shortcut: '', icon: 'sparkles', section: 'Workbook', action: async () => {
      try {
        const wb = await createMemoryLabWorkbook()
        activateWorkbook(wb)
      } catch (err) { console.error('create memory lab failed:', err) }
    }},
    // Aggregate commands from all modules
    ...MODULE_REGISTRY.flatMap(m => m.commands ? m.commands(moduleContext) : []),
  ]

  const handleSelectWorkbook = useCallback(async (id: string) => {
    try {
      const wb = await api.getWorkbook(id)
      activateWorkbook(wb)
    } catch {
      const cached = await offlineStorage.getWorkbook(id)
      if (cached) activateWorkbook(cached)
    }
  }, [activateWorkbook])

  // GI-7: full-text topic search for the command palette. Maps FTS hits to
  // commands that open the owning workbook and select the matched topic.
  const handleTopicSearch = useCallback(async (query: string): Promise<Command[]> => {
    const hits = await searchApi.fullText(query, { limit: 8 })
    return hits.map(r => ({
      id: `fts-${r.workbook_id}-${r.topic_id}`,
      label: r.title || '(untitled)',
      shortcut: r.workbook_title,
      icon: 'fileText',
      section: 'Topics',
      action: async () => {
        if (r.workbook_id !== activeWorkbookId) {
          await handleSelectWorkbook(r.workbook_id)
        }
        useMindMapStore.getState().setSelectedTopic(r.topic_id)
        recordTopicNavigation(r.topic_id)
      },
    }))
  }, [activeWorkbookId, handleSelectWorkbook, recordTopicNavigation])

  const handleNavRailToggle = (moduleId: string) => {
    // Mindmap module closes any open panel and returns to canvas
    if (moduleId === 'mindmap') {
      closeModule()
      return
    }
    toggleModule(moduleId)
  }

  const activeWorkbook = useMindMapStore(s => s.workbook)
  const title = activeWorkbook?.title
  const activeNavigationEntry = documentNavigation.entries[documentNavigation.index] ?? null
  const projectRoot = activeNavigationEntry?.projectRoot ?? null
  const handleOpenProjectDocument = useCallback((path: string) => {
    void openTopicLink(path)
  }, [])
  const handleProjectChanged = useCallback((
    rootWorkbook: Workbook,
    deletedPath?: string,
    deletedWorkbookIds: string[] = [],
  ) => {
    const nextRoot = projectRootFromWorkbook(rootWorkbook)
    if (!nextRoot) return

    const deletedKey = normalizeFsPath(deletedPath)
    const deletedIds = new Set(deletedWorkbookIds)
    const current = useMindMapStore.getState()
    const currentDeleted = (!!deletedKey && normalizeFsPath(current.workbook?.source_path) === deletedKey)
      || (!!current.workbook && deletedIds.has(current.workbook.id))
    const rootWasActive = current.workbook?.id === rootWorkbook.id
    const rootSheetId = rootWorkbook.sheets[0]?.id ?? null

    setDocumentNavigation(previous => {
      const entriesBeforeCurrent = previous.entries.slice(0, previous.index)
      const isDeletedEntry = (entry: DocumentNavigationState['entries'][number] | undefined) => !!entry && (
        (!!deletedKey && normalizeFsPath(entry.workbook.source_path) === deletedKey)
        || deletedIds.has(entry.workbook.id)
      )
      const keptBeforeCurrent = entriesBeforeCurrent.filter(entry => !isDeletedEntry(entry)).length
      const currentEntryWasDeleted = isDeletedEntry(previous.entries[previous.index])
      const entries = previous.entries
        .filter(entry => !isDeletedEntry(entry))
        .map(entry => ({
          ...entry,
          workbook: entry.workbook.id === rootWorkbook.id ? rootWorkbook : entry.workbook,
          projectRoot: entry.projectRoot?.workbookId === rootWorkbook.id ? nextRoot : entry.projectRoot,
        }))
      const base: DocumentNavigationState = {
        entries,
        index: currentEntryWasDeleted
          ? Math.max(keptBeforeCurrent - 1, -1)
          : Math.min(keptBeforeCurrent, entries.length - 1),
      }
      if (!currentDeleted) return base
      return pushDocumentNavigation(base, createNavigationEntry(rootWorkbook, rootSheetId, null, nextRoot))
    })

    if (currentDeleted || rootWasActive) {
      setWorkbook(rootWorkbook)
      setActiveWorkbookId(rootWorkbook.id)
      if (rootSheetId) setActiveSheet(rootSheetId)
      useMindMapStore.getState().setSelectedTopic(null)
    }
    offlineStorage.saveWorkbook(rootWorkbook).catch(() => {})
  }, [setActiveSheet, setWorkbook])
  const activeModule = activeModuleId ? getModule(activeModuleId) : null

  if (startupError) return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: colors.bg, gap: spacing.lg,
      fontFamily: fonts.ui,
    }}>
      <img src={logoSrc} alt="Gmind" width={48} height={48} style={{ opacity: 0.4 }} />
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
            <img src={logoSrc} alt="Lumen" width={24} height={24} style={{ flexShrink: 0 }} />
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
          <Button variant="ghost" size="sm" icon onClick={() => setShowCommandPalette(true)} title="Commands (Ctrl+K)">
            <LumenCommand size={15} strokeWidth={1.8} />
          </Button>
          <Button variant="ghost" size="sm" icon onClick={() => setShowQuickCapture(true)} title="Quick capture (Ctrl+Alt+Space)">
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
            searchProvider={handleTopicSearch}
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
          statusByModule={masysStatusByModule}
        />

        {/* Workbook Sidebar */}
        <Sidebar
          activeWorkbookId={activeWorkbookId}
          onSelectWorkbook={handleSelectWorkbook}
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(s => !s)}
          projectRoot={projectRoot}
          activeSourcePath={activeWorkbook?.source_path}
          onOpenProjectDocument={handleOpenProjectDocument}
          onProjectChanged={handleProjectChanged}
        />

        {/* Canvas + Panel wrapper */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
          {/* MindMap canvas — always rendered */}
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {activeWorkbookId && activeWorkbook && (
              <DocumentContextBar
                title={activeWorkbook.title}
                sourcePath={activeWorkbook.source_path}
                projectRoot={projectRoot}
                canGoBack={documentNavigation.index > 0}
                canGoForward={documentNavigation.index < documentNavigation.entries.length - 1}
                onGoBack={goDocumentBack}
                onGoForward={goDocumentForward}
                onOpenRoot={() => {
                  if (projectRoot) void handleSelectWorkbook(projectRoot.workbookId)
                }}
                onRevealInTree={() => setSidebarOpen(true)}
              />
            )}
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              {activeWorkbookId ? (
                <Suspense fallback={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.textQuaternary, fontSize: fontSizes.body }}>
                    Loading...
                  </div>
                }>
                  <MindMap
                    workbookId={activeWorkbookId}
                    onNavigateTopic={recordTopicNavigation}
                    onXMindImported={(id) => {
                      api.getWorkbook(id).then(wb => activateWorkbook(wb))
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
