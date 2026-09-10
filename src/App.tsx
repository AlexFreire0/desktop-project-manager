import { useEffect, useMemo, useState } from 'react';
import type { AppData, GitInfo, Project, ProjectPart, QuickCommand, Settings } from './types';

const colors = ['#8b7cff', '#34d399', '#f59e0b', '#38bdf8', '#fb7185', '#a78bfa'];
const emptySettings: Settings = { defaultEditor: 'code', defaultTerminal: '', confirmCommands: true, showHiddenProjects: false, compactCards: false };
const starterData: AppData = { projects: [], quickCommands: [], settings: emptySettings };

type View = 'overview' | 'projects' | 'commands' | 'settings';
type Notice = { kind: 'success' | 'error' | 'info'; text: string };

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function App() {
  const [data, setData] = useState<AppData>(starterData);
  const [view, setView] = useState<View>('overview');
  const [selectedId, setSelectedId] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const [loading, setLoading] = useState(true);
  const [projectDialog, setProjectDialog] = useState<Project | 'new' | null>(null);
  const [commandDialog, setCommandDialog] = useState<QuickCommand | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'recent'>('all');
  const [sort, setSort] = useState<'updated' | 'name' | 'created'>('updated');

  useEffect(() => {
    window.desktop.getData().then(setData).catch(() => showNotice('error', 'Could not load local data.')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) window.desktop.saveData(data).catch(() => showNotice('error', 'Could not save changes.'));
  }, [data, loading]);

  function showNotice(kind: Notice['kind'], text: string) {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(undefined), 3500);
  }

  function updateData(patch: Partial<AppData>) {
    setData((current) => ({ ...current, ...patch }));
  }

  const selected = data.projects.find((project) => project.id === selectedId);
  const recent = useMemo(() => [...data.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3), [data.projects]);

  const visibleProjects = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return data.projects
      .filter((project) => data.settings.showHiddenProjects || !project.name.startsWith('.'))
      .filter((project) => filter !== 'favorites' || project.favorite)
      .filter((project) => filter !== 'recent' || recent.some((item) => item.id === project.id))
      .filter((project) => !normalized || `${project.name} ${project.description} ${project.path}`.toLowerCase().includes(normalized))
      .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt));
  }, [data.projects, data.settings.showHiddenProjects, filter, query, recent, sort]);

  function saveProject(project: Project) {
    const exists = data.projects.some((item) => item.id === project.id);
    updateData({ projects: exists ? data.projects.map((item) => item.id === project.id ? project : item) : [project, ...data.projects] });
    setProjectDialog(null);
    setSelectedId(project.id);
    showNotice('success', exists ? 'Project updated' : 'Project added to your desk');
  }

  function deleteProject(project: Project) {
    if (!window.confirm(`Remove “${project.name}” from Project Desk? Files on disk will not be touched.`)) return;
    updateData({ projects: data.projects.filter((item) => item.id !== project.id), quickCommands: data.quickCommands.map((command) => command.projectId === project.id ? { ...command, projectId: undefined } : command) });
    if (selectedId === project.id) setSelectedId(undefined);
    showNotice('success', 'Project removed. Your files were not changed.');
  }

  function saveCommand(command: QuickCommand) {
    const exists = data.quickCommands.some((item) => item.id === command.id);
    updateData({ quickCommands: exists ? data.quickCommands.map((item) => item.id === command.id ? command : item) : [...data.quickCommands, command] });
    setCommandDialog(null);
    showNotice('success', exists ? 'Command updated' : 'Quick command saved');
  }

  async function executeCommand(command: QuickCommand) {
    if (data.settings.confirmCommands && !window.confirm(`Run “${command.name}”?\n\n${command.command} ${command.args.join(' ')}`)) return;
    try {
      await window.desktop.runCommand(command.command, command.args, command.cwd || selected?.path);
      showNotice('success', `Started ${command.name}`);
    } catch {
      showNotice('error', `Could not start ${command.name}`);
    }
  }

  if (loading) return <div className="loading-screen"><div className="brand-mark">⌘</div><span>Loading your workspace…</span></div>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">⌘</div><div><strong>Project Desk</strong><small>Developer workspace</small></div></div>
        <nav>
          <NavItem icon="⌂" label="Overview" active={view === 'overview'} onClick={() => setView('overview')} />
          <NavItem icon="▦" label="All projects" count={data.projects.length} active={view === 'projects'} onClick={() => setView('projects')} />
          <NavItem icon="✦" label="Favorites" count={data.projects.filter((project) => project.favorite).length} active={view === 'projects' && filter === 'favorites'} onClick={() => { setView('projects'); setFilter('favorites'); }} />
          <NavItem icon="↯" label="Quick commands" count={data.quickCommands.length} active={view === 'commands'} onClick={() => setView('commands')} />
        </nav>
        <div className="sidebar-footer"><button className="nav-item" onClick={() => setView('settings')}><span className="nav-icon">⚙</span>Settings</button><div className="safe-note"><span className="pulse-dot" /> Local-first &amp; safe</div></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{view === 'overview' ? 'Overview' : view === 'projects' ? 'Projects' : view === 'commands' ? 'Quick commands' : 'Settings'}</strong></div><div className="top-actions"><button className="icon-button" title="Open project folder" onClick={() => window.desktop.chooseFolder().then((folder) => folder && setProjectDialog({ id: uid(), name: '', path: folder, description: '', color: colors[0], favorite: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), parts: [] }))}>＋</button><div className="avatar">AF</div></div></header>
        {notice && <div className={`notice ${notice.kind}`}><span>{notice.kind === 'success' ? '✓' : notice.kind === 'error' ? '!' : 'i'}</span>{notice.text}</div>}
        {view === 'overview' && <Overview projects={data.projects} recent={recent} commands={data.quickCommands} onNavigate={setView} onSelect={(id) => { setSelectedId(id); setView('projects'); }} onRun={executeCommand} onAdd={() => setProjectDialog('new')} />}
        {view === 'projects' && <ProjectsView projects={visibleProjects} allCount={data.projects.length} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} compact={data.settings.compactCards} selectedId={selectedId} onSelect={setSelectedId} onAdd={() => setProjectDialog('new')} onEdit={setProjectDialog} onDelete={deleteProject} onToggleFavorite={(project) => saveProject({ ...project, favorite: !project.favorite, updatedAt: new Date().toISOString() })} />}
        {view === 'commands' && <CommandsView commands={data.quickCommands} projects={data.projects} onAdd={() => setCommandDialog('new')} onEdit={setCommandDialog} onDelete={(command) => updateData({ quickCommands: data.quickCommands.filter((item) => item.id !== command.id) })} onRun={executeCommand} onMove={(index, direction) => { const commands = [...data.quickCommands]; const next = index + direction; if (next < 0 || next >= commands.length) return; [commands[index], commands[next]] = [commands[next], commands[index]]; updateData({ quickCommands: commands }); }} />}
        {view === 'settings' && <SettingsView settings={data.settings} onChange={(settings) => updateData({ settings })} onReset={() => { if (window.confirm('Reset settings to defaults?')) updateData({ settings: emptySettings }); }} />}
      </main>
      {selected && view === 'projects' && <ProjectDrawer project={selected} settings={data.settings} onClose={() => setSelectedId(undefined)} onEdit={() => setProjectDialog(selected)} onSave={saveProject} onNotice={showNotice} />}
      {projectDialog && <ProjectDialog initial={projectDialog === 'new' ? undefined : projectDialog} onClose={() => setProjectDialog(null)} onSave={saveProject} />}
      {commandDialog && <CommandDialog initial={commandDialog === 'new' ? undefined : commandDialog} projects={data.projects} onClose={() => setCommandDialog(null)} onSave={saveCommand} />}
    </div>
  );
}

