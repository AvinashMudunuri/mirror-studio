#!/usr/bin/env node
/**
 * Generate Episode 1 location art plates for the player app.
 *
 * Backends (first available wins):
 *   1. AWS Bedrock Stability AI — stable-image-ultra-v1:1 (default, us-west-2)
 *   2. AWS Bedrock Nova Canvas — amazon.nova-canvas-v1:0 (legacy; may require prior use)
 *   3. OpenAI DALL-E 3 — when OPENAI_API_KEY is set
 *
 * Env:
 *   BEDROCK_IMAGE_REGION  — default us-west-2 (Stability image models)
 *   BEDROCK_IMAGE_MODEL   — override model id
 *   AWS_REGION            — used for Claude text; image gen uses BEDROCK_IMAGE_REGION
 *
 * Usage:
 *   npm run art:ep1
 *   node scripts/generate-ep1-scene-art.js --only hallway,ending
 *   node scripts/generate-ep1-scene-art.js --backend bedrock
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../apps/player/public/art/ep1');

const NEGATIVE_PROMPT =
  'people, faces, characters, text, words, letters, logos, watermarks, blurry, low quality, distorted';

const STYLE_SUFFIX =
  'Cinematic illustrated background for a young adult visual novel game. Painterly graphic-novel style, warm cinematic lighting, empty scene with no people and no text.';

const PLATES = [
  {
    slug: 'front-steps',
    prompt: `American high school front entrance at early morning golden hour — wide brick steps leading to glass double doors, empty campus, hopeful mood. ${STYLE_SUFFIX}`
  },
  {
    slug: 'hallway',
    prompt: `American high school main hallway between classes — lockers lining both walls, long perspective corridor, mixed fluorescent and window light. ${STYLE_SUFFIX}`
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
    : [
        process.env.BEDROCK_IMAGE_MODEL,
        STABILITY_ULTRA,
        STABILITY_CORE
      ].filter(Boolean);

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
    'No image backend available. Configure AWS credentials for Bedrock (Stability Ultra in us-west-2) or set OPENAI_API_KEY.'
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
