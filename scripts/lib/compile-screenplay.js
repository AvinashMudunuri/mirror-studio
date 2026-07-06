/**
 * Screenplay compiler — turns a run's episode artifacts into a single
 * human-readable "bound script": the locked, final version of the episode
 * screenplay. Zero LLM calls; pure assembly of already-generated content.
 *
 * The script is only stamped FINAL (LOCKED) when the run's manifest says
 * finalStatus APPROVED; anything else is a DRAFT — you don't bind an
 * unapproved draft.
 */

'use strict';

/** Display name for a speaker id, honoring the reserved narration ids. */
function speakerName(characterId, castById) {
  if (characterId === 'NARRATOR') return 'NARRATOR';
  if (characterId === 'INTERNAL') return 'INTERNAL (V.O.)';
  const character = castById.get(characterId);
  return character ? character.name.toUpperCase() : characterId.toUpperCase();
}

function formatLine(line, castById) {
  const name = speakerName(line.character, castById);
  const emotion = line.emotion ? ` *(${line.emotion})*` : '';
  let out = `**${name}**${emotion}: ${line.text}`;
  if (line.action) out += `\n  *[${line.action}]*`;
  if (line.pause) out += `\n  *[pause ${line.pause}ms]*`;
  return out;
}

function formatLines(lines, castById) {
  return (lines || []).map(l => formatLine(l, castById)).join('\n\n');
}

/**
 * Compile the final screenplay markdown.
 *
 * @param {object} args
 * @param {object} args.outline        Final episode outline
 * @param {Array}  args.cast           Character profiles (id, name, ...)
 * @param {object} args.dialogueResult Final dialogue output
 *                                     (dialogue, choiceDialogue, branchDialogue)
 * @param {object} [args.manifest]     Run manifest (finalStatus, verdicts, run)
 * @returns {string} markdown screenplay
 */
