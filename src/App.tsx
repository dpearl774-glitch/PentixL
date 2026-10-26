import React, { useState, useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { Toolbar } from './components/Toolbar';
import { ThumbZone } from './components/ThumbZone';
import { Canvas } from './components/Canvas';
import { LayerPanel } from './components/LayerPanel';
import { ContextualBar } from './components/ContextualBar';
import { ExportModal } from './components/ExportModal';
import { WelcomeModal } from './components/WelcomeModal';
import { TemplatesModal } from './components/TemplatesModal';
import { PressureSettingsModal } from './components/PressureSettingsModal';
import { ColorPickerModal } from './components/ColorPickerModal';
import { ProjectsModal } from './components/ProjectsModal';
import { ImageTracerModal } from './components/ImageTracerModal';
import { CustomFontModal } from './components/CustomFontModal';
import { ReferenceImageBar } from './components/ReferenceImageBar';
import { ShapePickerModal } from './components/ShapePickerModal';
import { BottomRibbon } from './components/BottomRibbon';
import { TextInputModal } from './components/TextInputModal';
import { expandTextToVectorPaths } from './utils/contourTracer';
import { generateShapePath } from './utils/shapeGenerator';
import { LOGO_TEMPLATES } from './data/templates';
import {
  CanvasView,
  Layer,
  ModifierState,
  PressureConfig,
  ReferenceImage,
  SelectionState,
  ShapeKind,
  StrokeCap,
  StrokeJoin,
  ToolType,
  VectorPath,
} from './types/vector';
import { toggleAnchorType, roundPathCorners } from './utils/bezier';
import { executeBooleanOperation, BooleanOperation } from './utils/shapeBuilder';
import { flipPaths } from './utils/transform';
import {
  StoredProject,
  getAllProjects,
  saveProject,
  seedInitialProjectsIfEmpty,
} from './utils/projectStorage';
import { generateProjectThumbnailSvg } from './utils/thumbnailGenerator';

export default function App() {
  // Initial Layers state from Shape Builder Golden Grid template
  const [layers, setLayers] = useState<Layer[]>(() => LOGO_TEMPLATES[0].layers);
  const [activeLayerId, setActiveLayerId] = useState<string>(() => LOGO_TEMPLATES[0].layers[0].id);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<Layer[][]>([LOGO_TEMPLATES[0].layers]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Clipboard, Custom Fonts, Reference Images & Shape Picker states
  const [clipboard, setClipboard] = useState<VectorPath[]>([]);
  const [isImageTracerOpen, setIsImageTracerOpen] = useState<boolean>(false);
  const [isFontModalOpen, setIsFontModalOpen] = useState<boolean>(false);
  const [isShapePickerOpen, setIsShapePickerOpen] = useState<boolean>(false);
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  const [selectedFontFamily, setSelectedFontFamily] = useState<string>('Inter, sans-serif');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);

  // Text Input Modal state
  const [isTextInputModalOpen, setIsTextInputModalOpen] = useState<boolean>(false);
  const [editingTextPathId, setEditingTextPathId] = useState<string | null>(null);
  const [textModalInitialText, setTextModalInitialText] = useState<string>('Pentix Vector');

  // Tools & Modifiers
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [currentShapeKind, setCurrentShapeKind] = useState<ShapeKind>('circle');
  const [shapeSides, setShapeSides] = useState<number>(6);
  const [modifiers, setModifiers] = useState<ModifierState>({
    shift: false,
    ctrl: false,
    alt: false,
  });

  // Selection
  const [selection, setSelection] = useState<SelectionState>({
    selectedPathIds: ['c-1'], // Initially select first circle for immediate visual affordance
    selectedAnchorIndex: null,
    selectedHandleType: null,
  });

  // Canvas Viewport & Artboard
  const [view, setView] = useState<CanvasView>({
    zoom: 1,
    panX: 20,
    panY: 30,
    width: 600,
    height: 600,
  });

  // Grid & Snapping
  const [gridVisible, setGridVisible] = useState<boolean>(true);
  const [gridSnapEnabled, setGridSnapEnabled] = useState<boolean>(false);
  const gridSize = 25;

  // Fill, Stroke & Outline properties
  const [fillColor, setFillColor] = useState<string>('#00E5FF');
  const [strokeColor, setStrokeColor] = useState<string>('#38BDF8');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [strokeCap, setStrokeCap] = useState<StrokeCap>('round');
  const [strokeJoin, setStrokeJoin] = useState<StrokeJoin>('round');

  // Dynamic Touch & Stylus Pressure configuration
  const [pressureConfig, setPressureConfig] = useState<PressureConfig>({
    source: 'stylus-or-touch',
    minWidth: 2,
    maxWidth: 24,
    smoothing: 0.7,
    calligraphyAngle: 30,
  });

  // Path in progress (actively being drawn with Pen or Brush)
  const [activePathInProgress, setActivePathInProgress] = useState<VectorPath | null>(null);

  // Non-blocking popovers
  const [isWelcomeOpen, setIsWelcomeOpen] = useState<boolean>(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState<boolean>(false);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isPressureSettingsOpen, setIsPressureSettingsOpen] = useState<boolean>(false);

  // Canvas View Lock (prevents accidental panning/zooming while drawing)
  const [isPanZoomLocked, setIsPanZoomLocked] = useState<boolean>(false);

  // Smart Guides: temporary blue alignment lines and magnetic snapping
  const [smartGuidesEnabled, setSmartGuidesEnabled] = useState<boolean>(true);

  // Project state & IndexedDB tracking
  const [currentProjectId, setCurrentProjectId] = useState<string>('project-golden-grid');
  const [currentProjectName, setCurrentProjectName] = useState<string>('Shape Builder Golden Grid');
  const [isProjectSaved, setIsProjectSaved] = useState<boolean>(true);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState<boolean>(false);
  const [projectsCount, setProjectsCount] = useState<number>(0);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  // Color Picker Modal & Mode
  const [isColorPickerOpen, setIsColorPickerOpen] = useState<boolean>(false);
  const [colorPickerMode, setColorPickerMode] = useState<'fill' | 'stroke'>('fill');

  // Initialize and seed showcase projects in IndexedDB if empty
  useEffect(() => {
    seedInitialProjectsIfEmpty().then((projs) => {
      setProjectsCount(projs.length);
      const hasSeen = localStorage.getItem('pentix_intro_projects_seen');
      if (!hasSeen) {
        setIsProjectsModalOpen(true);
        localStorage.setItem('pentix_intro_projects_seen', 'true');
      }
    });
  }, []);

  // Commit current state to History
  const commitHistory = useCallback(() => {
    setIsProjectSaved(false);
    setHistory((prev) => {
      const next = prev.slice(0, historyIndex + 1);
      return [...next, JSON.parse(JSON.stringify(layers))];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [layers, historyIndex]);

  // Save current project to IndexedDB
  const handleSaveProject = useCallback(
    async (customName?: string) => {
      const nameToUse = customName || currentProjectName || 'Untitled Project';
      const now = Date.now();
      const thumb = generateProjectThumbnailSvg(layers, view.width, view.height);
      const pathsCount = layers.reduce((sum, l) => sum + (l.paths ? l.paths.length : 0), 0);

      const projId = currentProjectId || `project-${now}`;
      const projectToSave: StoredProject = {
        id: projId,
        name: nameToUse,
        createdAt: now,
        updatedAt: now,
        layers: JSON.parse(JSON.stringify(layers)),
        view,
        thumbnailSvg: thumb,
        pathsCount,
        layersCount: layers.length,
      };

      try {
        await saveProject(projectToSave);
        if (!currentProjectId) {
          setCurrentProjectId(projId);
        }
        setIsProjectSaved(true);
        const all = await getAllProjects();
        setProjectsCount(all.length);
        setSaveNotification(`Saved "${nameToUse}" to IndexedDB!`);
        setTimeout(() => setSaveNotification(null), 2500);
      } catch (err) {
        console.error('Error saving project to IndexedDB', err);
      }
    },
    [currentProjectId, currentProjectName, layers, view]
  );

  // Open a project from IndexedDB
  const handleOpenProject = useCallback((project: StoredProject) => {
    setCurrentProjectId(project.id);
    setCurrentProjectName(project.name);
    setLayers(JSON.parse(JSON.stringify(project.layers)));
    if (project.layers.length > 0) {
      setActiveLayerId(project.layers[0].id);
      const firstPath = project.layers[0].paths?.[0];
      setSelection({
        selectedPathIds: firstPath ? [firstPath.id] : [],
        selectedAnchorIndex: null,
        selectedHandleType: null,
      });
    }
    if (project.view) {
      setView(project.view);
    }
    setHistory([JSON.parse(JSON.stringify(project.layers))]);
    setHistoryIndex(0);
    setIsProjectSaved(true);
    setSaveNotification(`Opened "${project.name}"`);
    setTimeout(() => setSaveNotification(null), 2500);
  }, []);

  // Create new blank project
  const handleCreateNewProject = useCallback(async () => {
    const now = Date.now();
    const newId = `project-${now}`;
    const newName = 'Untitled Project';
    const newLayers: Layer[] = [
      {
        id: `layer-${now}`,
        name: 'Layer 1',
        visible: true,
        locked: false,
        opacity: 1,
        paths: [],
      },
    ];

    const newProj: StoredProject = {
      id: newId,
      name: newName,
      createdAt: now,
      updatedAt: now,
      layers: newLayers,
      thumbnailSvg: generateProjectThumbnailSvg(newLayers),
      pathsCount: 0,
      layersCount: 1,
    };

    await saveProject(newProj);
    handleOpenProject(newProj);
    const all = await getAllProjects();
    setProjectsCount(all.length);
  }, [handleOpenProject]);

  // Rename current project
  const handleRenameProject = useCallback(
    (newName: string) => {
      setCurrentProjectName(newName);
      handleSaveProject(newName);
    },
    [handleSaveProject]
  );

  // Round corners of selected paths
  const handleRoundCorners = useCallback(
    (radius: number) => {
      if (selection.selectedPathIds.length === 0) return;
      setLayers((prev) =>
        prev.map((layer) => ({
          ...layer,
          paths: layer.paths.map((p) =>
            selection.selectedPathIds.includes(p.id) ? roundPathCorners(p, radius) : p
          ),
        }))
      );
      commitHistory();
    },
    [selection.selectedPathIds, commitHistory]
  );

  const handleOpenColorPicker = useCallback((mode: 'fill' | 'stroke') => {
    setColorPickerMode(mode);
    setIsColorPickerOpen(true);
  }, []);

  // Undo Handler (Affects in-progress pen nodes first!)
  const handleUndo = useCallback(() => {
    if (activePathInProgress && activePathInProgress.points.length > 0) {
      if (activePathInProgress.points.length <= 1) {
        setActivePathInProgress(null);
      } else {
        const popped = activePathInProgress.points.slice(0, -1);
        setActivePathInProgress({
          ...activePathInProgress,
          points: popped,
        });
      }
      return;
    }

    if (historyIndex > 0) {
      const targetIdx = historyIndex - 1;
      setLayers(JSON.parse(JSON.stringify(history[targetIdx])));
      setHistoryIndex(targetIdx);
    }
  }, [activePathInProgress, historyIndex, history]);

  // Redo Handler
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const targetIdx = historyIndex + 1;
      setLayers(JSON.parse(JSON.stringify(history[targetIdx])));
      setHistoryIndex(targetIdx);
    }
  }, [historyIndex, history]);

  // Canvas View Reset
  const handleResetView = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isMobile = w < 768;

    const availableW = isMobile ? w - 20 : w - 80;
    const availableH = isMobile ? h - 140 : h - 100;
    const scale = Math.min(1.2, Math.max(0.4, Math.min(availableW / view.width, availableH / view.height)));

    setView((prev) => ({
      ...prev,
      zoom: scale,
      panX: (w - prev.width * scale) / 2,
      panY: isMobile ? 65 : (h - prev.height * scale) / 2,
    }));
  }, [view.width, view.height]);

  useEffect(() => {
    handleResetView();
    window.addEventListener('resize', handleResetView);
    return () => window.removeEventListener('resize', handleResetView);
  }, [handleResetView]);

  // Update existing path in active layer
  const handleUpdatePath = useCallback(
    (updatedPath: VectorPath) => {
      setLayers((prev) =>
        prev.map((layer) => ({
          ...layer,
          paths: layer.paths.map((p) => (p.id === updatedPath.id ? updatedPath : p)),
        }))
      );
    },
    []
  );

  // Add new path to active layer
  const handleAddPath = useCallback(
    (newPath: VectorPath) => {
      setLayers((prev) => {
        if (prev.length === 0) {
          return [
            {
              id: `layer-${Date.now()}`,
              name: 'Layer 1',
              visible: true,
              locked: false,
              opacity: 1,
              paths: [newPath],
            },
          ];
        }
        const targetId = prev.some((l) => l.id === activeLayerId) ? activeLayerId : prev[0].id;
        return prev.map((layer) =>
          layer.id === targetId ? { ...layer, paths: [...layer.paths, newPath] } : layer
        );
      });
    },
    [activeLayerId]
  );

  // Direct Shape Insertion onto Artboard Center
  const handleInsertShapeDirect = useCallback(
    (kind: ShapeKind) => {
      const newShape = generateShapePath(
        200,
        200,
        400,
        400,
        { kind, sides: 6, cornerRadius: 24 },
        `shape-${Date.now()}`,
        { fill: fillColor, stroke: strokeColor, strokeWidth }
      );
      handleAddPath(newShape);
      setSelection({
        selectedPathIds: [newShape.id],
        selectedAnchorIndex: null,
        selectedHandleType: null,
      });
      commitHistory();
    },
    [fillColor, strokeColor, strokeWidth, handleAddPath, commitHistory]
  );

  // Commit and finish current active path
  const handleFinishPath = useCallback(() => {
    if (activePathInProgress && activePathInProgress.points.length > 0) {
      handleAddPath(activePathInProgress);
      setActivePathInProgress(null);
      commitHistory();
    }
  }, [activePathInProgress, handleAddPath, commitHistory]);

  // Thumb Zone Nudge handler
  const handleNudge = useCallback(
    (dx: number, dy: number) => {
      if (selection.selectedPathIds.length === 0) return;

      const activePathId = selection.selectedPathIds[0];
      const targetLayer = layers.find((l) => l.paths.some((p) => p.id === activePathId));
      if (!targetLayer) return;

      const targetPath = targetLayer.paths.find((p) => p.id === activePathId);
      if (!targetPath) return;

      if (selection.selectedAnchorIndex !== null) {
        const idx = selection.selectedAnchorIndex;
        const pt = targetPath.points[idx];
        if (!pt) return;

        const updatedPoints = [...targetPath.points];
        updatedPoints[idx] = {
          ...pt,
          x: pt.x + dx,
          y: pt.y + dy,
          handleIn: pt.handleIn ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy } : undefined,
          handleOut: pt.handleOut ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy } : undefined,
        };

        handleUpdatePath({ ...targetPath, points: updatedPoints });
      } else {
        const updatedPoints = targetPath.points.map((pt) => ({
          ...pt,
          x: pt.x + dx,
          y: pt.y + dy,
          handleIn: pt.handleIn ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy } : undefined,
          handleOut: pt.handleOut ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy } : undefined,
        }));
        handleUpdatePath({ ...targetPath, points: updatedPoints });
      }
    },
    [selection, layers, handleUpdatePath]
  );

  // Toggle Point Type: Corner ⟷ Smooth (or round corners of selected shapes)
  const handleTogglePointType = useCallback(() => {
    if (selection.selectedPathIds.length === 0) return;

    if (selection.selectedAnchorIndex !== null) {
      const pathId = selection.selectedPathIds[0];
      const targetLayer = layers.find((l) => l.paths.some((p) => p.id === pathId));
      if (!targetLayer) return;

      const targetPath = targetLayer.paths.find((p) => p.id === pathId);
      if (!targetPath) return;

      const idx = selection.selectedAnchorIndex;
      const pt = targetPath.points[idx];
      if (!pt) return;

      const converted = toggleAnchorType(pt);
      const updatedPoints = [...targetPath.points];
      updatedPoints[idx] = converted;

      handleUpdatePath({ ...targetPath, points: updatedPoints });
      commitHistory();
    } else {
      // Round corners of all selected paths
      setLayers((prev) =>
        prev.map((layer) => ({
          ...layer,
          paths: layer.paths.map((p) =>
            selection.selectedPathIds.includes(p.id) ? roundPathCorners(p, 18) : p
          ),
        }))
      );
      commitHistory();
    }
  }, [selection, layers, handleUpdatePath, commitHistory]);

  // Delete Selected
  const handleDeleteSelected = useCallback(() => {
    if (selection.selectedAnchorIndex !== null && selection.selectedPathIds.length > 0) {
      // Delete selected anchor node
      const pathId = selection.selectedPathIds[0];
      const targetLayer = layers.find((l) => l.paths.some((p) => p.id === pathId));
      if (!targetLayer) return;
      const targetPath = targetLayer.paths.find((p) => p.id === pathId);
      if (!targetPath) return;

      const idx = selection.selectedAnchorIndex;
      if (targetPath.points.length <= 2) {
        setLayers((prev) =>
          prev.map((layer) => ({
            ...layer,
            paths: layer.paths.filter((p) => p.id !== pathId),
          }))
        );
        setSelection({ selectedPathIds: [], selectedAnchorIndex: null, selectedHandleType: null });
      } else {
        const updatedPoints = targetPath.points.filter((_, i) => i !== idx);
        handleUpdatePath({ ...targetPath, points: updatedPoints });
        setSelection((prev) => ({ ...prev, selectedAnchorIndex: null }));
      }
      commitHistory();
    } else if (selection.selectedPathIds.length > 0) {
      // Delete selected shapes
      setLayers((prev) =>
        prev.map((layer) => ({
          ...layer,
          paths: layer.paths.filter((p) => !selection.selectedPathIds.includes(p.id)),
        }))
      );
      setSelection({ selectedPathIds: [], selectedAnchorIndex: null, selectedHandleType: null });
      commitHistory();
    }
  }, [selection, layers, handleUpdatePath, commitHistory]);

  // Close Path
  const handleClosePath = useCallback(() => {
    if (activePathInProgress) {
      if (activePathInProgress.points.length >= 2) {
        handleAddPath({ ...activePathInProgress, closed: true });
        setActivePathInProgress(null);
        commitHistory();
      }
      return;
    }

    if (selection.selectedPathIds.length > 0) {
      const pathId = selection.selectedPathIds[0];
      const targetLayer = layers.find((l) => l.paths.some((p) => p.id === pathId));
      if (!targetLayer) return;
      const path = targetLayer.paths.find((p) => p.id === pathId);
      if (path) {
        handleUpdatePath({ ...path, closed: !path.closed });
        commitHistory();
      }
    }
  }, [activePathInProgress, selection, layers, handleAddPath, handleUpdatePath, commitHistory]);

  // Duplicate Selected Paths
  const handleDuplicateSelected = useCallback(() => {
    if (selection.selectedPathIds.length === 0) return;

    const allPaths = layers.flatMap((l) => l.paths);
    const toDuplicate = allPaths.filter((p) => selection.selectedPathIds.includes(p.id));

    const newPaths: VectorPath[] = toDuplicate.map((p, idx) => ({
      ...JSON.parse(JSON.stringify(p)),
      id: `dup-${Date.now()}-${idx}`,
      name: `${p.name} Copy`,
      points: p.points.map((pt) => ({
        ...pt,
        x: pt.x + 20,
        y: pt.y + 20,
        handleIn: pt.handleIn ? { x: pt.handleIn.x + 20, y: pt.handleIn.y + 20 } : undefined,
        handleOut: pt.handleOut ? { x: pt.handleOut.x + 20, y: pt.handleOut.y + 20 } : undefined,
      })),
    }));

    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === activeLayerId
          ? { ...layer, paths: [...layer.paths, ...newPaths] }
          : layer
      )
    );

    setSelection({
      selectedPathIds: newPaths.map((p) => p.id),
      selectedAnchorIndex: null,
      selectedHandleType: null,
    });

    commitHistory();
  }, [selection, layers, activeLayerId, commitHistory]);

  // Copy Selected Paths to Clipboard
  const handleCopy = useCallback(() => {
    if (selection.selectedPathIds.length === 0) return;
    const allPaths = layers.flatMap((l) => l.paths);
    const selected = allPaths.filter((p) => selection.selectedPathIds.includes(p.id));
    if (selected.length > 0) {
      setClipboard(JSON.parse(JSON.stringify(selected)));
      setSaveNotification(`Copied ${selected.length} path${selected.length > 1 ? 's' : ''}`);
      setTimeout(() => setSaveNotification(null), 1500);
    }
  }, [layers, selection.selectedPathIds]);

  // Paste Paths from Clipboard
  const handlePaste = useCallback(() => {
    if (clipboard.length === 0) return;
    const offset = 24;
    const pastedPaths: VectorPath[] = clipboard.map((p) => ({
      ...p,
      id: `path-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: `${p.name} Copy`,
      points: p.points.map((pt) => ({
        ...pt,
        id: `${pt.id}-cp-${Date.now()}`,
        x: pt.x + offset,
        y: pt.y + offset,
        handleIn: pt.handleIn ? { x: pt.handleIn.x + offset, y: pt.handleIn.y + offset } : undefined,
        handleOut: pt.handleOut ? { x: pt.handleOut.x + offset, y: pt.handleOut.y + offset } : undefined,
      })),
    }));

    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === activeLayerId
          ? { ...layer, paths: [...layer.paths, ...pastedPaths] }
          : layer
      )
    );

    setSelection({
      selectedPathIds: pastedPaths.map((p) => p.id),
      selectedAnchorIndex: null,
      selectedHandleType: null,
    });

    commitHistory();
    setSaveNotification(`Pasted ${pastedPaths.length} path${pastedPaths.length > 1 ? 's' : ''}`);
    setTimeout(() => setSaveNotification(null), 1500);
  }, [clipboard, activeLayerId, commitHistory]);

  // Image Vector Silhouette Tracing complete handler
  const handleTraceComplete = useCallback(
    (tracedPaths: VectorPath[]) => {
      if (tracedPaths.length === 0) return;

      setLayers((prev) =>
        prev.map((layer) =>
          layer.id === activeLayerId
            ? { ...layer, paths: [...layer.paths, ...tracedPaths] }
            : layer
        )
      );

      setSelection({
        selectedPathIds: tracedPaths.map((p) => p.id),
        selectedAnchorIndex: null,
        selectedHandleType: null,
      });

      commitHistory();
      setSaveNotification(`Expanded ${tracedPaths.length} vector silhouette path${tracedPaths.length > 1 ? 's' : ''}`);
      setTimeout(() => setSaveNotification(null), 2500);
    },
    [activeLayerId, commitHistory]
  );

  // Convert Text to Curves (Expand Vector Typography)
  const handleExpandText = useCallback(() => {
    const allPaths = layers.flatMap((l) => l.paths);
    const selectedTexts = allPaths.filter(
      (p) => selection.selectedPathIds.includes(p.id) && !!p.text
    );

    if (selectedTexts.length === 0) return;

    const allGeneratedPaths: VectorPath[] = [];
    const textIdsToRemove: string[] = [];

    for (const textPath of selectedTexts) {
      textIdsToRemove.push(textPath.id);
      const origin = textPath.points[0] || { x: 100, y: 100 };
      const expanded = expandTextToVectorPaths(textPath.text!, {
        originX: origin.x,
        originY: origin.y,
        fontSize: textPath.fontSize || 52,
        fontFamily: textPath.fontFamily || 'Impact, sans-serif',
        fontWeight: textPath.fontWeight || 'bold',
        fillColor: textPath.fill || '#00E5FF',
        strokeColor: textPath.stroke !== 'none' ? textPath.stroke : 'none',
        strokeWidth: textPath.strokeWidth || 0,
      });
      allGeneratedPaths.push(...expanded);
    }

    if (allGeneratedPaths.length === 0) return;

    setLayers((prev) =>
      prev.map((layer) => {
        if (layer.id !== activeLayerId) {
          return {
            ...layer,
            paths: layer.paths.filter((p) => !textIdsToRemove.includes(p.id)),
          };
        }
        const preserved = layer.paths.filter((p) => !textIdsToRemove.includes(p.id));
        return {
          ...layer,
          paths: [...preserved, ...allGeneratedPaths],
        };
      })
    );

    setSelection({
      selectedPathIds: allGeneratedPaths.map((p) => p.id),
      selectedAnchorIndex: null,
      selectedHandleType: null,
    });

    commitHistory();
    setSaveNotification(`Expanded text into ${allGeneratedPaths.length} smooth vector path${allGeneratedPaths.length > 1 ? 's' : ''}`);
    setTimeout(() => setSaveNotification(null), 2500);
  }, [layers, selection.selectedPathIds, activeLayerId, commitHistory]);

  const hasTextSelected = React.useMemo(() => {
    const allPaths = layers.flatMap((l) => l.paths);
    return allPaths.some((p) => selection.selectedPathIds.includes(p.id) && !!p.text);
  }, [layers, selection.selectedPathIds]);

  // Open New Text Modal
  const handleOpenNewTextModal = useCallback(() => {
    setEditingTextPathId(null);
    setTextModalInitialText('Pentix Vector');
    setIsTextInputModalOpen(true);
  }, []);

  // Open Edit Text Modal for currently selected text object
  const handleOpenEditTextModal = useCallback(() => {
    const allPaths = layers.flatMap((l) => l.paths);
    const textPath = allPaths.find((p) => selection.selectedPathIds.includes(p.id) && !!p.text);
    if (textPath) {
      setEditingTextPathId(textPath.id);
      setTextModalInitialText(textPath.text || '');
      if (textPath.fontFamily) setSelectedFontFamily(textPath.fontFamily);
      setIsTextInputModalOpen(true);
    } else {
      handleOpenNewTextModal();
    }
  }, [layers, selection.selectedPathIds, handleOpenNewTextModal]);

  // Save text from modal (creates or updates text object)
  const handleSaveTextFromModal = useCallback(
    (data: { text: string; fontFamily: string; fontSize: number; fillColor: string; editingPathId?: string | null }) => {
      if (data.editingPathId) {
        const allPaths = layers.flatMap((l) => l.paths);
        const existing = allPaths.find((p) => p.id === data.editingPathId);
        if (existing) {
          const updated: VectorPath = {
            ...existing,
            text: data.text,
            fontFamily: data.fontFamily,
            fontSize: data.fontSize,
            fill: data.fillColor,
            name: `Text "${data.text.slice(0, 10)}"`,
          };
          handleUpdatePath(updated);
          commitHistory();
        }
      } else {
        const newPath: VectorPath = {
          id: `text-${Date.now()}`,
          name: `Text "${data.text.slice(0, 10)}"`,
          points: [
            { id: `p0-${Date.now()}`, x: 180, y: 220, type: 'corner' },
          ],
          closed: false,
          fill: data.fillColor,
          fillOpacity: 1,
          stroke: 'none',
          strokeWidth: 0,
          strokeOpacity: 0,
          strokeCap: 'round',
          strokeJoin: 'round',
          pressureProfile: 'uniform',
          text: data.text,
          fontSize: data.fontSize,
          fontFamily: data.fontFamily,
          fontWeight: 'bold',
        };
        handleAddPath(newPath);
        setSelection({
          selectedPathIds: [newPath.id],
          selectedAnchorIndex: null,
          selectedHandleType: null,
        });
        commitHistory();
      }
    },
    [layers, handleUpdatePath, handleAddPath, commitHistory]
  );

  // Flip Selected Paths
  const handleFlipSelected = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      if (selection.selectedPathIds.length === 0) return;

      const allPaths = layers.flatMap((l) => l.paths);
      const toFlip = allPaths.filter((p) => selection.selectedPathIds.includes(p.id));
      if (toFlip.length === 0) return;

      // Find center
      let sumX = 0;
      let sumY = 0;
      let totalPts = 0;
      toFlip.forEach((p) =>
        p.points.forEach((pt) => {
          sumX += pt.x;
          sumY += pt.y;
          totalPts++;
        })
      );
      const center = { x: sumX / totalPts, y: sumY / totalPts };

      const flipped = flipPaths(toFlip, center, direction);
      flipped.forEach((p) => handleUpdatePath(p));
      commitHistory();
    },
    [selection, layers, handleUpdatePath, commitHistory]
  );

  // Shape Builder / Boolean Execution (Direct, In-Canvas)
  const handleExecuteBoolean = useCallback(
    (op: BooleanOperation) => {
      const allPaths = layers.flatMap((l) => l.paths);
      const selectedPaths = allPaths.filter((p) => selection.selectedPathIds.includes(p.id));

      if (selectedPaths.length < 2) return;

      const resultingPaths = executeBooleanOperation(selectedPaths, op);

      setLayers((prev) =>
        prev.map((layer) => {
          if (layer.id !== activeLayerId) {
            return {
              ...layer,
              paths: layer.paths.filter((p) => !selection.selectedPathIds.includes(p.id)),
            };
          }
          const preservedPaths = layer.paths.filter((p) => !selection.selectedPathIds.includes(p.id));
          return {
            ...layer,
            paths: [...preservedPaths, ...resultingPaths],
          };
        })
      );

      setSelection({
        selectedPathIds: resultingPaths.map((p) => p.id),
        selectedAnchorIndex: null,
        selectedHandleType: null,
      });

      commitHistory();
    },
    [layers, selection, activeLayerId, commitHistory]
  );

  // Shape Builder Path Replacement (Direct In-Canvas Interactive Region Commit)
  const handleReplacePaths = useCallback(
    (removePathIds: string[], newPaths: VectorPath[]) => {
      setLayers((prev) =>
        prev.map((layer) => {
          if (layer.id !== activeLayerId) {
            return {
              ...layer,
              paths: layer.paths.filter((p) => !removePathIds.includes(p.id)),
            };
          }
          const preserved = layer.paths.filter((p) => !removePathIds.includes(p.id));
          return {
            ...layer,
            paths: [...preserved, ...newPaths],
          };
        })
      );

      setSelection({
        selectedPathIds: newPaths.map((p) => p.id),
        selectedAnchorIndex: null,
        selectedHandleType: null,
      });

      commitHistory();
    },
    [activeLayerId, commitHistory]
  );

  // Tool change helper
  const handleSelectTool = (tool: ToolType) => {
    if (activePathInProgress && activePathInProgress.points.length >= 2) {
      handleAddPath(activePathInProgress);
      setActivePathInProgress(null);
      commitHistory();
    }
    setCurrentTool(tool);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setModifiers((prev) => ({ ...prev, shift: true }));
      if (e.key === 'Control' || e.key === 'Meta') setModifiers((prev) => ({ ...prev, ctrl: true }));
      if (e.key === 'Alt') setModifiers((prev) => ({ ...prev, alt: true }));

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v':
            handleSelectTool('select');
            break;
          case 'a':
            handleSelectTool('direct-select');
            break;
          case 'p':
            handleSelectTool('pen');
            break;
          case 'm':
            handleSelectTool('shape-builder');
            break;
          case 'u':
            handleSelectTool('shape');
            break;
          case 'b':
            handleSelectTool('pressure-brush');
            break;
          case 't':
            handleSelectTool('text');
            break;
          case 'h':
            handleSelectTool('hand');
            break;
          case 'escape':
            setActivePathInProgress(null);
            setSelection({ selectedPathIds: [], selectedAnchorIndex: null, selectedHandleType: null });
            break;
          case 'delete':
          case 'backspace':
            handleDeleteSelected();
            break;
        }
      }

      // Spacebar canvas pan shortcut
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        handleSelectTool('hand');
        return;
      }

      // Copy & Paste & Duplicate shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveProject();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setModifiers((prev) => ({ ...prev, shift: false }));
      if (e.key === 'Control' || e.key === 'Meta') setModifiers((prev) => ({ ...prev, ctrl: false }));
      if (e.key === 'Alt') setModifiers((prev) => ({ ...prev, alt: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleUndo, handleRedo, handleDeleteSelected, handleCopy, handlePaste, handleDuplicateSelected, commitHistory, activePathInProgress, handleSaveProject]);

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-[#070b14] select-none text-slate-100">
      {/* Top Bar */}
      <TopBar
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onOpenShapeBuilder={() => handleSelectTool('shape-builder')}
        onOpenLayers={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
        isLayerPanelOpen={isLayerPanelOpen}
        layersCount={layers.length}
        isPanZoomLocked={isPanZoomLocked}
        onToggleLockPanZoom={() => setIsPanZoomLocked((prev) => !prev)}
        smartGuidesEnabled={smartGuidesEnabled}
        onToggleSmartGuides={() => setSmartGuidesEnabled((prev) => !prev)}
        onOpenGuide={() => setIsWelcomeOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenImageTracer={() => setIsImageTracerOpen(true)}
        onOpenCustomFontModal={() => setIsFontModalOpen(true)}
        onAddReferenceImage={(refImg) => setReferenceImages((prev) => [...prev, refImg])}
        zoom={view.zoom}
        onZoomChange={(newZoom) => setView((prev) => ({ ...prev, zoom: newZoom }))}
        onResetView={handleResetView}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        projectName={currentProjectName}
        onRenameProject={handleRenameProject}
        onSaveProject={() => handleSaveProject()}
        isProjectSaved={isProjectSaved}
        onOpenProjects={() => setIsProjectsModalOpen(true)}
        projectsCount={projectsCount}
      />

      {/* Main Vector Surface */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* Reference Image Manager Floating Card */}
        <ReferenceImageBar
          referenceImages={referenceImages}
          onUpdateReferenceImage={(updated) =>
            setReferenceImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)))
          }
          onDeleteReferenceImage={(id) =>
            setReferenceImages((prev) => prev.filter((img) => img.id !== id))
          }
          onAddReferenceImage={(img) => setReferenceImages((prev) => [...prev, img])}
          onSelectTool={handleSelectTool}
          onOpenImageTracerWithSrc={(_src) => {
            setIsImageTracerOpen(true);
          }}
        />

        {/* Full-Screen Vector Canvas */}
        <Canvas
          view={view}
          onViewChange={setView}
          layers={layers}
          activeLayerId={activeLayerId}
          onUpdatePath={handleUpdatePath}
          onAddPath={handleAddPath}
          tool={currentTool}
          shapeKind={currentShapeKind}
          shapeSides={shapeSides}
          modifiers={modifiers}
          selection={selection}
          onSelectionChange={setSelection}
          gridVisible={gridVisible}
          gridSnapEnabled={gridSnapEnabled}
          gridSize={gridSize}
          fillColor={fillColor}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          pressureConfig={pressureConfig}
          onCommitHistory={commitHistory}
          activePathInProgress={activePathInProgress}
          setActivePathInProgress={setActivePathInProgress}
          onShapeBuilderAction={handleExecuteBoolean}
          onReplacePaths={handleReplacePaths}
          isPanZoomLocked={isPanZoomLocked}
          onToggleLockPanZoom={() => setIsPanZoomLocked((prev) => !prev)}
          onOpenLayers={() => setIsLayerPanelOpen((prev) => !prev)}
          smartGuidesEnabled={smartGuidesEnabled}
          onToggleSmartGuides={() => setSmartGuidesEnabled((prev) => !prev)}
          referenceImages={referenceImages}
        />

        {/* In-Canvas Contextual Color & Transform Floating Bar (Never covers canvas) */}
        <ContextualBar
          selectedCount={selection.selectedPathIds.length}
          fillColor={fillColor}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          customFonts={customFonts}
          selectedFontFamily={selectedFontFamily}
          onUpdateFontFamily={(font) => {
            setSelectedFontFamily(font);
            if (selection.selectedPathIds.length > 0) {
              selection.selectedPathIds.forEach((pid) => {
                const p = layers.flatMap((l) => l.paths).find((item) => item.id === pid);
                if (p) handleUpdatePath({ ...p, fontFamily: font });
              });
              commitHistory();
            }
          }}
          onUpdateFill={(c) => {
            setFillColor(c);
            if (selection.selectedPathIds.length > 0) {
              selection.selectedPathIds.forEach((pid) => {
                const p = layers.flatMap((l) => l.paths).find((item) => item.id === pid);
                if (p) handleUpdatePath({ ...p, fill: c });
              });
              commitHistory();
            }
          }}
          onUpdateStroke={(c) => {
            setStrokeColor(c);
            if (selection.selectedPathIds.length > 0) {
              selection.selectedPathIds.forEach((pid) => {
                const p = layers.flatMap((l) => l.paths).find((item) => item.id === pid);
                if (p) handleUpdatePath({ ...p, stroke: c });
              });
              commitHistory();
            }
          }}
          onUpdateStrokeWidth={(w) => {
            setStrokeWidth(w);
            if (selection.selectedPathIds.length > 0) {
              selection.selectedPathIds.forEach((pid) => {
                const p = layers.flatMap((l) => l.paths).find((item) => item.id === pid);
                if (p) handleUpdatePath({ ...p, strokeWidth: w });
              });
              commitHistory();
            }
          }}
          onRoundCorners={handleRoundCorners}
          onOpenColorPicker={handleOpenColorPicker}
          onDuplicate={handleDuplicateSelected}
          onCopy={handleCopy}
          onPaste={handlePaste}
          canPaste={clipboard.length > 0}
          hasTextSelected={hasTextSelected}
          onEditText={handleOpenEditTextModal}
          onExpandText={handleExpandText}
          onDelete={handleDeleteSelected}
          onFlip={handleFlipSelected}
          onBooleanOp={handleExecuteBoolean}
          isShapeBuilderMode={currentTool === 'shape-builder'}
          isPathfinderMode={currentTool === 'pathfinder'}
        />

        {/* PixelLab-style 5-Tab Bottom Ribbon & Contextual Tool Bar */}
        <BottomRibbon
          currentTool={currentTool}
          onSelectTool={handleSelectTool}
          currentShapeKind={currentShapeKind}
          onOpenShapePicker={() => setIsShapePickerOpen(true)}
          onInsertShapeDirect={handleInsertShapeDirect}
          fillColor={fillColor}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          onOpenColorPicker={handleOpenColorPicker}
          onOpenProjects={() => setIsProjectsModalOpen(true)}
          onOpenTemplates={() => setIsTemplatesOpen(true)}
          onOpenExport={() => setIsExportOpen(true)}
          onOpenTextInputModal={handleOpenNewTextModal}
          onOpenCustomFontModal={() => setIsFontModalOpen(true)}
          onOpenImageTracer={() => setIsImageTracerOpen(true)}
          onAddReferenceImage={(refImg) => setReferenceImages((prev) => [...prev, refImg])}
          gridVisible={gridVisible}
          onToggleGrid={() => setGridVisible((prev) => !prev)}
          gridSnapEnabled={gridSnapEnabled}
          onToggleGridSnap={() => setGridSnapEnabled((prev) => !prev)}
          isPanZoomLocked={isPanZoomLocked}
          onToggleLockPanZoom={() => setIsPanZoomLocked((prev) => !prev)}
          onResetView={handleResetView}
          onOpenLayers={() => setIsLayerPanelOpen((prev) => !prev)}
          layersCount={layers.length}
          hasSelection={selection.selectedPathIds.length > 0}
          onDuplicateSelected={handleDuplicateSelected}
          onDeleteSelected={handleDeleteSelected}
          onFlipSelected={handleFlipSelected}
        />

        {/* TRUE TWO-THUMB STUDIO (Left Thumb Modifiers + Right Thumb Actions) */}
        <ThumbZone
          modifiers={modifiers}
          onModifierChange={setModifiers}
          onNudge={handleNudge}
          onTogglePointType={handleTogglePointType}
          onDeleteSelectedPoint={handleDeleteSelected}
          onClosePath={handleClosePath}
          gridSnapEnabled={gridSnapEnabled}
          onToggleGridSnap={() => setGridSnapEnabled((prev) => !prev)}
          hasSelectedPoint={selection.selectedAnchorIndex !== null || selection.selectedPathIds.length > 0}
          isPenActive={currentTool === 'pen'}
          activePathPointCount={activePathInProgress?.points.length || 0}
          onFinishPath={handleFinishPath}
        />

        {/* Compact Floating Layer Panel (Non-intrusive card) */}
        <LayerPanel
          isOpen={isLayerPanelOpen}
          onClose={() => setIsLayerPanelOpen(false)}
          layers={layers}
          activeLayerId={activeLayerId}
          onSelectLayer={setActiveLayerId}
          onRenameLayer={(layerId, newName) => {
            const trimmed = newName.trim();
            if (!trimmed) return;
            setLayers((prev) =>
              prev.map((l) => (l.id === layerId ? { ...l, name: trimmed } : l))
            );
            commitHistory();
          }}
          onToggleLayerVisible={(layerId) => {
            setLayers((prev) =>
              prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
            );
          }}
          onToggleLayerLock={(layerId) => {
            setLayers((prev) =>
              prev.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l))
            );
          }}
          onAddLayer={() => {
            const newLayer: Layer = {
              id: `layer-${Date.now()}`,
              name: `Layer ${layers.length + 1}`,
              visible: true,
              locked: false,
              opacity: 1,
              paths: [],
            };
            setLayers((prev) => [...prev, newLayer]);
            setActiveLayerId(newLayer.id);
            commitHistory();
          }}
          onDeleteLayer={(layerId) => {
            if (layers.length <= 1) return;
            setLayers((prev) => prev.filter((l) => l.id !== layerId));
            setActiveLayerId(layers[0].id);
            commitHistory();
          }}
          onDuplicateLayer={(layerId) => {
            const target = layers.find((l) => l.id === layerId);
            if (!target) return;
            const duplicated: Layer = {
              ...JSON.parse(JSON.stringify(target)),
              id: `layer-${Date.now()}`,
              name: `${target.name} Copy`,
            };
            setLayers((prev) => [...prev, duplicated]);
            setActiveLayerId(duplicated.id);
            commitHistory();
          }}
          onMoveLayer={(layerId, direction) => {
            const idx = layers.findIndex((l) => l.id === layerId);
            if (idx === -1) return;
            const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (targetIdx < 0 || targetIdx >= layers.length) return;
            const newLayers = [...layers];
            const [removed] = newLayers.splice(idx, 1);
            newLayers.splice(targetIdx, 0, removed);
            setLayers(newLayers);
            commitHistory();
          }}
          onUpdateLayerOpacity={(layerId, opacity) => {
            setLayers((prev) =>
              prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
            );
          }}
          selectedPathIds={selection.selectedPathIds}
          onSelectPath={(pathId) => {
            setSelection({
              selectedPathIds: [pathId],
              selectedAnchorIndex: null,
              selectedHandleType: null,
            });
          }}
          onDeletePath={(pathId) => {
            setLayers((prev) =>
              prev.map((l) => ({
                ...l,
                paths: l.paths.filter((p) => p.id !== pathId),
              }))
            );
            commitHistory();
          }}
        />

        {/* SVG & High-Res PNG Export Studio Modal */}
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          layers={layers}
          canvasWidth={view.width}
          canvasHeight={view.height}
          pressureConfig={pressureConfig}
        />

        {/* Welcome Walkthrough Modal (Triggered via Guide button in TopBar) */}
        <WelcomeModal
          isOpen={isWelcomeOpen}
          onClose={() => setIsWelcomeOpen(false)}
          onLoadTemplate={(templateLayers) => {
            setLayers(JSON.parse(JSON.stringify(templateLayers)));
            setActiveLayerId(templateLayers[0].id);
            setSelection({ selectedPathIds: [], selectedAnchorIndex: null, selectedHandleType: null });
            commitHistory();
          }}
          onOpenProjects={() => setIsProjectsModalOpen(true)}
        />

        {/* Logo Templates Blueprint Modal */}
        <TemplatesModal
          isOpen={isTemplatesOpen}
          onClose={() => setIsTemplatesOpen(false)}
          onSelectTemplate={(templateLayers) => {
            setLayers(JSON.parse(JSON.stringify(templateLayers)));
            setActiveLayerId(templateLayers[0].id);
            setSelection({ selectedPathIds: [], selectedAnchorIndex: null, selectedHandleType: null });
            commitHistory();
          }}
        />

        {/* Touch & Stylus Pressure Settings Modal */}
        <PressureSettingsModal
          isOpen={isPressureSettingsOpen}
          onClose={() => setIsPressureSettingsOpen(false)}
          config={pressureConfig}
          onChangeConfig={setPressureConfig}
        />

        {/* Fill & Stroke Color Picker & Style Modal */}
        <ColorPickerModal
          isOpen={isColorPickerOpen}
          onClose={() => setIsColorPickerOpen(false)}
          mode={colorPickerMode}
          onModeChange={setColorPickerMode}
          fillColor={fillColor}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          strokeCap={strokeCap}
          strokeJoin={strokeJoin}
          onUpdateFill={(c) => {
            setFillColor(c);
            if (selection.selectedPathIds.length > 0) {
              selection.selectedPathIds.forEach((pid) => {
                const p = layers.flatMap((l) => l.paths).find((item) => item.id === pid);
                if (p) handleUpdatePath({ ...p, fill: c });
              });
              commitHistory();
            }
          }}
          onUpdateStroke={(c) => {
            setStrokeColor(c);
            if (selection.selectedPathIds.length > 0) {
              selection.selectedPathIds.forEach((pid) => {
                const p = layers.flatMap((l) => l.paths).find((item) => item.id === pid);
                if (p) handleUpdatePath({ ...p, stroke: c });
              });
              commitHistory();
            }
          }}
          onUpdateStrokeWidth={(w) => {
            setStrokeWidth(w);
            if (selection.selectedPathIds.length > 0) {
              selection.selectedPathIds.forEach((pid) => {
                const p = layers.flatMap((l) => l.paths).find((item) => item.id === pid);
                if (p) handleUpdatePath({ ...p, strokeWidth: w });
              });
              commitHistory();
            }
          }}
          onUpdateStrokeCap={(cap) => {
            setStrokeCap(cap);
            if (selection.selectedPathIds.length > 0) {
              selection.selectedPathIds.forEach((pid) => {
                const p = layers.flatMap((l) => l.paths).find((item) => item.id === pid);
                if (p) handleUpdatePath({ ...p, strokeCap: cap });
              });
              commitHistory();
            }
          }}
          onUpdateStrokeJoin={(join) => {
            setStrokeJoin(join);
            if (selection.selectedPathIds.length > 0) {
              selection.selectedPathIds.forEach((pid) => {
                const p = layers.flatMap((l) => l.paths).find((item) => item.id === pid);
                if (p) handleUpdatePath({ ...p, strokeJoin: join });
              });
              commitHistory();
            }
          }}
        />

        {/* Projects Introductory Window with Live Thumbnails */}
        <ProjectsModal
          isOpen={isProjectsModalOpen}
          onClose={() => setIsProjectsModalOpen(false)}
          currentProjectId={currentProjectId}
          onOpenProject={handleOpenProject}
          onCreateNewProject={handleCreateNewProject}
        />

        {/* Silhouette Image Vector Tracing & Contour Expansion Studio */}
        <ImageTracerModal
          isOpen={isImageTracerOpen}
          onClose={() => setIsImageTracerOpen(false)}
          onTraceComplete={handleTraceComplete}
          onAddReferenceImage={(refImg) => setReferenceImages((prev) => [...prev, refImg])}
          fillColor={fillColor}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
        />

        {/* Custom Font Uploader Modal */}
        <CustomFontModal
          isOpen={isFontModalOpen}
          onClose={() => setIsFontModalOpen(false)}
          onFontUploaded={(fName) => {
            setCustomFonts((prev) => [...prev, fName]);
            setSelectedFontFamily(fName);
          }}
        />

        {/* Vector Text Input & Formatting Modal */}
        <TextInputModal
          isOpen={isTextInputModalOpen}
          onClose={() => setIsTextInputModalOpen(false)}
          initialText={textModalInitialText}
          initialFontFamily={selectedFontFamily}
          initialFontSize={52}
          initialFillColor={fillColor}
          customFonts={customFonts}
          editingPathId={editingTextPathId}
          onSaveText={handleSaveTextFromModal}
        />

        {/* PixelLab Visual 17-Shape Picker Grid Modal */}
        <ShapePickerModal
          isOpen={isShapePickerOpen}
          onClose={() => setIsShapePickerOpen(false)}
          selectedShape={currentShapeKind}
          onSelectShape={setCurrentShapeKind}
          onInsertShape={handleInsertShapeDirect}
        />

        {/* Save to IndexedDB Toast Notification */}
        {saveNotification && (
          <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-60 px-4 py-2 bg-slate-900/95 border border-cyan-500/50 text-cyan-300 font-bold text-xs rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981]" />
            <span>{saveNotification}</span>
          </div>
        )}
      </main>
    </div>
  );
}
