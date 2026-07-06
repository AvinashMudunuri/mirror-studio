/**
 * Filesystem data layer for the admin dashboard.
 *
 * Reads run folders under output/episodes/ — the pipeline's source of
 * truth. Read-only by design; tolerates legacy/partial runs (older
 * manifests lack finalStatus/usage; crashed runs may lack a manifest).
 */

import fs from 'fs';
import path from 'path';

/** Repo-root output/episodes, overridable for tests/deployments. */
export function episodesRoot(): string {
  return process.env.EPISODES_DIR || path.resolve(process.cwd(), '..', '..', 'output', 'episodes');
}

export interface RunSummary {
  episodeFolder: string;
  runFolder: string;
  startedAt: string | null;
  totalSeconds: number | null;
  finalStatus: string;
  verdicts: Record<string, string>;
  totalTokens: number | null;
  model: string | null;
  revisionCount: number;
  hasBoundScript: boolean;
  episodeTitle: string | null;
}

export interface RunDetail extends RunSummary {
  manifest: unknown;
  boundScript: string | null;
  files: Array<{ name: string; bytes: number }>;
}

function readJson(filePath: string): any | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return undefined;
  }
}

function summarize(episodeFolder: string, runFolder: string): RunSummary {
  const runDir = path.join(episodesRoot(), episodeFolder, runFolder);
  const manifest = readJson(path.join(runDir, 'manifest.json'));
  
  const revisionCount = fs.readdirSync(runDir)
    .filter(name => /^revision-\d+$/.test(name)).length;
  
  return {
    episodeFolder,
    runFolder,
    startedAt: manifest?.run?.startedAt ?? null,
    totalSeconds: manifest?.run?.totalSeconds ?? null,
    // Legacy manifests (pre-revision-loop) have verdicts but no finalStatus.
    finalStatus: manifest?.finalStatus ?? (manifest ? 'LEGACY' : 'INCOMPLETE'),
    verdicts: manifest?.verdicts ?? {},
    totalTokens: manifest?.run?.usage?.totalTokens ?? null,
    model: manifest?.run?.model ?? null,
    revisionCount,
    hasBoundScript: fs.existsSync(path.join(runDir, 'episode-script.md')),
    episodeTitle: manifest?.episode?.title ?? readJson(path.join(runDir, '01-story-outline.json'))?.episodeOutline?.title ?? null
  };
}

export function listRuns(): RunSummary[] {
  const root = episodesRoot();
  if (!fs.existsSync(root)) return [];
  
  const runs: RunSummary[] = [];
  for (const episodeFolder of fs.readdirSync(root)) {
    const episodeDir = path.join(root, episodeFolder);
    if (!fs.statSync(episodeDir).isDirectory()) continue;
    for (const runFolder of fs.readdirSync(episodeDir)) {
      if (!runFolder.startsWith('run-')) continue;
      runs.push(summarize(episodeFolder, runFolder));
    }
  }
  
  // Newest first (run folder names embed the timestamp)
  return runs.sort((a, b) => b.runFolder.localeCompare(a.runFolder));
}

/** Whitelist: only artifacts inside the run folder are exposed. */
function isSafeName(name: string): boolean {
  return !name.includes('..') && !path.isAbsolute(name);
}

export function getRun(episodeFolder: string, runFolder: string): RunDetail | null {
  if (!isSafeName(episodeFolder) || !isSafeName(runFolder)) return null;
  const runDir = path.join(episodesRoot(), episodeFolder, runFolder);
  if (!fs.existsSync(runDir)) return null;
  
  const summary = summarize(episodeFolder, runFolder);
  
  const files: Array<{ name: string; bytes: number }> = [];
  const walk = (dir: string, prefix: string) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const filePath = path.join(dir, name);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) walk(filePath, `${prefix}${name}/`);
      else files.push({ name: `${prefix}${name}`, bytes: stat.size });
    }
  };
  walk(runDir, '');
  
  let boundScript: string | null = null;
  const scriptPath = path.join(runDir, 'episode-script.md');
  if (fs.existsSync(scriptPath)) {
    boundScript = fs.readFileSync(scriptPath, 'utf-8');
  }
  
  return {
    ...summary,
    manifest: readJson(path.join(runDir, 'manifest.json')) ?? null,
    boundScript,
    files
  };
}

export function getArtifact(episodeFolder: string, runFolder: string, artifact: string): string | null {
  if (!isSafeName(episodeFolder) || !isSafeName(runFolder) || !isSafeName(artifact)) return null;
  const filePath = path.join(episodesRoot(), episodeFolder, runFolder, artifact);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;
  return fs.readFileSync(filePath, 'utf-8');
}
