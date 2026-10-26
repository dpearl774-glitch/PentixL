import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  FolderOpen,
  Copy,
  Trash2,
  Download,
  Upload,
  Clock,
  Layers,
  Sparkles,
  Check,
  Edit2,
  Search,
  LayoutTemplate,
  Save,
} from 'lucide-react';
import {
  StoredProject,
  getAllProjects,
  deleteProject,
  duplicateProject,
  saveProject,
  exportProjectFile,
  importProjectFromFile,
  formatRelativeTime,
} from '../utils/projectStorage';
import { Layer, CanvasView } from '../types/vector';
import { LOGO_TEMPLATES } from '../data/templates';
import { generateProjectThumbnailSvg } from '../utils/thumbnailGenerator';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId?: string;
  onOpenProject: (project: StoredProject) => void;
  onCreateNewProject: () => void;
  onSaveCurrentAsProject?: () => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  currentProjectId,
  onOpenProject,
  onCreateNewProject,
  onSaveCurrentAsProject,
}) => {
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'projects' | 'blueprints'>('projects');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const all = await getAllProjects();
      setProjects(all);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartRename = (proj: StoredProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(proj.id);
    setRenameValue(proj.name);
  };

  const handleSaveRename = async (proj: StoredProject) => {
    if (renameValue.trim() && renameValue !== proj.name) {
      const updated = { ...proj, name: renameValue.trim(), updatedAt: Date.now() };
      await saveProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === proj.id ? updated : p)));
    }
    setRenamingId(null);
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const cloned = await duplicateProject(id);
      setProjects((prev) => [cloned, ...prev]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = (proj: StoredProject, e: React.MouseEvent) => {
    e.stopPropagation();
    exportProjectFile(proj);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importProjectFromFile(file);
      setProjects((prev) => [imported, ...prev]);
      onOpenProject(imported);
      onClose();
    } catch (err) {
      alert('Could not import project. Please ensure it is a valid .pentix or JSON file.');
      console.error(err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-slate-100">
        {/* Top Header */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-mono font-black text-slate-950 text-sm">
              P
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Pentix Studio</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-mono px-2 py-0.5 rounded-full border border-cyan-500/30">
                  IndexedDB Storage
                </span>
              </h2>
              <p className="text-xs text-slate-400 hidden sm:block">
                Select a saved project, launch a new blank canvas, or explore blueprints
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pentix,.json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Import .pentix JSON project file"
            >
              <Upload size={13} className="text-cyan-400" />
              <span className="hidden md:inline">Import</span>
            </button>

            <button
              onClick={() => {
                onCreateNewProject();
                onClose();
              }}
              className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-400/20 active:scale-95"
            >
              <Plus size={14} />
              <span>New Project</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors ml-1"
              title="Close window"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab switcher & Search */}
        <div className="px-5 sm:px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('projects')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'projects'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen size={13} />
              <span>Saved Projects</span>
              <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 text-[10px] font-mono rounded-full font-bold">
                {projects.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('blueprints')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'blueprints'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutTemplate size={13} />
              <span>Blueprints</span>
              <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 text-[10px] font-mono rounded-full font-bold">
                {LOGO_TEMPLATES.length}
              </span>
            </button>
          </div>

          {activeTab === 'projects' && (
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-8 pr-3 py-1.2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Body / Grid */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {activeTab === 'projects' ? (
            <>
              {loading ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <div className="w-7 h-7 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                  <span className="text-xs font-mono">Loading projects from IndexedDB...</span>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center gap-3 text-center p-6 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/20">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-cyan-400">
                    <FolderOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">No projects found</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      {searchQuery
                        ? `No saved projects matched "${searchQuery}".`
                        : 'You haven’t saved any vector projects to IndexedDB yet.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onCreateNewProject();
                      onClose();
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-400/20 mt-1"
                  >
                    <Plus size={14} />
                    <span>Create First Project</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* "+ New Project" Card Tile */}
                  <div
                    onClick={() => {
                      onCreateNewProject();
                      onClose();
                    }}
                    className="group relative border-2 border-dashed border-slate-700/80 hover:border-cyan-400/80 rounded-2xl bg-slate-800/20 hover:bg-slate-800/40 p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150 min-h-[220px]"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all flex items-center justify-center text-cyan-400 mb-3 shadow-lg">
                      <Plus size={24} />
                    </div>
                    <span className="text-sm font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                      New Blank Project
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      Start fresh canvas with two-thumb controls
                    </span>
                  </div>

                  {/* Saved Project Cards */}
                  {filteredProjects.map((proj) => {
                    const isCurrent = currentProjectId === proj.id;
                    const isRenaming = renamingId === proj.id;
                    const isDeleting = deleteConfirmId === proj.id;

                    return (
                      <div
                        key={proj.id}
                        onClick={() => {
                          if (!isRenaming && !isDeleting) {
                            onOpenProject(proj);
                            onClose();
                          }
                        }}
                        className={`group relative rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col bg-slate-850 cursor-pointer shadow-lg hover:shadow-cyan-500/5 ${
                          isCurrent
                            ? 'border-cyan-400 ring-2 ring-cyan-500/30'
                            : 'border-slate-700/80 hover:border-slate-600 hover:bg-slate-800/80'
                        }`}
                      >
                        {/* Current Open Badge */}
                        {isCurrent && (
                          <div className="absolute top-2.5 left-2.5 z-10 px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-bold text-[10px] tracking-wide flex items-center gap-1 shadow-md">
                            <Check size={11} />
                            <span>CURRENTLY OPEN</span>
                          </div>
                        )}

                        {/* Thumbnail Container */}
                        <div className="relative aspect-[16/10] bg-[#070b14] border-b border-slate-800/80 overflow-hidden flex items-center justify-center">
                          {proj.thumbnailSvg ? (
                            <div
                              className="w-full h-full p-2 flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full pointer-events-none"
                              dangerouslySetInnerHTML={{ __html: proj.thumbnailSvg }}
                            />
                          ) : (
                            <div className="text-slate-600 text-xs font-mono">No Preview</div>
                          )}

                          {/* Hover Overlay with Primary Action */}
                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenProject(proj);
                                onClose();
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-1.5"
                            >
                              <FolderOpen size={13} />
                              <span>Open Project</span>
                            </button>
                          </div>
                        </div>

                        {/* Card Info & Actions */}
                        <div className="p-3.5 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            {isRenaming ? (
                              <div
                                className="flex-1 flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveRename(proj);
                                    if (e.key === 'Escape') setRenamingId(null);
                                  }}
                                  autoFocus
                                  className="w-full bg-slate-900 border border-cyan-400 rounded-lg px-2 py-0.5 text-xs font-bold text-white focus:outline-none"
                                />
                                <button
                                  onClick={() => handleSaveRename(proj)}
                                  className="p-1 rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => setRenamingId(null)}
                                  className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div className="min-w-0 flex-1">
                                <h4
                                  className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors flex items-center gap-1.5"
                                  title={proj.name}
                                >
                                  <span>{proj.name}</span>
                                  <button
                                    onClick={(e) => handleStartRename(proj, e)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-white transition-opacity"
                                    title="Rename project"
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 font-mono">
                                  <span className="flex items-center gap-1">
                                    <Clock size={10} />
                                    <span>{formatRelativeTime(proj.updatedAt)}</span>
                                  </span>
                                  <span>&bull;</span>
                                  <span className="flex items-center gap-1">
                                    <Layers size={10} />
                                    <span>{proj.layersCount || proj.layers.length} layers</span>
                                  </span>
                                  <span>&bull;</span>
                                  <span>{proj.pathsCount || 0} paths</span>
                                </div>
                              </div>
                            )}

                            {/* Card Quick Action Menu */}
                            {!isRenaming && (
                              <div
                                className="flex items-center gap-1 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => handleDuplicate(proj.id, e)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-750 transition-colors"
                                  title="Duplicate project"
                                >
                                  <Copy size={13} />
                                </button>
                                <button
                                  onClick={(e) => handleExport(proj, e)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-750 transition-colors"
                                  title="Export .pentix project file"
                                >
                                  <Download size={13} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(proj.id);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-750 transition-colors"
                                  title="Delete project"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Delete Confirmation prompt */}
                          {isDeleting && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 p-2 bg-rose-950/80 border border-rose-500/50 rounded-xl flex items-center justify-between text-xs animate-in fade-in"
                            >
                              <span className="text-rose-200 text-[11px] font-semibold">Delete project?</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => handleDelete(proj.id, e)}
                                  className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px]"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(null);
                                  }}
                                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Blueprints Section */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {LOGO_TEMPLATES.map((tmpl) => {
                const pathsCount = tmpl.layers.reduce((sum, l) => sum + (l.paths?.length || 0), 0);
                const thumb = generateProjectThumbnailSvg(tmpl.layers);

                return (
                  <div
                    key={tmpl.id}
                    onClick={() => {
                      const now = Date.now();
                      const newProj: StoredProject = {
                        id: `blueprint-${tmpl.id}-${now}`,
                        name: tmpl.name,
                        description: tmpl.description,
                        createdAt: now,
                        updatedAt: now,
                        layers: JSON.parse(JSON.stringify(tmpl.layers)),
                        thumbnailSvg: thumb,
                        pathsCount,
                        layersCount: tmpl.layers.length,
                      };
                      saveProject(newProj).then(() => {
                        onOpenProject(newProj);
                        onClose();
                      });
                    }}
                    className="group rounded-2xl border border-slate-700/80 hover:border-cyan-400 bg-slate-850 hover:bg-slate-800 overflow-hidden flex flex-col cursor-pointer transition-all shadow-lg"
                  >
                    <div className="relative aspect-[16/10] bg-[#070b14] border-b border-slate-800/80 overflow-hidden flex items-center justify-center">
                      <div
                        className="w-full h-full p-2 flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full pointer-events-none"
                        dangerouslySetInnerHTML={{ __html: thumb }}
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] flex items-center justify-center">
                        <span className="px-3.5 py-1.5 rounded-xl bg-cyan-400 text-slate-950 text-xs font-bold shadow-lg flex items-center gap-1.5">
                          <Sparkles size={13} />
                          <span>Load Blueprint</span>
                        </span>
                      </div>
                    </div>
                    <div className="p-3.5 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white group-hover:text-cyan-300">
                          {tmpl.name}
                        </h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                          {tmpl.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">
                        {tmpl.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
            <span className="font-mono text-[11px]">IndexedDB Offline Storage Active</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
