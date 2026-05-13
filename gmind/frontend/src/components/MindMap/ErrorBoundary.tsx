import { Component, type ReactNode } from 'react'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, transitions } from '../../styles/tokens'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          height: '100%', padding: spacing.block, textAlign: 'center',
          fontFamily: fonts.ui, color: colors.textQuaternary,
        }}>
          <div style={{ fontSize: fontSizes.display, marginBottom: spacing.lg }}>⚠</div>
          <div style={{ fontSize: fontSizes.headline, fontWeight: fontWeights.semibold, color: colors.textSecondary, marginBottom: spacing.md }}>
            Something went wrong
          </div>
          <div style={{ fontSize: fontSizes.body, color: colors.textTertiary, marginBottom: spacing.xl, maxWidth: 320, lineHeight: 1.6 }}>
            {this.state.error?.message}
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            style={{
              padding: `${spacing.md}px ${spacing.xl}px`,
              background: colors.accent, color: colors.textInverse,
              border: 'none', borderRadius: radii.md,
              cursor: 'pointer', fontSize: fontSizes.body,
              fontWeight: fontWeights.medium, fontFamily: fonts.ui,
              transition: `all ${transitions.fast}`,
            }}
            onMouseEnter={e => e.currentTarget.style.background = colors.accentHover}
            onMouseLeave={e => e.currentTarget.style.background = colors.accent}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
