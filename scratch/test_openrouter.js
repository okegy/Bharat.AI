const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const match = env.match(/OPENROUTER_API_KEY=(.*)/);
const key = match ? match[1].trim().replace(/^["']|["']$/g, '') : '';

async function testWithTools() {
  const tools = [
    {
      type: "function",
      function: {
        name: "update_user_profile",
        description: "Updates profile field",
        parameters: {
          type: "object",
          properties: {
            fullName: { type: "string" },
            schemeSelected: { type: "string" }
          }
        }
      }
    }
  ];

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bharat-ai.vercel.app',
        'X-Title': 'Bharat-AI'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'user', content: 'My name is Ramesh Kumar and I want PM-KISAN scheme.' }
        ],
        tools: tools,
        tool_choice: 'auto'
      })
    });
    console.log('Status with tools:', res.status);
    const data = await res.json();
    console.log('Tool response:', JSON.stringify(data.choices?.[0]?.message, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
testWithTools();
