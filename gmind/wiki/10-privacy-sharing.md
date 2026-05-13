# Privacy & Sharing

## Access Modes

Workbook supports 4 access modes controlling who can connect via WebSocket:

| Mode | Description |
|---|---|
| **Public** | Anyone can connect and edit (default) |
| **Collaborators only** | Only owner + invited collaborators |
| **Agents only** | Only owner + AI agent users (ID prefix `agent-`) |
| **Private** | Nobody can connect, not even agents |

### Backend

- `Workbook.AccessMode` (`string`) — one of: `"public"`, `"collaborators"`, `"agents"`, `"private"`
- `Workbook.Private` (`bool`) — kept for backward compatibility with older data
- `PUT /api/v1/workbooks/{id}` accepts both `{ "access_mode": "..." }` and `{ "private": true/false }`
- Constants: `model.AccessModePublic`, `AccessModeCollaborators`, `AccessModeAgents`, `AccessModePrivate`
- Fallback on read: if `AccessMode` is empty, derive from `Private` (`true` → `"collaborators"`, `false` → `"public"`)

### WebSocket Auth (`ws/hub.go`)

On `join` message, hub checks `AccessMode`:

```go
switch mode {
case AccessModePrivate:
    // Only owner may connect
case AccessModeCollaborators:
    // Owner + workbook_collaborators table
case AccessModeAgents:
    // Owner + users with userID starting with "agent-"
case AccessModePublic:
    // Everyone allowed
}
```

Helper: `isAgentUser(userID)` — checks `len >= 6 && userID[:6] == "agent-"`.

If not authorized → sends `{ type: "error", payload: { message: "workbook is private" } }`.

### Collaborator API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/workbooks/{id}/collaborators` | Add collaborator `{ user_id, role }` |
| `DELETE` | `/api/v1/workbooks/{id}/collaborators/{userId}` | Remove collaborator |
| `GET` | `/api/v1/workbooks/{id}/collaborators` | List collaborator user IDs |

Table `workbook_collaborators`:
```sql
CREATE TABLE workbook_collaborators (
    workbook_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (workbook_id, user_id)
);
```

### Frontend

- **Share button** (🔒/🌐) in the header toolbar — opens `ShareDialog`
- **ShareDialog** (`components/ShareDialog/ShareDialog.tsx`):
  - 4 radio buttons for access mode selection (optimistic local state + single API call)
  - Invite by User ID input (shown only in `collaborators` mode)
  - Collaborator list with remove button (shown only in `collaborators` mode)
  - Owner badge display
  - Current User ID display
- Access mode selection sends one API call: `{ private, access_mode }` simultaneously
- Radio buttons update instantly via local `selectedMode` state, synced from props via `useEffect`

### Store Methods

- `store.AddCollaborator(workbookID, userID, role)`
- `store.RemoveCollaborator(workbookID, userID)`
- `store.GetCollaborators(workbookID) → []string`

### File Locations

- `backend/internal/model/types.go` — struct + constants
- `backend/internal/ws/hub.go` — join auth logic + `isAgentUser()`
- `backend/internal/api/workbook.go` — update handler
- `frontend/src/components/ShareDialog/ShareDialog.tsx` — UI
- `frontend/src/components/MindMap/MindMap.tsx` — callbacks `handleTogglePrivate`, `handleChangeAccessMode`
- `frontend/src/types/api.ts` — `access_mode?: string` field