function NavItem({ icon, label, count, active, onClick }: { icon: string; label: string; count?: number; active: boolean; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><span className="nav-icon">{icon}</span>{label}{count !== undefined && <span className="nav-count">{count}</span>}</button>;
}

function Overview({ projects, recent, commands, onNavigate, onSelect, onRun, onAdd }: { projects: Project[]; recent: Project[]; commands: QuickCommand[]; onNavigate: (view: View) => void; onSelect: (id: string) => void; onRun: (command: QuickCommand) => void; onAdd: () => void }) {
  return <div className="page"><div className="hero"><div><p className="eyebrow">Thursday, September 10</p><h1>Good evening, Alex <span>✦</span></h1><p className="muted">Your workspace, organized around the way you build.</p></div><button className="primary-button" onClick={onAdd}>＋ Add project</button></div>
    <div className="stats-grid"><Stat label="Total projects" value={projects.length} accent="purple" icon="▦" /><Stat label="Favorites" value={projects.filter((p) => p.favorite).length} accent="amber" icon="✦" /><Stat label="Quick commands" value={commands.length} accent="blue" icon="↯" /><Stat label="Active this week" value={recent.length} accent="green" icon="◷" /></div>
    <div className="section-heading"><div><h2>Recently opened</h2><p className="muted">Jump back into your latest work</p></div><button className="text-button" onClick={() => onNavigate('projects')}>View all <span>→</span></button></div>
    {recent.length ? <div className="project-grid">{recent.map((project) => <ProjectCard key={project.id} project={project} onClick={() => onSelect(project.id)} />)}</div> : <EmptyState title="Your workspace is ready" text="Add your first project to keep folders, git status, and commands together." action="Add your first project" onAction={onAdd} />}
    <div className="section-heading command-heading"><div><h2>Quick launch</h2><p className="muted">Your frequently used workflows</p></div><button className="text-button" onClick={() => onNavigate('commands')}>Manage commands <span>→</span></button></div>
    <div className="launch-row">{commands.slice(0, 4).map((command) => <button className="launch-card" key={command.id} onClick={() => onRun(command)}><span className="command-icon" style={{ background: command.color || '#27283d' }}>›_</span><span><strong>{command.name}</strong><small>{command.command} {command.args.join(' ')}</small></span><span className="launch-arrow">↗</span></button>)}{!commands.length && <button className="launch-card add-launch" onClick={() => onNavigate('commands')}><span className="command-icon">＋</span><span><strong>Create a quick command</strong><small>Save your everyday workflow</small></span></button>}</div>
  </div>;
}

function Stat({ label, value, accent, icon }: { label: string; value: number; accent: string; icon: string }) { return <div className="stat-card"><div className={`stat-icon ${accent}`}>{icon}</div><div><strong>{value}</strong><span>{label}</span></div><i>↗</i></div>; }

function ProjectsView({ projects, allCount, query, setQuery, filter, setFilter, sort, setSort, compact, selectedId, onSelect, onAdd, onEdit, onDelete, onToggleFavorite }: { projects: Project[]; allCount: number; query: string; setQuery: (value: string) => void; filter: 'all' | 'favorites' | 'recent'; setFilter: (value: 'all' | 'favorites' | 'recent') => void; sort: 'updated' | 'name' | 'created'; setSort: (value: 'updated' | 'name' | 'created') => void; compact: boolean; selectedId?: string; onSelect: (id: string) => void; onAdd: () => void; onEdit: (project: Project) => void; onDelete: (project: Project) => void; onToggleFavorite: (project: Project) => void }) {
  return <div className="page"><div className="page-title"><div><p className="eyebrow">Workspace library</p><h1>All projects <span className="title-count">{allCount}</span></h1></div><button className="primary-button" onClick={onAdd}>＋ New project</button></div><div className="toolbar"><label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects, paths, descriptions…" /><kbd>⌘ K</kbd></label><div className="filter-group">{(['all', 'favorites', 'recent'] as const).map((item) => <button key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item === 'favorites' ? '✦ ' : ''}{item[0].toUpperCase() + item.slice(1)}</button>)}</div><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="updated">Recently updated</option><option value="name">Name A–Z</option><option value="created">Recently added</option></select></div>{projects.length ? <div className={`project-grid ${compact ? 'compact' : ''}`}>{projects.map((project) => <ProjectCard key={project.id} project={project} selected={selectedId === project.id} onClick={() => onSelect(project.id)} onEdit={() => onEdit(project)} onDelete={() => onDelete(project)} onFavorite={() => onToggleFavorite(project)} />)}</div> : <EmptyState title="No projects found" text={query ? 'Try a different search or clear your filters.' : 'Add a folder to start building your workspace.'} action="Add project" onAction={onAdd} />}</div>;
}

function ProjectCard({ project, selected, onClick, onEdit, onDelete, onFavorite }: { project: Project; selected?: boolean; onClick: () => void; onEdit?: () => void; onDelete?: () => void; onFavorite?: () => void }) {
  const [git, setGit] = useState<GitInfo>();
  useEffect(() => { window.desktop.inspectGit(project.path).then(setGit).catch(() => setGit({ isRepo: false, changes: 0, ahead: 0, behind: 0 })); }, [project.path]);
  return <article className={`project-card ${selected ? 'selected' : ''}`} onClick={onClick}><div className="card-top"><span className="folder-icon" style={{ background: `${project.color}20`, color: project.color }}>⌁</span><div className="card-actions" onClick={(event) => event.stopPropagation()}>{onFavorite && <button title="Favorite" className={project.favorite ? 'favorite active' : 'favorite'} onClick={onFavorite}>★</button>}<button title="Edit" onClick={onEdit}>···</button></div></div><h3>{project.name || 'Unnamed project'}</h3><p className="path">{project.path || 'No folder selected'}</p><p className="description">{project.description || 'No description yet'}</p><div className="card-footer"><span className={git?.isRepo ? 'git-status' : 'git-status muted-status'}><i />{git?.isRepo ? git.branch || 'git repo' : 'Not a git repo'}</span>{git?.isRepo && git.changes > 0 && <span className="changes">{git.changes} change{git.changes === 1 ? '' : 's'}</span>}<span className="last-updated">{formatDate(project.updatedAt)}</span></div>{onDelete && <button className="delete-card" onClick={(event) => { event.stopPropagation(); onDelete(); }}>Remove</button>}</article>;
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) { return <div className="empty-state"><div className="empty-icon">⌁</div><h3>{title}</h3><p>{text}</p><button className="secondary-button" onClick={onAction}>{action}</button></div>; }

function ProjectDrawer({ project, settings, onClose, onEdit, onSave, onNotice }: { project: Project; settings: Settings; onClose: () => void; onEdit: () => void; onSave: (project: Project) => void; onNotice: (kind: Notice['kind'], text: string) => void }) {
  const [git, setGit] = useState<GitInfo>();
  const [gitBusy, setGitBusy] = useState(false);
  const [gitOutput, setGitOutput] = useState('');
  useEffect(() => { window.desktop.inspectGit(project.path).then(setGit); }, [project.path]);
  async function gitAction(action: 'status' | 'add' | 'commit' | 'fetch' | 'pull' | 'push' | 'checkout' | 'branch', value?: string) {
    const requiresConfirmation = action === 'add' || action === 'commit' || action === 'pull' || action === 'push' || action === 'checkout' || action === 'branch';
    if (requiresConfirmation && !window.confirm(`${action[0].toUpperCase() + action.slice(1)} this repository? This runs a git command in the selected folder.`)) return;
    setGitBusy(true);
    const result = await window.desktop.gitAction(action, project.path, value);
    setGitBusy(false);
    setGitOutput(result.output || `${action} completed`);
    onNotice(result.ok ? 'success' : 'error', result.ok ? `${action} completed` : result.output);
    if (result.ok) setGit(await window.desktop.inspectGit(project.path));
  }
  async function commitAndPush() {
    const message = window.prompt('Commit message', 'Update project');
    if (!message?.trim()) return;
    if (!window.confirm(`Create commit "${message.trim()}" and push it to the remote?`)) return;
    await gitAction('add');
    const commit = await window.desktop.gitAction('commit', project.path, message.trim());
    setGitOutput(commit.output);
    if (!commit.ok) {
      onNotice('error', commit.output);
      return;
    }
    if (window.confirm('Commit created. Push it to the remote now?')) await gitAction('push');
  }
  function addPart() {
    const name = window.prompt('Part name', 'New part');
    if (!name?.trim()) return;
    const path = window.prompt('Part folder path', project.path);
    if (!path?.trim()) return;
    const part: ProjectPart = { id: uid(), name: name.trim(), path: path.trim(), notes: '' };
    onSave({ ...project, parts: [...project.parts, part], updatedAt: new Date().toISOString() });
  }
  function editPart(part: ProjectPart) {
    const name = window.prompt('Part name', part.name);
    if (!name?.trim()) return;
    const path = window.prompt('Part folder path', part.path);
    if (!path?.trim()) return;
    onSave({ ...project, parts: project.parts.map((item) => item.id === part.id ? { ...item, name: name.trim(), path: path.trim() } : item), updatedAt: new Date().toISOString() });
  }
  function removePart(part: ProjectPart) {
    if (!window.confirm(`Remove “${part.name}” from this project?`)) return;
    onSave({ ...project, parts: project.parts.filter((item) => item.id !== part.id), updatedAt: new Date().toISOString() });
  }
  return <aside className="drawer"><div className="drawer-header"><span className="eyebrow">Project details</span><button className="close-button" onClick={onClose}>×</button></div><div className="drawer-title"><span className="folder-icon large" style={{ background: `${project.color}20`, color: project.color }}>⌁</span><div><h2>{project.name}</h2><p>{project.path}</p></div></div><div className="drawer-actions"><button className="primary-button" onClick={() => window.desktop.openEditor(project.path, settings.defaultEditor)}>Open in editor</button><button className="secondary-button" onClick={() => window.desktop.openTerminal(project.path, settings.defaultTerminal)}>Terminal</button></div><div className="detail-section"><div className="section-label">Repository <span>{git?.isRepo ? 'Detected' : 'Not detected'}</span></div>{git?.isRepo ? <><div className="repo-banner"><span className="git-logo">⌘</span><div><strong>{git.branch}</strong><small>{git.lastCommit || 'No commits yet'}</small></div><span className={git.changes ? 'repo-alert' : 'repo-clean'}>{git.changes ? `${git.changes} changes` : 'Clean'}</span></div><div className="git-actions"><button disabled={gitBusy} onClick={() => gitAction('status')}>Status</button><button disabled={gitBusy} onClick={() => gitAction('add')}>Stage all</button><button disabled={gitBusy} onClick={() => gitAction('commit', window.prompt('Commit message', 'Update project') || undefined)}>Commit</button><button disabled={gitBusy} onClick={commitAndPush}>Commit + push</button></div><div className="git-actions"><button disabled={gitBusy} onClick={() => gitAction('fetch')}>↙ Fetch</button><button disabled={gitBusy} onClick={() => gitAction('pull')}>↓ Pull</button><button disabled={gitBusy} onClick={() => gitAction('push')}>↑ Push</button><button disabled={gitBusy} onClick={() => gitAction('checkout', window.prompt('Branch to checkout'))}>Checkout</button><button disabled={gitBusy} onClick={() => gitAction('branch', window.prompt('New branch name'))}>New branch</button></div>{gitOutput && <pre className="git-output">{gitOutput}</pre>}</> : <p className="muted small">Initialize Git yourself when you are ready. Project Desk will never run destructive actions automatically.</p>}</div><div className="detail-section"><div className="section-label">Project parts <button className="mini-button" onClick={addPart}>＋ Add</button></div>{project.parts.length ? project.parts.map((part) => <div className="part-row" key={part.id}><span>◈</span><div><strong>{part.name}</strong><small>{part.path}</small></div><button title="Open folder" onClick={() => window.desktop.openPath(part.path)}>↗</button><button title="Edit part" onClick={() => editPart(part)}>✎</button><button title="Remove part" onClick={() => removePart(part)}>×</button></div>) : <p className="muted small">Add related folders or services to keep your workspace map close.</p>}</div><div className="drawer-bottom"><button className="text-button" onClick={onEdit}>Edit project details →</button><span>Added {formatDate(project.createdAt)}</span></div></aside>;
}

function CommandsView({ commands, projects, onAdd, onEdit, onDelete, onRun, onMove }: { commands: QuickCommand[]; projects: Project[]; onAdd: () => void; onEdit: (command: QuickCommand) => void; onDelete: (command: QuickCommand) => void; onRun: (command: QuickCommand) => void; onMove: (index: number, direction: number) => void }) {
  return <div className="page"><div className="page-title"><div><p className="eyebrow">Automation shelf</p><h1>Quick commands <span className="title-count">{commands.length}</span></h1><p className="muted">Launch safe, repeatable workflows without remembering flags.</p></div><button className="primary-button" onClick={onAdd}>＋ New command</button></div><div className="command-list">{commands.map((command, index) => <div className="command-row" key={command.id}><span className="drag-handle">⠿</span><span className="command-icon" style={{ background: command.color || '#27283d' }}>›_</span><div className="command-info"><strong>{command.name}</strong><code>{command.command} {command.args.join(' ')}</code><small>{command.projectId ? projects.find((project) => project.id === command.projectId)?.name || 'Unlinked project' : 'Available everywhere'}{command.cwd ? ` · ${command.cwd}` : ''}</small></div><div className="row-actions"><button title="Move up" onClick={() => onMove(index, -1)}>↑</button><button title="Move down" onClick={() => onMove(index, 1)}>↓</button><button title="Edit" onClick={() => onEdit(command)}>Edit</button><button className="run-button" onClick={() => onRun(command)}>Run ↗</button><button className="danger-button" title="Delete" onClick={() => onDelete(command)}>×</button></div></div>)}{!commands.length && <EmptyState title="Build your command shelf" text="Save scripts, dev servers, and other repeatable workflows here." action="Create command" onAction={onAdd} />}</div></div>;
}

function SettingsView({ settings, onChange, onReset }: { settings: Settings; onChange: (settings: Settings) => void; onReset: () => void }) {
  return <div className="page narrow-page"><div className="page-title"><div><p className="eyebrow">Workspace preferences</p><h1>Settings</h1><p className="muted">Project Desk stores everything locally on this computer.</p></div></div><section className="settings-card"><SettingGroup title="Tools" description="Choose the apps used by your project actions."><label className="setting-field"><span>Editor command</span><small>Usually <code>code</code>, <code>cursor</code>, or an absolute path.</small><input value={settings.defaultEditor} onChange={(event) => onChange({ ...settings, defaultEditor: event.target.value })} /></label><label className="setting-field"><span>Terminal command <em>optional</em></span><small>Leave blank to use the operating system default.</small><input value={settings.defaultTerminal} onChange={(event) => onChange({ ...settings, defaultTerminal: event.target.value })} placeholder="Use system default" /></label></SettingGroup><SettingGroup title="Safety & display" description="Keep automation predictable and your desk comfortable."><Toggle label="Confirm quick commands before running" checked={settings.confirmCommands} onChange={(checked) => onChange({ ...settings, confirmCommands: checked })} /><Toggle label="Show hidden projects" checked={settings.showHiddenProjects} onChange={(checked) => onChange({ ...settings, showHiddenProjects: checked })} /><Toggle label="Use compact project cards" checked={settings.compactCards} onChange={(checked) => onChange({ ...settings, compactCards: checked })} /></SettingGroup></section><div className="settings-footer"><span>Changes save automatically to your local data file.</span><button className="text-button danger-text" onClick={onReset}>Reset settings</button></div></div>;
}

function SettingGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <div className="setting-group"><div className="setting-heading"><h3>{title}</h3><p>{description}</p></div>{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="toggle-row"><span>{label}</span><button className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked}><i /></button></label>; }

