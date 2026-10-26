import React, { useEffect, useRef, useState } from 'react';
import {
  FolderOpen,
  Plus,
  Upload,
  Copy,
  Trash2,
  Download,
  Pencil,
  Check,
  X,
  LayoutTemplate,
} from 'lucide-react';
import {
  StoredProject,
  deleteProject,
  duplicateProject,
  exportProjectFile,
  formatRelativeTime,
  getAllProjects,
  importProjectFromFile,
  saveProject,
} from '../utils/projectStorage';
import { LOGO_TEMPLATES, LogoTemplate } from '../data/templates';
import { generateProjectThumbnailSvg } from '../utils/thumbnailGenerator';
import { Button, Chip, IconButton, Sheet } from './ui/primitives';

interface ProjectsSheetProps {
  open: boolean;
  onClose: () => void;
  currentProjectId: string;
  onOpenProject: (project: StoredProject) => void;
  onCreateNewProject: () => void;
  onOpenTemplate: (template: LogoTemplate) => void;
}

type Tab = 'projects' | 'blueprints';

export const ProjectsSheet: React.FC<ProjectsSheetProps> = ({
  open,
  onClose,
  currentProjectId,
  onOpenProject,
  onCreateNewProject,
  onOpenTemplate,
}) => {
  const [tab, setTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    getAllProjects()
      .then((all) => {
        if (alive) setProjects(all);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const imported = await importProjectFromFile(file);
      setProjects((prev) => [imported, ...prev]);
      onOpenProject(imported);
      onClose();
    } catch {
      setError('That file could not be read as a Pentix project.');
    }
  };

  const commitRename = async (project: StoredProject) => {
    const name = renameValue.trim();
    if (name && name !== project.name) {
      const updated = { ...project, name };
      await saveProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, name } : p)));
    }
    setRenamingId(null);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Projects"
      eyebrow="Local library"
      subtitle="Everything is stored on this device."
      size="lg"
      action={
        <IconButton label="Import project file" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload size={15} />
        </IconButton>
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".pentix,.json,application/json"
        className="hidden"
        onChange={(e) => {
          void handleImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className="flex items-center gap-1.5">
        <Chip active={tab === 'projects'} icon={<FolderOpen size={13} />} onClick={() => setTab('projects')}>
          Saved ({projects.length})
        </Chip>
        <Chip
          active={tab === 'blueprints'}
          icon={<LayoutTemplate size={13} />}
          onClick={() => setTab('blueprints')}
        >
          Blueprints ({LOGO_TEMPLATES.length})
        </Chip>
      </div>

      {error && <p className="mt-2 text-[11.5px] text-danger">{error}</p>}

      {tab === 'projects' ? (
        <div className="mt-3 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              onCreateNewProject();
              onClose();
            }}
            className="press flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-3 py-3 text-left hover:border-accent/50"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-ink-2 text-accent">
              <Plus size={17} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-text">New document</span>
              <span className="block text-[11px] text-mute">A clean 600 × 600 artboard</span>
            </span>
          </button>

          {loading && <p className="px-1 py-6 text-center text-[12px] text-mute">Loading…</p>}

          {!loading && projects.length === 0 && (
            <p className="rounded-xl border border-line px-3 py-4 text-[12px] leading-relaxed text-mute">
              No saved documents yet. Whatever you draw is saved to this device automatically, and
              it appears here under its own name.
            </p>
          )}

          {projects.map((project) => {
            const isCurrent = project.id === currentProjectId;
            const isRenaming = renamingId === project.id;
            const confirming = confirmDeleteId === project.id;
            return (
              <div
                key={project.id}
                className={`overflow-hidden rounded-xl border ${
                  isCurrent ? 'border-accent/50' : 'border-line'
                } bg-ink-2`}
              >
                <div className="flex gap-3 p-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenProject(project);
                      onClose();
                    }}
                    className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-0 [&>svg]:h-full [&>svg]:w-full"
                    aria-label={`Open ${project.name}`}
                  >
                    <div
                      className="h-full w-full"
                      dangerouslySetInnerHTML={{
                        __html:
                          project.thumbnailSvg || generateProjectThumbnailSvg(project.layers),
                      }}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    {isRenaming ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void commitRename(project);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-accent/60 bg-ink-0 px-2 text-[12px] font-semibold text-text outline-none"
                        />
                        <IconButton label="Save name" size="sm" onClick={() => void commitRename(project)}>
                          <Check size={13} />
                        </IconButton>
                        <IconButton label="Cancel" size="sm" onClick={() => setRenamingId(null)}>
                          <X size={13} />
                        </IconButton>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenProject(project);
                          onClose();
                        }}
                        className="block w-full truncate text-left text-[13px] font-semibold text-text"
                      >
                        {project.name}
                      </button>
                    )}
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-mute">
                      <span>{formatRelativeTime(project.updatedAt)}</span>
                      <span>·</span>
                      <span>{project.pathsCount ?? project.layers.reduce((s, l) => s + l.paths.length, 0)} paths</span>
                      {isCurrent && <span className="text-accent">· open</span>}
                    </div>

                    <div className="mt-1.5 flex items-center gap-0.5">
                      <IconButton
                        label="Rename"
                        size="sm"
                        onClick={() => {
                          setRenameValue(project.name);
                          setRenamingId(project.id);
                        }}
                      >
                        <Pencil size={12} />
                      </IconButton>
                      <IconButton
                        label="Duplicate"
                        size="sm"
                        onClick={async () => {
                          const cloned = await duplicateProject(project.id);
                          setProjects((prev) => [cloned, ...prev]);
                        }}
                      >
                        <Copy size={12} />
                      </IconButton>
                      <IconButton
                        label="Export project file"
                        size="sm"
                        onClick={() => exportProjectFile(project)}
                      >
                        <Download size={12} />
                      </IconButton>
                      <span className="flex-1" />
                      <IconButton
                        label="Delete"
                        size="sm"
                        tone="danger"
                        onClick={() => setConfirmDeleteId(confirming ? null : project.id)}
                      >
                        <Trash2 size={12} />
                      </IconButton>
                    </div>
                  </div>
                </div>

                {confirming && (
                  <div className="flex items-center justify-between gap-2 border-t border-line bg-danger/10 px-3 py-2">
                    <span className="text-[11.5px] font-semibold text-danger">Delete forever?</span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={async () => {
                          await deleteProject(project.id);
                          setProjects((prev) => prev.filter((p) => p.id !== project.id));
                          setConfirmDeleteId(null);
                        }}
                      >
                        Delete
                      </Button>
                      <Button size="sm" variant="quiet" onClick={() => setConfirmDeleteId(null)}>
                        Keep
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {LOGO_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                onOpenTemplate(template);
                onClose();
              }}
              className="press flex gap-3 overflow-hidden rounded-xl border border-line bg-ink-2 p-2.5 text-left hover:border-accent/40"
            >
              <span className="h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-0">
                <span
                  className="block h-full w-full [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: generateProjectThumbnailSvg(template.layers) }}
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-semibold text-text">
                  {template.name}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-mute">
                  {template.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
};
