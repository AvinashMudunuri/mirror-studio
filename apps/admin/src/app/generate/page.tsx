import Link from 'next/link';
import { GenerateForm } from './generate-form';

export const metadata = {
  title: 'Generate Episode — MIRROR Studio Admin'
};

export default function GeneratePage() {
  return (
    <main className="container">
      <p className="crumbs"><Link href="/">← All runs</Link></p>
      <h1 className="page-title">Generate Episode</h1>
      <p className="page-sub">
        Spawns <code>scripts/create-real-episode.js</code> with real Claude API calls — this costs real
        tokens and typically takes 10–60+ minutes for a full board run. Only one generation can run at a
        time. The console below streams live; closing this page does not stop the run, but the live
        console feed is lost until you come back (the run itself is unaffected — check the run list once
        it finishes).
      </p>
      <GenerateForm />
    </main>
  );
}
