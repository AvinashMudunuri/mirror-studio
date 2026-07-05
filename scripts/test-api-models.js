#!/usr/bin/env node

const Anthropic = require('@anthropic-ai/sdk');

const MODELS_TO_TEST = [
  'claude-3-5-sonnet-20240620',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  'claude-2.1',
  'claude-2.0',
];

async function testModel(client, modelName) {
  try {
    const response = await client.messages.create({
      model: modelName,
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    return { model: modelName, status: '✅ AVAILABLE', response: response.content[0].text };
  } catch (error) {
    if (error.status === 404) {
      return { model: modelName, status: '❌ NOT FOUND', error: 'Model not available for your API key' };
    } else if (error.status === 401) {
      return { model: modelName, status: '🔒 AUTH ERROR', error: 'Invalid API key' };
    } else if (error.status === 429) {
      return { model: modelName, status: '⏸️  RATE LIMITED', error: 'Too many requests' };
    } else {
      return { model: modelName, status: '⚠️  ERROR', error: error.message };
    }
  }
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('\nRun: export ANTHROPIC_API_KEY="your-key-here"');
    process.exit(1);
  }

  console.log('🔍 TESTING ANTHROPIC API KEY MODEL ACCESS\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.slice(-4)}\n`);
  console.log('Testing models...\n');

  const client = new Anthropic({ apiKey });

  for (const model of MODELS_TO_TEST) {
    process.stdout.write(`Testing ${model}... `);
    const result = await testModel(client, model);
    console.log(result.status);
    if (result.error) {
      console.log(`  └─ ${result.error}`);
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('\n✅ Test complete!');
  console.log('\nRecommendation:');
  console.log('  - Use the first ✅ AVAILABLE model in your agent configs');
  console.log('  - Claude 3 Haiku is fastest and cheapest');
  console.log('  - Claude 3 Opus is most capable but expensive');
  console.log('  - Claude 3.5 Sonnet is the newest (if available)');
}

main().catch(console.error);
