import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Topic, Workbook } from '../../types'
import type { ProjectRootContext } from '../../utils/documentNavigation'
import { isLocalDocLink } from '../../utils/openTopicLink'
import { normalizeFsPath } from '../../utils/documentNavigation'
import { projectsApi } from '../../api/projects'
import {
  LumenChevronDown,
  LumenChevronRight,
  LumenFileText,
  LumenFolder,
  LumenHome,
  LumenPlus,
  LumenTrash2,
  LumenX,
} from '../UI/LumenIcon'
import { colors, fonts, fontSizes, fontWeights, spacing, radii, transitions } from '../../styles/tokens'

interface ProjectTreeProps {
  projectRoot: ProjectRootContext
  activeWorkbookId: string | null
  activeSourcePath?: string
  onOpenRoot: () => void
  onOpenDocument: (path: string) => void
  onProjectChanged: (workbook: Workbook, deletedPath?: string, deletedWorkbookIds?: string[]) => void
}

interface TreeNode {
  topic: Topic
  children: TreeNode[]
  documentPath: string | null
}

export function ProjectTree({
  projectRoot,
  activeWorkbookId,
  activeSourcePath,
  onOpenRoot,
  onOpenDocument,
  onProjectChanged,
}: ProjectTreeProps) {
  const nodes = useMemo(() => (projectRoot.root.children ?? [])
    .map(toDocumentTree)
    .filter((node): node is TreeNode => node !== null), [projectRoot.root.children])
  const folderIds = useMemo(() => collectFolderIds(nodes), [nodes])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [createDirectory, setCreateDirectory] = useState<string | null>(null)
  const [newFileName, setNewFileName] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [error, setError] = useState('')
  const activePath = normalizeFsPath(activeSourcePath)

  const toggleFolder = (id: string) => {
    setExpanded(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const startCreate = (directory: string) => {
    setCreateDirectory(directory)
    setNewFileName('')
    setError('')
  }

  const cancelCreate = () => {
    setCreateDirectory(null)
    setNewFileName('')
    setError('')
  }

  const createFile = async () => {
    const name = newFileName.trim()
    if (!createDirectory || !name || busyAction) return
    setBusyAction('create')
    setError('')
    try {
      const result = await projectsApi.createFile(
        projectRoot.path,
        projectRoot.workbookId,
        createDirectory,
        name,
      )
      setExpanded(previous => new Set(previous).add(normalizeFsPath(createDirectory)))
      cancelCreate()
      onProjectChanged(result.workbook)
      onOpenDocument(result.path)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusyAction(null)
    }
  }

  const deleteFile = async (path: string) => {
    if (busyAction) return
    const name = fileName(path)
    if (!window.confirm(`Удалить файл «${name}»?\n\nЭто действие нельзя отменить.`)) return
    setBusyAction(`delete:${normalizeFsPath(path)}`)
    setError('')
    try {
      const result = await projectsApi.deleteFile(projectRoot.path, projectRoot.workbookId, path)
      onProjectChanged(result.workbook, result.path, result.deleted_workbook_ids)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <section aria-label={`Дерево ${projectRoot.title}`} style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={sectionLabelStyle}>Корневая система</div>
        <div style={treeActionsStyle}>
          <button
            type="button"
            onClick={() => startCreate(projectRoot.path)}
            style={treeActionButtonStyle}
            title="Создать Markdown-файл в корне"
            aria-label="Создать Markdown-файл в корне"
          >
            <LumenPlus size={13} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(new Set())}
            style={treeActionButtonStyle}
            title="Свернуть всё дерево"
            aria-label="Свернуть всё дерево"
          >
            <LumenChevronRight size={13} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(new Set(folderIds))}
            style={treeActionButtonStyle}
            title="Развернуть всё дерево"
            aria-label="Развернуть всё дерево"
          >
            <LumenChevronDown size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenRoot}
        style={{ ...rootButtonStyle, ...(activeWorkbookId === projectRoot.workbookId ? activeRowStyle : {}) }}
        aria-current={activeWorkbookId === projectRoot.workbookId ? 'page' : undefined}
      >
        <LumenHome size={14} strokeWidth={1.9} />
        <span style={labelStyle}>Карта корня · {projectRoot.title}</span>
      </button>
      {createDirectory && (
        <div style={createFormStyle}>
          <div style={createLocationStyle} title={createDirectory}>
            Новый файл · {relativeDirectory(createDirectory, projectRoot.path)}
          </div>
          <div style={createInputRowStyle}>
            <input
              autoFocus
              value={newFileName}
              onChange={event => setNewFileName(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') void createFile()
                if (event.key === 'Escape') cancelCreate()
              }}
              placeholder="название.md"
              aria-label="Название нового Markdown-файла"
              style={createInputStyle}
              disabled={busyAction === 'create'}
            />
            <button
              type="button"
              onClick={() => void createFile()}
              disabled={!newFileName.trim() || busyAction === 'create'}
              title="Создать файл"
              aria-label="Создать файл"
              style={treeActionButtonStyle}
            >
              <LumenPlus size={13} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={cancelCreate}
              title="Отменить создание"
              aria-label="Отменить создание"
              style={treeActionButtonStyle}
            >
              <LumenX size={13} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
      {error && <div role="alert" style={errorStyle}>{error}</div>}
      <div role="tree" aria-label="Документы корня">
        {nodes.map(node => (
          <ProjectTreeRow
            key={node.topic.id}
            node={node}
            depth={0}
            expanded={expanded}
            activePath={activePath}
            onToggle={toggleFolder}
            onOpenDocument={onOpenDocument}
            onCreateInDirectory={startCreate}
            onDeleteDocument={path => void deleteFile(path)}
            busyAction={busyAction}
          />
        ))}
      </div>
    </section>
  )
}

interface ProjectTreeRowProps {
  node: TreeNode
  depth: number
  expanded: Set<string>
  activePath: string
  onToggle: (id: string) => void
  onOpenDocument: (path: string) => void
  onCreateInDirectory: (path: string) => void
  onDeleteDocument: (path: string) => void
  busyAction: string | null
}

function ProjectTreeRow({
  node,
  depth,
  expanded,
  activePath,
  onToggle,
  onOpenDocument,
  onCreateInDirectory,
  onDeleteDocument,
  busyAction,
}: ProjectTreeRowProps) {
  const activeRef = useRef<HTMLButtonElement>(null)
  const isFolder = node.children.length > 0 && !node.documentPath
  const folderPath = node.topic.notes?.trim() || ''
  const folderKey = normalizeFsPath(folderPath || node.topic.id)
  const isExpanded = expanded.has(folderKey)
  const isActive = !!node.documentPath && normalizeFsPath(node.documentPath) === activePath
  const isDeleting = !!node.documentPath && busyAction === `delete:${normalizeFsPath(node.documentPath)}`

  useEffect(() => {
    if (isActive) activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [isActive])

  return (
    <>
      <div role="none" style={{ ...treeRowGroupStyle, ...(isActive ? activeRowStyle : {}) }}>
        <button
          ref={isActive ? activeRef : undefined}
          type="button"
          role="treeitem"
          aria-expanded={isFolder ? isExpanded : undefined}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => {
            if (isFolder) onToggle(folderKey)
            else if (node.documentPath) onOpenDocument(node.documentPath)
          }}
          style={{
            ...treeRowStyle,
            paddingLeft: spacing.sm + depth * 16,
            ...(isActive ? activeRowTextStyle : {}),
          }}
          title={node.documentPath || node.topic.notes || node.topic.title}
          disabled={isDeleting}
        >
          <span style={chevronStyle} aria-hidden="true">
            {isFolder
              ? (isExpanded ? <LumenChevronDown size={12} /> : <LumenChevronRight size={12} />)
              : null}
          </span>
          {isFolder
            ? <LumenFolder size={13} strokeWidth={1.8} />
            : <LumenFileText size={13} strokeWidth={1.8} />}
          <span style={labelStyle}>{node.topic.title || fileName(node.documentPath || '')}</span>
        </button>
        {isFolder && folderPath ? (
          <button
            type="button"
            onClick={() => onCreateInDirectory(folderPath)}
            style={rowActionButtonStyle}
            title={`Создать файл в папке ${node.topic.title}`}
            aria-label={`Создать файл в папке ${node.topic.title}`}
          >
            <LumenPlus size={12} strokeWidth={2} />
          </button>
        ) : node.documentPath ? (
          <button
            type="button"
            onClick={() => onDeleteDocument(node.documentPath!)}
            disabled={isDeleting}
            style={rowActionButtonStyle}
            title={`Удалить файл ${fileName(node.documentPath)}`}
            aria-label={`Удалить файл ${fileName(node.documentPath)}`}
            onMouseEnter={event => { event.currentTarget.style.color = colors.red }}
            onMouseLeave={event => { event.currentTarget.style.color = colors.textTertiary }}
          >
            <LumenTrash2 size={12} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>
      {isFolder && isExpanded && node.children.map(child => (
        <ProjectTreeRow
          key={child.topic.id}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          activePath={activePath}
          onToggle={onToggle}
          onOpenDocument={onOpenDocument}
          onCreateInDirectory={onCreateInDirectory}
          onDeleteDocument={onDeleteDocument}
          busyAction={busyAction}
        />
      ))}
    </>
  )
}

function toDocumentTree(topic: Topic): TreeNode | null {
  const children = (topic.children ?? []).map(toDocumentTree).filter((node): node is TreeNode => node !== null)
  const documentPath = isLocalDocLink(topic.hyperlink) ? topic.hyperlink!.trim() : null
  if (!documentPath && children.length === 0) return null
  return { topic, children, documentPath }
}

function collectFolderIds(nodes: TreeNode[]): string[] {
  const ids: string[] = []
  const visit = (node: TreeNode) => {
    if (!node.documentPath && node.children.length > 0) {
      ids.push(normalizeFsPath(node.topic.notes || node.topic.id))
    }
    node.children.forEach(visit)
  }
  nodes.forEach(visit)
  return ids
}

function relativeDirectory(directory: string, root: string): string {
  const normalizedDirectory = directory.replace(/\\/g, '/').replace(/\/+$/, '')
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '')
  const relative = normalizedDirectory.slice(normalizedRoot.length).replace(/^\/+/, '')
  return relative || 'корень'
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Не удалось изменить файл'
}

function fileName(path: string): string {
  return path.replace(/\\/g, '/').split('/').at(-1) || path
}

const sectionStyle: CSSProperties = {
  padding: `${spacing.sm}px ${spacing.md}px ${spacing.md}px`,
  borderBottom: `1px solid ${colors.separator}`,
}

const sectionLabelStyle: CSSProperties = {
  fontSize: fontSizes.caption,
  fontWeight: fontWeights.semibold,
  color: colors.textTertiary,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const sectionHeaderStyle: CSSProperties = {
  minHeight: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${spacing.xs}px ${spacing.sm}px`,
}

const treeActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xxs,
}

const treeActionButtonStyle: CSSProperties = {
  width: 26,
  height: 26,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: radii.sm,
  background: 'transparent',
  color: colors.textTertiary,
  cursor: 'pointer',
}

const treeRowStyle: CSSProperties = {
  minWidth: 0,
  flex: 1,
  minHeight: 30,
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xs,
  paddingTop: spacing.xs,
  paddingRight: spacing.sm,
  paddingBottom: spacing.xs,
  border: 'none',
  borderRadius: radii.sm,
  background: 'transparent',
  color: colors.textSecondary,
  fontFamily: fonts.ui,
  fontSize: fontSizes.caption,
  textAlign: 'left',
  cursor: 'pointer',
  transition: `background ${transitions.fast}, color ${transitions.fast}`,
}

const treeRowGroupStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  borderRadius: radii.sm,
}

const rowActionButtonStyle: CSSProperties = {
  width: 26,
  height: 26,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  border: 'none',
  borderRadius: radii.sm,
  background: 'transparent',
  color: colors.textTertiary,
  cursor: 'pointer',
}

const rootButtonStyle: CSSProperties = {
  ...treeRowStyle,
  paddingLeft: spacing.sm,
  marginBottom: spacing.xs,
  color: colors.accent,
  fontWeight: fontWeights.medium,
}

const activeRowStyle: CSSProperties = {
  background: colors.accentLight,
}

const activeRowTextStyle: CSSProperties = {
  color: colors.accent,
  fontWeight: fontWeights.medium,
}

const chevronStyle: CSSProperties = {
  width: 12,
  height: 12,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const labelStyle: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const createFormStyle: CSSProperties = {
  margin: `${spacing.xs}px 0 ${spacing.sm}px`,
  padding: spacing.sm,
  borderRadius: radii.sm,
  background: colors.fill,
}

const createLocationStyle: CSSProperties = {
  marginBottom: spacing.xs,
  overflow: 'hidden',
  color: colors.textTertiary,
  fontSize: fontSizes.caption,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const createInputRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: spacing.xxs,
}

const createInputStyle: CSSProperties = {
  minWidth: 0,
  flex: 1,
  height: 28,
  padding: `0 ${spacing.sm}px`,
  border: `1px solid ${colors.separator}`,
  borderRadius: radii.sm,
  background: colors.bg,
  color: colors.text,
  fontFamily: fonts.ui,
  fontSize: fontSizes.caption,
  outline: 'none',
}

const errorStyle: CSSProperties = {
  margin: `${spacing.xs}px ${spacing.sm}px`,
  color: colors.red,
  fontSize: fontSizes.caption,
  lineHeight: 1.35,
}
