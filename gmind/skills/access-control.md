# Skill: Access Control

Управление доступом к workbook: 4 режима (public / collaborators / agents / private).

## Backend Changes

### 1. Add `AccessMode` to `Workbook` struct

```go
// backend/internal/model/types.go
type Workbook struct {
    // ...
    Private    bool   `json:"private"`
    AccessMode string `json:"access_mode,omitempty"`
    OwnerID    string `json:"owner_id"`
}
```

Constants:

```go
const (
    AccessModePublic        = "public"
    AccessModePrivate       = "private"
    AccessModeAgents        = "agents"
    AccessModeCollaborators = "collaborators"
)
```

**Backward compat:** If `AccessMode` is empty on read, derive from `Private`:
- `Private == true` → `AccessModeCollaborators`
- `Private == false` → `AccessModePublic`

### 2. Update WebSocket hub auth

File: `backend/internal/ws/hub.go`

On `join` message, after getting the workbook:

```go
mode := wb.AccessMode
if mode == "" {
    if wb.Private { mode = AccessModeCollaborators } else { mode = AccessModePublic }
}
switch mode {
case AccessModePrivate:
    // Only owner
case AccessModeCollaborators:
    // Owner + collaborators table
case AccessModeAgents:
    // Owner + isAgentUser()
case AccessModePublic:
    // Allow all
}
```

Helper:
```go
func isAgentUser(userID string) bool {
    return len(userID) >= 6 && userID[:6] == "agent-"
}
```

### 3. Update workbook update API

```go
// backend/internal/api/workbook.go
if accessMode, ok := updates["access_mode"].(string); ok {
    wb.AccessMode = accessMode
}
```

## Frontend Changes

### ShareDialog

File: `components/ShareDialog/ShareDialog.tsx`

- Radio buttons for 4 modes instead of single private checkbox
- Local `selectedMode` state for optimistic UI update
- Single API call sends both `{ private, access_mode }`
- Invite/Collaborators sections shown only in `collaborators` mode

```tsx
const [selectedMode, setSelectedMode] = useState(
  accessMode || (isPrivate ? 'collaborators' : 'public')
)

// Sync from props
useEffect(() => {
  setSelectedMode(accessMode || (isPrivate ? 'collaborators' : 'public'))
}, [accessMode, isPrivate])

const handleModeChange = (mode: string) => {
  setSelectedMode(mode)
  onChangeAccessMode(mode)
}
```

### MindMap callbacks

```tsx
const handleChangeAccessMode = useCallback(async (mode: string) => {
  if (!workbook) return
  await api.updateWorkbook(workbook.id, {
    private: mode !== 'public',
    access_mode: mode,
  })
  loadWorkbook()
}, [workbook, loadWorkbook])
```

### TypeScript type

```ts
// types/api.ts
export interface Workbook {
  // ...
  private: boolean
  access_mode?: string
  owner_id: string
}
```

## Testing

| Scenario | Expected |
|---|---|
| Set to `private` | New WS connections (except owner) rejected with `"workbook is private"` |
| Set to `agents` | Only owner + `agent-*` users can join |
| Set to `collaborators` | Only owner + collaborators table users can join |
| Set to `public` | Everyone can join |
| Old workbook with `private: true` | Treated as `collaborators` mode |
| Old workbook with `private: false` | Treated as `public` mode |

## Files

- `backend/internal/model/types.go` — constants + struct
- `backend/internal/ws/hub.go` — join auth logic
- `backend/internal/api/workbook.go` — update handler
- `frontend/src/components/ShareDialog/ShareDialog.tsx` — radio buttons UI
- `frontend/src/components/MindMap/MindMap.tsx` — callbacks
- `frontend/src/types/api.ts` — TypeScript type
