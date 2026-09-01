import { LumenChevronLeft, LumenChevronRight, LumenTarget } from '../UI/LumenIcon'
import type { ProjectRootContext } from '../../utils/documentNavigation'
import { relativeDocumentSegments } from '../../utils/documentNavigation'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, shadows, transitions } from '../../styles/tokens'

interface DocumentContextBarProps {
  title: string
  sourcePath?: string
  projectRoot: ProjectRootContext | null
  canGoBack: boolean
  canGoForward: boolean
  onGoBack: () => void
  onGoForward: () => void
  onOpenRoot: () => void
  onRevealInTree: () => void
}

export function DocumentContextBar({
  title,
  sourcePath,
  projectRoot,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onOpenRoot,
  onRevealInTree,
}: DocumentContextBarProps) {
  const segments = relativeDocumentSegments(sourcePath, projectRoot)

  return (
    <div style={barStyle} aria-label="Навигация по документам">
      <button
        type="button"
        onClick={onGoBack}
        disabled={!canGoBack}
        style={iconButtonStyle}
        title="Назад (Alt+←)"
        aria-label="Назад"
      >
        <LumenChevronLeft size={15} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        onClick={onGoForward}
        disabled={!canGoForward}
        style={iconButtonStyle}
        title="Вперёд (Alt+→)"
        aria-label="Вперёд"
      >
        <LumenChevronRight size={15} strokeWidth={2.2} />
      </button>

      <nav style={breadcrumbStyle} aria-label="Путь к документу" title={sourcePath || title}>
        {projectRoot ? (
          <>
            <button type="button" onClick={onOpenRoot} style={crumbButtonStyle}>
              {projectRoot.title}
            </button>
            {segments.map((segment, index) => (
              <span key={`${segment}-${index}`} style={crumbGroupStyle}>
                <span style={separatorStyle}>/</span>
                <span style={index === segments.length - 1 ? currentCrumbStyle : crumbStyle}>{segment}</span>
              </span>
            ))}
          </>
        ) : (
          <span style={currentCrumbStyle}>{segments[0] || title}</span>
        )}
      </nav>

      {projectRoot && (
        <button
          type="button"
          onClick={onRevealInTree}
          style={iconButtonStyle}
          title="Показать текущий файл в дереве"
          aria-label="Показать текущий файл в дереве"
        >
          <LumenTarget size={14} strokeWidth={1.9} />
        </button>
      )}
    </div>
  )
}

const barStyle: React.CSSProperties = {
  height: 40,
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xxs,
  padding: `0 ${spacing.md}px`,
  flexShrink: 0,
  background: colors.bgTertiary,
  borderBottom: `1px solid ${colors.separator}`,
  boxShadow: shadows.neuInset,
  fontFamily: fonts.ui,
}

const iconButtonStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  border: 'none',
  borderRadius: radii.sm,
  background: 'transparent',
  color: colors.textSecondary,
  cursor: 'pointer',
  transition: `background ${transitions.fast}, color ${transitions.fast}`,
}

const breadcrumbStyle: React.CSSProperties = {
  minWidth: 0,
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  fontSize: fontSizes.caption,
  color: colors.textTertiary,
}

const crumbGroupStyle: React.CSSProperties = {
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
}

const crumbButtonStyle: React.CSSProperties = {
  minWidth: 0,
  padding: `${spacing.xxs}px ${spacing.xs}px`,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  border: 'none',
  borderRadius: radii.sm,
  background: 'transparent',
  color: colors.accent,
  fontFamily: fonts.ui,
  fontSize: fontSizes.caption,
  fontWeight: fontWeights.medium,
  cursor: 'pointer',
}

const separatorStyle: React.CSSProperties = {
  padding: `0 ${spacing.xxs}px`,
  color: colors.textQuaternary,
  flexShrink: 0,
}

const crumbStyle: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const currentCrumbStyle: React.CSSProperties = {
  ...crumbStyle,
  color: colors.text,
  fontWeight: fontWeights.medium,
}