function ProjectDialog({ initial, onClose, onSave }: { initial?: Project; onClose: () => void; onSave: (project: Project) => void }) {
  const [form, setForm] = useState<Project>(initial || { id: uid(), name: '', path: '', description: '', color: colors[Math.floor(Math.random() * colors.length)], favorite: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), parts: [] });
  const choosePath = () => window.desktop.chooseFolder().then((path) => path && setForm((current) => ({ ...current, path })));
  return <Modal title={initial ? 'Edit project' : 'Add a project'} onClose={onClose} onSubmit={() => { if (!form.name.trim() || !form.path.trim()) return; onSave({ ...form, name: form.name.trim(), updatedAt: new Date().toISOString() }); }} submitLabel={initial ? 'Save changes' : 'Add project'}><label className="modal-field"><span>Project name</span><input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Marketing website" /></label><label className="modal-field"><span>Folder path</span><div className="input-with-button"><input value={form.path} onChange={(event) => setForm({ ...form, path: event.target.value })} placeholder="Choose a local folder" /><button type="button" onClick={choosePath}>Browse</button></div></label><label className="modal-field"><span>Description <em>optional</em></span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What are you building?" rows={3} /></label><label className="modal-field"><span>Accent color</span><div className="color-options">{colors.map((color) => <button type="button" key={color} className={form.color === color ? 'chosen' : ''} style={{ background: color }} onClick={() => setForm({ ...form, color })} />)}</div></label><label className="check-row"><input type="checkbox" checked={form.favorite} onChange={(event) => setForm({ ...form, favorite: event.target.checked })} /> Add to favorites</label></Modal>;
}

