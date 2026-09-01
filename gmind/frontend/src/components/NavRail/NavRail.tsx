import { colors, fonts, fontSizes, spacing, radii, transitions } from '../../styles/tokens'
import type { AppModule } from '../../modules/types'

const NAV_RAIL_WIDTH = 48

/** Точка состояния на иконке модуля (например, связь с MASys). */
export interface NavRailStatus {
  ok: boolean
  label: string
}

interface NavRailProps {
  modules: AppModule[]
  activeModuleId: string | null
  onToggleModule: (id: string) => void
  onOpenSettings: () => void
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
  /** id модуля → индикатор связи. */
  statusByModule?: Record<string, NavRailStatus | undefined>
}

export function NavRail({ modules, activeModuleId, onToggleModule, onOpenSettings, sidebarOpen, onToggleSidebar, statusByModule }: NavRailProps) {
  // Filter out mindmap module — it's the canvas, not a panel
  const panelModules = modules.filter(m => m.id !== 'mindmap')

  return (
    <div style={{
      width: NAV_RAIL_WIDTH,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      borderRight: `1px solid ${colors.separator}`,
      background: colors.bg,
      gap: spacing.xxs,
      zIndex: 10,
      // Список модулей растёт, высота окна — нет. Без этого нижние кнопки и
      // «Настройки» уезжали за край рейки и до них было не добраться.
      overflow: 'hidden',
      height: '100%',
    }}>
      {/* Sidebar toggle */}
      {onToggleSidebar && (
        <>
          <NavRailButton tooltip={sidebarOpen ? 'Скрыть список' : 'Показать список'} onClick={onToggleSidebar}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
              stroke={colors.textTertiary} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              {sidebarOpen ? (
                <>
                  <line x1="9" y1="4" x2="3" y2="12" />
                  <line x1="9" y1="20" x2="3" y2="12" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </NavRailButton>
          <div style={{ width: 24, height: 1, background: colors.separator, margin: `2px 0` }} />
        </>
      )}

      {/* Прокручиваемый список модулей: верхняя кнопка и «Настройки» остаются
          на местах, а не помещающиеся модули доступны прокруткой. */}
      <div
        data-testid="nav-rail-modules"
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing.xxs,
        }}
      >
      {panelModules.map(mod => {
        const status = statusByModule?.[mod.id]
        return (
          <NavRailButton
            key={mod.id}
            active={activeModuleId === mod.id}
            tooltip={status ? `${mod.tooltip} — ${status.label}` : mod.tooltip}
            onClick={() => onToggleModule(mod.id)}
          >
            <mod.icon
              size={18}
              strokeWidth={1.8}
              color={activeModuleId === mod.id ? colors.accent : colors.textTertiary}
            />
            {status && (
              <span
                aria-label={status.label}
                style={{
                  position: 'absolute',
                  right: 5,
                  bottom: 5,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: status.ok ? colors.green : colors.textTertiary,
                  border: `1.5px solid ${colors.bg}`,
                }}
              />
            )}
          </NavRailButton>
        )
      })}
      </div>

      {/* Settings */}
      <NavRailButton tooltip="Settings" onClick={onOpenSettings}>
        <svg
          width={18} height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.textTertiary}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </NavRailButton>
    </div>
  )
}

function NavRailButton({
  active = false,
  tooltip,
  onClick,
  children,
}: {
  active?: boolean
  tooltip: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      title={tooltip}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: radii.sm,
        cursor: 'pointer',
        background: active ? colors.accentLight : 'transparent',
        transition: `background ${transitions.fast}, opacity ${transitions.fast}`,
        fontFamily: fonts.ui,
        fontSize: fontSizes.caption,
        color: active ? colors.accent : colors.textTertiary,
        flexShrink: 0,
        position: 'relative',
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = colors.fill
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}
