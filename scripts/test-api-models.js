#!/usr/bin/env node

const Anthropic = require('@anthropic-ai/sdk');

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

  const client = new Anthropic({ apiKey });

  // First, try to fetch available models dynamically
  console.log('📋 Fetching available models from Anthropic API...\n');
  
  let modelsToTest = [];
  try {
    const modelsList = await client.models.list();
    modelsToTest = modelsList.data.map(m => m.id);
    console.log(`Found ${modelsToTest.length} models:\n`);
    modelsToTest.forEach(m => console.log(`  • ${m}`));
    console.log('');
  } catch (error) {
    console.log('⚠️  Could not fetch models list from API');
    console.log(`   Error: ${error.message}`);
    console.log('\n📌 Falling back to known Claude models...\n');
    
    // Fallback to hardcoded list if API doesn't support models.list()
    modelsToTest = [
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
    ];
  }

  console.log('Testing model access...\n');

  const availableModels = [];
  const unavailableModels = [];

  for (const model of modelsToTest) {
    process.stdout.write(`Testing ${model}... `);
    const result = await testModel(client, model);
    console.log(result.status);
    
    if (result.status === '✅ AVAILABLE') {
      availableModels.push(model);
    } else {
      unavailableModels.push(model);
      if (result.error) {
        console.log(`  └─ ${result.error}`);
      }
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('\n📊 SUMMARY:\n');
  console.log(`✅ Available: ${availableModels.length}`);
  console.log(`❌ Unavailable: ${unavailableModels.length}`);

  if (availableModels.length > 0) {
    console.log('\n🎉 Available models for your API key:');
    availableModels.forEach(m => console.log(`  • ${m}`));
    
    console.log('\n💡 Recommendation:');
    
    // Prioritize models by capability and cost
    if (availableModels.some(m => m.includes('claude-3-5-sonnet'))) {
      const model = availableModels.find(m => m.includes('claude-3-5-sonnet'));
      console.log(`  🥇 Best choice: ${model}`);
      console.log('     (Latest, most capable)');
    } else if (availableModels.some(m => m.includes('claude-3-opus'))) {
      const model = availableModels.find(m => m.includes('claude-3-opus'));
      console.log(`  🥇 Best choice: ${model}`);
      console.log('     (Most capable Claude 3 model)');
    } else if (availableModels.some(m => m.includes('claude-3-sonnet'))) {
      const model = availableModels.find(m => m.includes('claude-3-sonnet'));
      console.log(`  🥇 Best choice: ${model}`);
      console.log('     (Balanced performance and cost)');
    } else if (availableModels.some(m => m.includes('claude-3-haiku'))) {
      const model = availableModels.find(m => m.includes('claude-3-haiku'));
      console.log(`  🥇 Best choice: ${model}`);
      console.log('     (Fast and cost-effective)');
    } else {
      console.log(`  🥇 Use: ${availableModels[0]}`);
    }
  } else {
    console.log('\n❌ NO MODELS AVAILABLE');
    console.log('\nThis likely means:');
    console.log('  1. Missing payment method on your Anthropic account');
    console.log('  2. Invalid or expired API key');
    console.log('  3. Account not fully activated');
    console.log('\n🔧 Fix:');
    console.log('  → Add payment method: https://console.anthropic.com/settings/billing');
    console.log('  → Verify API key: https://console.anthropic.com/settings/keys');
    console.log('  → See: /workspace/ANTHROPIC-API-TROUBLESHOOTING.md');
  }
}

main().catch(console.error);