function CommandDialog({ initial, projects, onClose, onSave }: { initial?: QuickCommand; projects: Project[]; onClose: () => void; onSave: (command: QuickCommand) => void }) {
  const [form, setForm] = useState<QuickCommand>(initial || { id: uid(), name: '', command: '', args: [], projectId: undefined, cwd: '', color: '#8b7cff' });
  const [argsText, setArgsText] = useState(initial?.args.join(' ') || '');
  return <Modal title={initial ? 'Edit quick command' : 'Create quick command'} onClose={onClose} onSubmit={() => { if (!form.name.trim() || !form.command.trim()) return; onSave({ ...form, name: form.name.trim(), command: form.command.trim(), args: argsText.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((item) => item.replace(/^"(.*)"$/, '$1')) || [] }); }} submitLabel={initial ? 'Save changes' : 'Create command'}><p className="modal-tip">Commands run directly without a shell, so arguments stay safely separated from executable names.</p><label className="modal-field"><span>Name</span><input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Start development server" /></label><label className="modal-field"><span>Executable</span><input value={form.command} onChange={(event) => setForm({ ...form, command: event.target.value })} placeholder="npm" /></label><label className="modal-field"><span>Arguments <em>space separated; quote values with spaces</em></span><input value={argsText} onChange={(event) => setArgsText(event.target.value)} placeholder="run dev" /></label><div className="form-columns"><label className="modal-field"><span>Associated project</span><select value={form.projectId || ''} onChange={(event) => setForm({ ...form, projectId: event.target.value || undefined })}><option value="">Any project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="modal-field"><span>Working directory <em>optional</em></span><input value={form.cwd || ''} onChange={(event) => setForm({ ...form, cwd: event.target.value })} placeholder="Use project folder" /></label></div></Modal>;
}

function Modal({ title, children, onClose, onSubmit, submitLabel }: { title: string; children: React.ReactNode; onClose: () => void; onSubmit: () => void; submitLabel: string }) { return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal"><div className="modal-header"><h2>{title}</h2><button className="close-button" onClick={onClose}>×</button></div><form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>{children}<div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">{submitLabel}</button></div></form></div></div>; }

export default App;
