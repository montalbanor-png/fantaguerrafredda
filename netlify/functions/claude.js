exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const body = JSON.parse(event.body);
    const { playerName, playerRole } = body;
    console.log('Player:', playerName, playerRole);

    const TAVILY_KEY = process.env.TAVILY_API_KEY;
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    console.log('Keys present:', !!TAVILY_KEY, !!ANTHROPIC_KEY);

    const roleNames = {P:'portiere',D:'difensore',C:'centrocampista',A:'attaccante'};

    // 1. Cerca notizie con Tavily
    console.log('Calling Tavily...');
    const tavilyRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_KEY,
        query: `${playerName} calciomercato Serie A 2025`,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true
      })
    });
    const tavilyData = await tavilyRes.json();
    console.log('Tavily status:', tavilyRes.status);
    console.log('Tavily error:', tavilyData.error || 'none');

    const news = (tavilyData.results || []).map(r => `- ${r.title}: ${r.content}`).join('\n');
    const answer = tavilyData.answer || '';

    // 2. Claude analizza
    console.log('Calling Anthropic...');
    const prompt = `Sei un esperto di fantacalcio Serie A. Analizza ${playerName} (${roleNames[playerRole] || playerRole}) per la stagione 2025/26.

Ultime notizie di mercato:
${answer ? `Sintesi: ${answer}\n` : ''}${news || 'Nessuna notizia recente trovata.'}

Rispondi in 3-4 frasi in italiano su: situazione al club, voci di mercato, probabilità di restare in Serie A.
Concludi SEMPRE con una riga esatta:
🟢 Probabilmente resta in Serie A
🟡 Situazione incerta
🔴 Probabile addio alla Serie A`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const claudeData = await claudeRes.json();
    console.log('Anthropic status:', claudeRes.status);
    console.log('Anthropic error:', claudeData.error || 'none');

    const text = claudeData.content?.[0]?.text || 'Analisi non disponibile.';
    console.log('Success, text length:', text.length);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    };
  } catch (e) {
    console.log('EXCEPTION:', e.message, e.stack);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
