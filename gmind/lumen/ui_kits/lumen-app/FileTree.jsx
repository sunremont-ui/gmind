function FileTree() {
  const [open, setOpen] = React.useState({ root: true, sessions: true, archive: false });
  const Folder = ({ id, label, children, depth = 0 }) => (
    <div>
      <div onClick={() => setOpen(o => ({ ...o, [id]: !o[id] }))} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "5px 8px",
        borderRadius: 6, cursor: "pointer", paddingLeft: 8 + depth * 14,
      }}>
        <i data-lucide={open[id] ? "chevron-down" : "chevron-right"} style={{ width: 14, height: 14, color: "var(--color-fg-muted)" }} />
        <i data-lucide="folder" style={{ width: 16, height: 16, color: "var(--color-primary)" }} />
        <span style={{ fontWeight: 600, font: "500 13px 'Inter'" }}>{label}</span>
      </div>
      {open[id] && <div>{children}</div>}
    </div>
  );
  const File = ({ icon = "file", label, badge, active, depth = 1 }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, padding: "5px 8px",
      borderRadius: 6, cursor: "pointer", paddingLeft: 8 + depth * 14 + 14,
      background: active ? "var(--color-primary-soft)" : "transparent",
      color: active ? "var(--color-primary)" : "var(--color-fg)",
    }}>
      <i data-lucide={icon} style={{ width: 16, height: 16, color: active ? "var(--color-primary)" : "var(--color-fg-muted)" }} />
      <span style={{ font: active ? "600 13px 'Inter'" : "500 13px 'Inter'", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      {badge && <span style={{ font: "500 11px 'JetBrains Mono'", color: "var(--color-fg-subtle)" }}>{badge}</span>}
    </div>
  );
  return (
    <div style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: 14, padding: 16, boxShadow: "var(--shadow-sm)", height: "100%" }}>
      <div className="lds-eyebrow" style={{ marginBottom: 8 }}>Library</div>
      <Folder id="root" label="Lumen Studio">
        <Folder id="sessions" label="Sessions" depth={1}>
          <File label="Aurora — slow take.wav" icon="audio-waveform" badge="24.8 MB" active depth={2} />
          <File label="Late drift — rough.wav" icon="audio-waveform" badge="18.1 MB" depth={2} />
          <File label="Northern lights — ep02.mp4" icon="video" badge="412 MB" depth={2} />
        </Folder>
        <Folder id="archive" label="Archive" depth={1} />
        <File label="cover-art.png" icon="image" badge="2.3 MB" />
        <File label="release-notes.md" icon="file-text" />
      </Folder>
    </div>
  );
}
window.FileTree = FileTree;
