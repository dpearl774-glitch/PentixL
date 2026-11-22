/**
 * Time-to-logo, measured rather than felt.
 *
 * The tester's claim is a multiple ("a quarter of the time"), which can only be
 * checked against numbers. Three fixed tasks are timed: drawing one shape,
 * placing one word, and getting a file out. Each task starts when its tool is
 * picked and ends when the canvas has the thing, so the number is what the hand
 * actually waits for, not how long a click handler ran.
 */

export type PerfTask = 'shape' | 'word' | 'export';

export interface PerfSample {
  task: PerfTask;
  ms: number;
  at: number;
}

const KEY = 'pentix.perf.v1';
const MAX_SAMPLES = 30;
const pending = new Map<PerfTask, number>();

const canStore = () => typeof localStorage !== 'undefined';

export function readSamples(): PerfSample[] {
  if (!canStore()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PerfSample[]).filter((s) => s && typeof s.ms === 'number') : [];
  } catch {
    return [];
  }
}

function writeSamples(samples: PerfSample[]) {
  if (!canStore()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(samples.slice(-MAX_SAMPLES)));
  } catch {
    // A full or blocked store is not worth failing a drawing session over.
  }
}

/** Marks the moment the user asked for the thing. A second start replaces the first. */
export function startTask(task: PerfTask, now = Date.now()) {
  pending.set(task, now);
}

/** Drops a pending start, e.g. when the tool is switched before anything was drawn. */
export function clearTasks(...tasks: PerfTask[]) {
  for (const task of tasks) pending.delete(task);
}

/** Records the moment the thing exists. Without a start it does nothing. */
export function finishTask(task: PerfTask, now = Date.now()): PerfSample | null {
  const started = pending.get(task);
  if (started === undefined) return null;
  pending.delete(task);
  const sample: PerfSample = { task, ms: Math.max(0, now - started), at: now };
  writeSamples([...readSamples(), sample]);
  return sample;
}

/** Median of a task's samples — one slow run should not stand for the average. */
export function medianMs(samples: PerfSample[], task: PerfTask): number | null {
  const values = samples
    .filter((s) => s.task === task)
    .map((s) => s.ms)
    .sort((a, b) => a - b);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}