function compileScreenplay({ outline, cast, dialogueResult, manifest }) {
  const castById = new Map((cast || []).map(c => [c.id, c]));
  const dialogueByScene = new Map((dialogueResult.dialogue || []).map(d => [d.sceneId, d.lines]));
  const choicesByScene = new Map();
  for (const cp of outline.choicePoints || []) {
    if (!choicesByScene.has(cp.scene)) choicesByScene.set(cp.scene, []);
    choicesByScene.get(cp.scene).push(cp);
  }
  const choiceDialogueById = new Map((dialogueResult.choiceDialogue || []).map(cd => [cd.choiceId, cd]));
  const branchDialogueByScene = new Map();
  for (const bd of dialogueResult.branchDialogue || []) {
    if (!branchDialogueByScene.has(bd.sceneId)) branchDialogueByScene.set(bd.sceneId, []);
    branchDialogueByScene.get(bd.sceneId).push(bd);
  }
  const branchesById = new Map((outline.branches || []).map(b => [b.id, b]));

  const approved = manifest?.finalStatus === 'APPROVED';
  const status = approved ? 'FINAL — LOCKED' : `DRAFT (${manifest?.finalStatus || 'no review record'})`;

  const parts = [];

  // ---------- Title page ----------
  parts.push(`# ${outline.title}`);
  parts.push('');
  parts.push(`**Status:** ${status}`);
  if (manifest?.episode) {
    parts.push(`**Episode:** ${manifest.episode.number} | **World:** ${manifest.episode.world}`);
  }
  if (manifest?.run) {
    parts.push(`**Run:** ${manifest.run.startedAt || 'unknown'} | **Model:** ${manifest.run.model || 'unknown'}`);
  }
  if (manifest?.verdicts) {
    parts.push(`**Review board:** ${Object.entries(manifest.verdicts).map(([k, v]) => `${k}: ${v}`).join(' | ')}`);
  }
  parts.push(`**Estimated play time:** ${outline.estimatedPlayTime || '?'} minutes`);
  if (!approved) {
    parts.push('');
    parts.push('> ⚠️ This script has NOT been approved by the full review board. Do not treat as final.');
  }
  parts.push('');
  parts.push('## Synopsis');
  parts.push('');
  parts.push(outline.synopsis || '(none)');
  parts.push('');
  parts.push(`**Themes:** ${(outline.themes || []).join(', ') || '(none)'}`);
  parts.push('');

  // ---------- Cast ----------
  parts.push('## Cast');
  parts.push('');
  for (const c of cast || []) {
    const meta = [c.age ? `${c.age}` : null, c.pronouns || null].filter(Boolean).join(', ');
    const role = c.storyRole || c.role || '';
    parts.push(`- **${c.name}** (\`${c.id}\`${meta ? `, ${meta}` : ''})${role ? ` — ${role}` : ''}`);
  }
  parts.push('');

  // ---------- Scenes ----------
  parts.push('## Script');
  parts.push('');

  (outline.scenes || []).forEach((scene, index) => {
    parts.push(`### Scene ${index + 1}: ${scene.title} \`${scene.id}\``);
    parts.push('');
    parts.push(`**Location:** ${scene.location || '?'} | **Characters:** ${(scene.characters || []).join(', ') || '—'} | **Beat:** ${scene.emotionalBeat || '—'}`);
    parts.push('');
    if (scene.description) {
      parts.push(`> ${scene.description}`);
      parts.push('');
    }

    const lines = dialogueByScene.get(scene.id);
    if (lines && lines.length > 0) {
      parts.push(formatLines(lines, castById));
      parts.push('');
    }

    // Choice points attached to this scene
    for (const cp of choicesByScene.get(scene.id) || []) {
      parts.push(`#### CHOICE \`${cp.id}\` — ${cp.prompt}`);
      parts.push('');
      const cd = choiceDialogueById.get(cp.id);
      for (const opt of cp.options || []) {
        const spokenText = cd?.options?.find(o => o.id === opt.id)?.text;
        parts.push(`- **(${opt.id})** "${spokenText || opt.text}" → \`${opt.nextScene}\``);
        const responses = cd?.responseDialogue?.[opt.id];
        if (responses && responses.length > 0) {
          for (const r of responses) {
            parts.push(`  - ${formatLine(r, castById).replace(/\n/g, '\n    ')}`);
          }
        }
      }
      parts.push('');
    }

    // Transition footer for choiceless scenes
    if (!(choicesByScene.get(scene.id) || []).length && scene.defaultNextScene) {
      parts.push(scene.defaultNextScene === 'END' ? '*[EPISODE END]*' : `*[CONTINUE TO \`${scene.defaultNextScene}\`]*`);
      parts.push('');
    }

    // Branch-specific ending variants
    const variants = branchDialogueByScene.get(scene.id);
    if (variants && variants.length > 0) {
      parts.push(`#### Ending variants for \`${scene.id}\``);
      parts.push('');
      for (const v of variants) {
        const branch = branchesById.get(v.branchId);
        parts.push(`**Branch \`${v.branchId}\`**${branch?.name ? ` — ${branch.name}` : ''}${branch?.triggeredBy?.length ? ` *(triggered by: ${branch.triggeredBy.join(', ')})*` : ''}`);
        parts.push('');
        parts.push(formatLines(v.lines, castById));
        parts.push('');
      }
    }
  });

  // ---------- Branch map ----------
  if ((outline.branches || []).length > 0) {
    parts.push('## Branch Map');
    parts.push('');
    for (const b of outline.branches) {
      parts.push(`- **\`${b.id || '?'}\`${b.name ? ` — ${b.name}` : ''}**: ${b.description || ''}${b.outcome ? ` *Outcome: ${b.outcome}*` : ''}`);
      if (b.triggeredBy?.length) parts.push(`  - Triggered by: ${b.triggeredBy.map(t => `\`${t}\``).join(', ')}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Resolve the FINAL artifacts of a run folder: the base outline/dialogue,
 * overridden by the latest revision that produced each.
 */
function resolveFinalArtifacts(loadJson, listRevisions) {
  const storyResult = loadJson('01-story-outline.json');
  if (!storyResult) throw new Error('01-story-outline.json not found — not a run folder?');

  let outline = storyResult.episodeOutline;
  let dialogueResult = loadJson('03-dialogue.json') || { dialogue: [] };

  for (const revision of listRevisions()) {
    const revisedStory = loadJson(`${revision}/story-outline.json`);
    if (revisedStory) outline = revisedStory.episodeOutline;
    const revisedDialogue = loadJson(`${revision}/dialogue.json`);
    if (revisedDialogue) dialogueResult = revisedDialogue;
  }

  const cast = [];
  const protagonist = loadJson('02-protagonist.json');
  if (protagonist?.character) cast.push(protagonist.character);
  for (const result of loadJson('02-supporting-characters.json') || []) {
    if (result?.character) cast.push(result.character);
  }
  for (const revision of listRevisions()) {
    for (const result of loadJson(`${revision}/supporting-characters.json`) || []) {
      if (result?.character) cast.push(result.character);
    }
  }

  return { outline, dialogueResult, cast, manifest: loadJson('manifest.json') };
}

module.exports = { compileScreenplay, resolveFinalArtifacts };
