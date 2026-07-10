#!/usr/bin/env node
/**
 * AWS Bedrock connectivity probe.
 *
 * Verifies that CLAUDE_BACKEND=bedrock credentials and model IDs are valid
 * by making a minimal messages.create() call through both the Bedrock SDK
 * and the production LLMGateway path.
 *
 * Usage:
 *   CLAUDE_BACKEND=bedrock AWS_REGION=us-east-1 \
 *     ANTHROPIC_MODEL=<bedrock-sonnet-id> \
 *     ANTHROPIC_REVIEW_MODEL=<bedrock-review-id> \
 *     npm run test:bedrock
 *
 * Builds @mirror/agents first (same prerequisite as npm run real:episode).
 *
 * See docs/decisions/004-aws-bedrock-alternative-backend.md for model ID notes.
 */

const fs = require('fs');
const path = require('path');
const { AnthropicBedrock } = require('@anthropic-ai/bedrock-sdk');

const GATEWAY_DIST = path.join(__dirname, '..', 'packages', 'agents', 'dist', 'llm-gateway.js');

function printHeader() {
  console.log('🔍 AWS Bedrock Connectivity Check');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Backend:        bedrock (CLAUDE_BACKEND=${process.env.CLAUDE_BACKEND || 'unset'})`);
  console.log(`Region:         ${process.env.AWS_REGION || '(default provider chain)'}`);
  console.log(`Primary model:  ${process.env.ANTHROPIC_MODEL || '(unset — set ANTHROPIC_MODEL)'}`);
  console.log(`Review model:   ${process.env.ANTHROPIC_REVIEW_MODEL || '(unset — optional)'}`);
  console.log(
    `Credentials:    ${
      process.env.AWS_ACCESS_KEY_ID
        ? 'AWS_ACCESS_KEY_ID set'
        : 'default provider chain (~/.aws/credentials or IAM role)'
    }`
  );
  console.log(`Session token:  ${process.env.AWS_SESSION_TOKEN ? 'yes' : 'no'}`);
  console.log('');
}

function buildBedrockClient() {
  const opts = { timeout: 120_000 };
  if (process.env.AWS_REGION) opts.awsRegion = process.env.AWS_REGION;
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    opts.awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
    opts.awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (process.env.AWS_SESSION_TOKEN) opts.awsSessionToken = process.env.AWS_SESSION_TOKEN;
  }
  return new AnthropicBedrock(opts);
}

async function testSdkModel(client, label, modelId) {
  process.stdout.write(`SDK  ${label} (${modelId})... `);
  try {
    const response = await client.messages.create({
      model: modelId,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    });
    const text =
      response.content?.find((b) => b.type === 'text')?.text ||
      JSON.stringify(response.content);
    console.log('✅ OK');
    console.log(`     Response: ${text.trim()}`);
    console.log(
      `     Usage: in=${response.usage.input_tokens} out=${response.usage.output_tokens}`
    );
    return { ok: true, label, modelId };
  } catch (err) {
    const status = err.status || err.statusCode || err.$metadata?.httpStatusCode;
    console.log('❌ FAILED');
    console.log(`     Status: ${status || 'n/a'}`);
    console.log(`     Error:  ${err.message || String(err)}`);
    return { ok: false, label, modelId, error: err.message, status };
  }
}

function loadLLMGateway() {
  if (!fs.existsSync(GATEWAY_DIST)) {
    console.error('');
    console.error('❌ LLMGateway not built — packages/agents/dist/llm-gateway.js is missing.');
    console.error('   Run: npm run build --workspace=@mirror/agents');
    console.error('   Or:  npm run test:bedrock   (builds automatically)');
    process.exit(1);
  }
  return require('../packages/agents/dist/llm-gateway');
}

async function testGatewayModel(modelId) {
  const { createLLMGateway } = loadLLMGateway();

  process.stdout.write(`Gateway (${modelId})... `);
  const llm = createLLMGateway({
    claudeBackend: 'bedrock',
    bedrock: {
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
    maxTotalTokens: 1000,
  });

  try {
    const response = await llm.call('Reply with exactly: OK', {
      provider: 'claude',
      model: modelId,
      maxTokens: 16,
      temperature: 0,
    });
    console.log('✅ OK');
    console.log(`     Response: ${response.content.trim()}`);
    console.log(
      `     Usage: in=${response.usage.inputTokens} out=${response.usage.outputTokens}`
    );
    return { ok: true, label: 'gateway', modelId };
  } catch (err) {
    console.log('❌ FAILED');
    console.log(`     Error: ${err.message || String(err)}`);
    return { ok: false, label: 'gateway', modelId, error: err.message };
  }
}

async function main() {
  if (process.env.CLAUDE_BACKEND !== 'bedrock') {
    console.error('❌ CLAUDE_BACKEND must be set to "bedrock" for this probe.');
    console.error('   export CLAUDE_BACKEND=bedrock');
    process.exit(1);
  }

  const primaryModel = process.env.ANTHROPIC_MODEL;
  if (!primaryModel) {
    console.error('❌ ANTHROPIC_MODEL is required (must be a Bedrock model/inference-profile ID).');
    console.error('   Look up the correct ID in the AWS Bedrock console for your region.');
    process.exit(1);
  }

  printHeader();

  const client = buildBedrockClient();
  const results = [];

  results.push(await testSdkModel(client, 'primary model', primaryModel));

  const reviewModel = process.env.ANTHROPIC_REVIEW_MODEL;
  if (reviewModel && reviewModel !== primaryModel) {
    results.push(await testSdkModel(client, 'review model', reviewModel));
  }

  results.push(await testGatewayModel(primaryModel));

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Summary: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('');
    console.log('Common fixes:');
    console.log('  • Model not found → set ANTHROPIC_MODEL to a Bedrock ID from the AWS console');
    console.log('  • Auth error (403) → check AWS credentials and Bedrock model access');
    console.log('  • Gateway failed but SDK passed → run: npm run build --workspace=@mirror/agents');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
