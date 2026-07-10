#!/usr/bin/env node

const {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
} = require('@aws-sdk/client-bedrock');

function awsConfig() {
  const region = process.env.AWS_REGION || 'us-east-1';
  const config = { region };
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      ...(process.env.AWS_SESSION_TOKEN
        ? { sessionToken: process.env.AWS_SESSION_TOKEN }
        : {}),
    };
  }
  return config;
}

function isAnthropic(entry) {
  const haystack = [
    entry.providerName,
    entry.modelId,
    entry.modelArn,
    entry.inferenceProfileId,
    entry.inferenceProfileArn,
    entry.inferenceProfileName,
    ...(entry.models || []).flatMap((m) => [m.modelId, m.modelArn]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes('anthropic') || haystack.includes('claude');
}

async function listFoundationModels(client) {
  const models = [];
  let nextToken;
  do {
    const response = await client.send(
      new ListFoundationModelsCommand({
        byProvider: 'Anthropic',
        nextToken,
      })
    );
    models.push(...(response.modelSummaries || []));
    nextToken = response.nextToken;
  } while (nextToken);
  return models;
}

async function listInferenceProfiles(client) {
  const profiles = [];
  let nextToken;
  do {
    const response = await client.send(
      new ListInferenceProfilesCommand({
        typeEquals: 'SYSTEM_DEFINED',
        nextToken,
      })
    );
    profiles.push(...(response.inferenceProfileSummaries || []));
    nextToken = response.nextToken;
  } while (nextToken);
  return profiles.filter(isAnthropic);
}

function printFoundationModels(models) {
  console.log(`Found ${models.length} Anthropic foundation models:\n`);
  for (const model of models) {
    console.log(`  • ${model.modelId}`);
    if (model.modelName) console.log(`    name: ${model.modelName}`);
    if (model.inferenceTypesSupported?.length) {
      console.log(`    inference: ${model.inferenceTypesSupported.join(', ')}`);
    }
  }
}

function printInferenceProfiles(profiles) {
  console.log(`Found ${profiles.length} Anthropic inference profiles:\n`);
  for (const profile of profiles) {
    console.log(`  • ${profile.inferenceProfileId}`);
    if (profile.inferenceProfileName) {
      console.log(`    name: ${profile.inferenceProfileName}`);
    }
    if (profile.status) console.log(`    status: ${profile.status}`);
    if (profile.models?.length) {
      const modelIds = profile.models.map((m) => m.modelId).filter(Boolean);
      if (modelIds.length) console.log(`    models: ${modelIds.join(', ')}`);
    }
  }
}

function printRecommendations(profiles) {
  const ids = profiles.map((p) => p.inferenceProfileId).filter(Boolean);
  if (ids.length === 0) return;

  const sonnet = ids.find((id) => /sonnet/i.test(id));
  const haiku = ids.find((id) => /haiku/i.test(id));
  const opus = ids.find((id) => /opus/i.test(id));

  console.log('\n💡 Set these for CLAUDE_BACKEND=bedrock:\n');
  if (sonnet) {
    console.log(`  export ANTHROPIC_MODEL=${sonnet}`);
  }
  if (haiku) {
    console.log(`  export ANTHROPIC_REVIEW_MODEL=${haiku}`);
  } else if (sonnet) {
    console.log(`  export ANTHROPIC_REVIEW_MODEL=${sonnet}`);
  }
  if (opus) console.log(`  # opus profile available: ${opus}`);
}

async function main() {
  const region = process.env.AWS_REGION || 'us-east-1';
  const keyPrefix = process.env.AWS_ACCESS_KEY_ID
    ? `${process.env.AWS_ACCESS_KEY_ID.slice(0, 4)}...${process.env.AWS_ACCESS_KEY_ID.slice(-4)}`
    : '(default provider chain)';

  console.log('🔍 LISTING AWS BEDROCK ANTHROPIC MODELS\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Region:   ${region}`);
  console.log(`AWS key:  ${keyPrefix}\n`);

  const client = new BedrockClient(awsConfig());

  console.log('📋 Foundation models (catalog)...\n');
  const foundationModels = await listFoundationModels(client);
  printFoundationModels(foundationModels);

  console.log('\n📋 Inference profiles (use these IDs in ANTHROPIC_MODEL)...\n');
  const inferenceProfiles = await listInferenceProfiles(client);
  printInferenceProfiles(inferenceProfiles);

  console.log('\n═══════════════════════════════════════════════════════════');
  printRecommendations(inferenceProfiles);

  const current = process.env.ANTHROPIC_MODEL;
  if (current) {
    const match = inferenceProfiles.some((p) => p.inferenceProfileId === current);
    console.log(`\nCurrent ANTHROPIC_MODEL=${current}`);
    console.log(match ? '  ✅ matches an available inference profile' : '  ⚠️  not found in listed inference profiles');
  }
}

main().catch((error) => {
  console.error('\n❌ Failed to list Bedrock models');
  console.error(error.message || error);
  if (error.name) console.error(`Error: ${error.name}`);
  process.exit(1);
});
