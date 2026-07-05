# Anthropic API Key Troubleshooting

## Problem
All Claude models return `404 NOT FOUND` for your API key: `sk-ant-api...fwAA`

This indicates an **account-level issue**, not just missing model access.

## Solutions (try in order)

### 1. Verify API Key in Anthropic Console

1. Go to: https://console.anthropic.com/settings/keys
2. Log in with your account
3. Check if your API key is:
   - ✅ **Active** (not revoked or expired)
   - ✅ **Correct** (matches what you copied)
4. If unsure, **delete the old key** and **create a new one**

### 2. Add Payment Method (Most Common Fix)

Even if you're on free tier, Anthropic requires a valid payment method:

1. Go to: https://console.anthropic.com/settings/billing
2. Click **"Add payment method"**
3. Add a valid credit/debit card
4. You won't be charged unless you exceed free tier limits
5. Wait 5-10 minutes for activation
6. Test again with: `npm run test:models`

### 3. Check Account Status

1. Go to: https://console.anthropic.com/settings/account
2. Verify:
   - Email is confirmed (check spam folder for verification email)
   - Account is active (not suspended)
   - Organization/workspace is properly set up

### 4. Check Regional Restrictions

If you're in a restricted region, Anthropic API might not work. Check:
- https://www.anthropic.com/service-locations

### 5. Create a Fresh API Key

1. Delete your current key at: https://console.anthropic.com/settings/keys
2. Create a new key
3. Copy it carefully (include all characters)
4. Test immediately in console with a curl command:

```bash
curl https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: YOUR_NEW_KEY_HERE" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-haiku-20240307",
    "max_tokens": 10,
    "messages": [{"role": "user", "content": "Hi"}]
  }'
```

If this works, update your environment:
```bash
export ANTHROPIC_API_KEY="your-new-key-here"
npm run test:models
```

## Alternative: Use OpenAI Instead (Temporary)

If Anthropic issues persist, we can switch to OpenAI's GPT models:

1. Get an OpenAI API key: https://platform.openai.com/api-keys
2. Set it: `export OPENAI_API_KEY="sk-..."`
3. We'll update the agents to use GPT-4 instead

## Need Help?

Contact Anthropic support: https://support.anthropic.com/

Include:
- Your API key (first 10 chars): `sk-ant-api...`
- Error message: "404 not_found_error for all models"
- Request ID from test: Check the error output
