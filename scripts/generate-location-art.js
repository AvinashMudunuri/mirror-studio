#!/usr/bin/env node
/**
 * Generate shared location art plates for Season 1 (NEW_SCHOOL).
 *
 * Episode 1 plates already live under apps/player/public/art/ep1/.
 * This script generates the missing campus locations used by episodes 2–5:
 *   library, courtyard, auditorium
 *
 * Backends (first available wins): same as generate-ep1-scene-art.js
 *   Bedrock Stability Ultra → Stability Core → OpenAI DALL-E 3
 *
 * Usage:
 *   npm run art:locations
 *   node scripts/generate-location-art.js --only library
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../apps/player/public/art/locations');

const NEGATIVE_PROMPT =
  'people, faces, characters, text, words, letters, logos, watermarks, blurry, low quality, distorted';

const STYLE_SUFFIX =
  'Cinematic illustrated background for a young adult visual novel game. Painterly graphic-novel style, warm cinematic lighting, empty scene with no people and no text.';

const PLATES = [
  {
    slug: 'library',
    prompt: `American high school library study area — wooden tables, tall bookshelves, soft afternoon light through high windows, quiet focused mood. ${STYLE_SUFFIX}`
  },
  {
    slug: 'courtyard',
    prompt: `American high school outdoor courtyard lunch area — picnic tables, brick walls, trees, bright midday sun, open-air campus mood. ${STYLE_SUFFIX}`
  },
  {
    slug: 'auditorium',
    prompt: `High school auditorium stage and empty seats — warm stage lights, velvet curtains, expectant showcase mood before a performance. ${STYLE_SUFFIX}`
  }
];

const STABILITY_ULTRA = 'stability.stable-image-ultra-v1:1';
const STABILITY_CORE = 'stability.stable-image-core-v1:1';
const NOVA_CANVAS = 'amazon.nova-canvas-v1:0';

function parseArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? true;
}

function parseOnlyArg() {
  const raw = parseArg('--only');
  if (!raw || raw === true) return null;
  return new Set(
    String(raw)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  );
}

function bedrockCredentials() {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) return null;
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {})
  };
}

function getBedrockRuntime() {
  try {
    return require('@aws-sdk/client-bedrock-runtime');
  } catch {
    return null;
  }
}

async function invokeBedrock({ region, modelId, body }) {
  const sdk = getBedrockRuntime();
  if (!sdk) throw new Error('@aws-sdk/client-bedrock-runtime is not installed');

  const credentials = bedrockCredentials();
  if (!credentials) throw new Error('AWS credentials not configured');

  const client = new sdk.BedrockRuntimeClient({ region, credentials });
  const response = await client.send(
    new sdk.InvokeModelCommand({
      modelId,
      body: JSON.stringify(body),
      contentType: 'application/json',
      accept: 'application/json'
    })
  );

  return JSON.parse(new TextDecoder().decode(response.body));
}

async function generateBedrockStability(prompt, outPath, modelId) {
  const region = process.env.BEDROCK_IMAGE_REGION || 'us-west-2';
  const body = {
    prompt,
    negative_prompt: NEGATIVE_PROMPT,
    aspect_ratio: '16:9',
    output_format: 'png'
  };

  const parsed = await invokeBedrock({ region, modelId, body });
  const b64 = parsed.images?.[0];
  if (!b64) throw new Error(`${modelId} response missing images[0]`);
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  return { modelId, region };
}

async function generateBedrockNova(prompt, outPath) {
  const modelId = process.env.BEDROCK_IMAGE_MODEL || NOVA_CANVAS;
  const region = process.env.BEDROCK_IMAGE_REGION || process.env.AWS_REGION || 'us-east-1';
  const body = {
    taskType: 'TEXT_IMAGE',
    textToImageParams: {
      text: prompt,
      negativeText: NEGATIVE_PROMPT,
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

  const parsed = await invokeBedrock({ region, modelId, body });
  const b64 = parsed.images?.[0];
  if (!b64) throw new Error(`${modelId} response missing images[0]`);
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  return { modelId, region };
}

async function generateBedrock(prompt, outPath, forcedModel) {
  const attempts = forcedModel
    ? [forcedModel]
    : [process.env.BEDROCK_IMAGE_MODEL, STABILITY_ULTRA, STABILITY_CORE].filter(Boolean);

  const seen = new Set();
  const errors = [];

  for (const modelId of attempts) {
    if (seen.has(modelId)) continue;
    seen.add(modelId);

    try {
      if (modelId.startsWith('stability.')) {
        return await generateBedrockStability(prompt, outPath, modelId);
      }
      if (modelId.startsWith('amazon.nova-canvas')) {
        return await generateBedrockNova(prompt, outPath);
      }
      throw new Error(`Unknown Bedrock image model: ${modelId}`);
    } catch (err) {
      errors.push(`${modelId}: ${err.message}`);
    }
  }

  throw new Error(`All Bedrock image models failed:\n  ${errors.join('\n  ')}`);
}

async function generateOpenAI(prompt, outPath) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

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
  return { modelId: 'dall-e-3', region: 'openai' };
}

async function generatePlate(plate, backend) {
  const outPath = path.join(OUT_DIR, `${plate.slug}.png`);
  console.log(`Generating ${plate.slug} → ${path.relative(process.cwd(), outPath)}`);

  if (backend === 'openai') {
    const meta = await generateOpenAI(plate.prompt, outPath);
    console.log(`  ✓ ${meta.modelId}`);
    return;
  }

  if (backend !== 'openai' && bedrockCredentials()) {
    try {
      const forced = backend === 'bedrock' ? process.env.BEDROCK_IMAGE_MODEL : undefined;
      const meta = await generateBedrock(plate.prompt, outPath, forced);
      console.log(`  ✓ ${meta.modelId} (${meta.region})`);
      return;
    } catch (err) {
      if (backend === 'bedrock') throw err;
      console.error(`  Bedrock failed: ${err.message}`);
    }
  }

  const openai = await generateOpenAI(plate.prompt, outPath);
  if (openai) {
    console.log(`  ✓ ${openai.modelId}`);
    return;
  }

  throw new Error(
    'No image backend available. Configure AWS credentials for Bedrock or set OPENAI_API_KEY.'
  );
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const only = parseOnlyArg();
  const backend = parseArg('--backend');
  const plates = only ? PLATES.filter(p => only.has(p.slug)) : PLATES;

  if (!plates.length) {
    console.error('No plates matched --only filter.');
    process.exit(1);
  }

  console.log(
    `Backend: ${backend || 'auto'} | image region: ${process.env.BEDROCK_IMAGE_REGION || 'us-west-2'}`
  );

  for (const plate of plates) {
    await generatePlate(plate, backend);
  }

  console.log('\nDone. Player maps these in apps/player/src/lib/scene-art.ts');
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
