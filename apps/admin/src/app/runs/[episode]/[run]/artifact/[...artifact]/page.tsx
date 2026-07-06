import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArtifact } from '@/lib/runs';

export const dynamic = 'force-dynamic';

export default async function ArtifactPage({
  params
}: {
  params: Promise<{ episode: string; run: string; artifact: string[] }>;
}) {
  const { episode, run, artifact } = await params;
  const episodeFolder = decodeURIComponent(episode);
  const runFolder = decodeURIComponent(run);
  const artifactPath = artifact.map(decodeURIComponent).join('/');
  
  const content = getArtifact(episodeFolder, runFolder, artifactPath);
  if (content == null) notFound();
  
  // Pretty-print JSON artifacts
  let display = content;
  if (artifactPath.endsWith('.json')) {
    try {
      display = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      // show raw
    }
  }
  
  return (
    <main className="container">
      <div className="crumbs">
        <Link href="/">runs</Link> /{' '}
        <Link href={`/runs/${encodeURIComponent(episodeFolder)}/${encodeURIComponent(runFolder)}`}>
          {runFolder}
        </Link>{' '}
        / {artifactPath}
      </div>
      <h1 className="page-title">{artifactPath}</h1>
      <pre className="raw">{display}</pre>
    </main>
  );
}
