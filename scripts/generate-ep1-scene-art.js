#!/usr/bin/env node
/**
 * Generate Episode 1 location art plates for the player app.
 *
 * Backends (first match wins):
 *   1. OPENAI_API_KEY  → DALL-E 3 (dall-e-3)
 *   2. AWS credentials → Amazon Nova Canvas (amazon.nova-canvas-v1:0)
 *
 * Usage:
 *   node scripts/generate-ep1-scene-art.js
 *   node scripts/generate-ep1-scene-art.js --only hallway,ending
 *
 * Output: apps/player/public/art/ep1/<slug>.png
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../apps/player/public/art/ep1');

const STYLE_SUFFIX =
  'Cinematic illustrated background for a young adult visual novel game. Painterly graphic-novel style, warm cinematic lighting, empty scene with no people and no text.';

const PLATES = [
  {
    slug: 'front-steps',
    prompt: `American high school front entrance at early morning golden hour — wide brick steps leading to glass double doors, empty campus, hopeful mood. ${STYLE_SUFFIX}`
  },
  {
    slug: 'hallway',
    prompt: `Busy American high school main hallway between classes — lockers lining both walls, long perspective corridor, mixed fluorescent and window light. ${STYLE_SUFFIX}`
  },
  {
    slug: 'classroom',
    prompt: `Homeroom classroom interior — rows of student desks, whiteboard at front, soft afternoon sunlight through tall windows. ${STYLE_SUFFIX}`
  },
  {
    slug: 'cafeteria',
    prompt: `School cafeteria wide interior — long lunch tables, serving line in background, bright warm afternoon light. ${STYLE_SUFFIX}`
  },
  {
    slug: 'ending',
    prompt: `School exterior courtyard and front steps at golden hour sunset — peaceful reflective ending mood, orange and purple sky. ${STYLE_SUFFIX}`
  }
];

function parseOnlyArg() {
  const idx = process.argv.indexOf('--only');
  if (idx === -1) return null;
  return new Set(
    (process.argv[idx + 1] || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );
}

async function generateOpenAI(prompt, outPath) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return false;

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      response_format: 'b64_json'
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI image API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI response missing b64_json');
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  return true;
}

async function generateBedrock(prompt, outPath) {
  let BedrockRuntimeClient;
  let InvokeModelCommand;
  try {
    ({ BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime'));
  } catch {
    return false;
  }

  const region = process.env.AWS_REGION || 'us-east-1';
  const config = { region };
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {})
    };
  }

  const client = new BedrockRuntimeClient(config);
  const payload = {
    taskType: 'TEXT_IMAGE',
    textToImageParams: {
      text: prompt,
      style: 'GRAPHIC_NOVEL_ILLUSTRATION'
    },
    imageGenerationConfig: {
      width: 1280,
      height: 720,
      quality: 'standard',
      numberOfImages: 1,
      cfgScale: 7
    }
  };

  const response = await client.send(
    new InvokeModelCommand({
      modelId: process.env.BEDROCK_IMAGE_MODEL || 'amazon.nova-canvas-v1:0',
      body: JSON.stringify(payload)
    })
  );

  const body = JSON.parse(new TextDecoder().decode(response.body));
  const b64 = body.images?.[0];
  if (!b64) throw new Error('Bedrock response missing images[0]');
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  return true;
}

async function generatePlate(plate) {
  const outPath = path.join(OUT_DIR, `${plate.slug}.png`);
  console.log(`Generating ${plate.slug} → ${path.relative(process.cwd(), outPath)}`);

  if (await generateOpenAI(plate.prompt, outPath)) {
    console.log(`  ✓ OpenAI DALL-E 3`);
    return;
  }

  try {
    if (await generateBedrock(plate.prompt, outPath)) {
      console.log(`  ✓ Amazon Nova Canvas`);
      return;
    }
  } catch (err) {
    console.error(`  Bedrock failed: ${err.message}`);
  }

  throw new Error(
    'No image backend available. Set OPENAI_API_KEY or enable a Bedrock image model (e.g. amazon.nova-canvas-v1:0).'
  );
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const only = parseOnlyArg();
  const plates = only ? PLATES.filter(p => only.has(p.slug)) : PLATES;

  if (!plates.length) {
    console.error('No plates matched --only filter.');
    process.exit(1);
  }

  for (const plate of plates) {
    await generatePlate(plate);
  }

  console.log('\nDone. Player maps these in apps/player/src/lib/scene-art.ts');
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
