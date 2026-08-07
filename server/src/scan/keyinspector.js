const PROVIDERS = {
  gemini: {
    label: "Google Gemini",
    autoDetect: /^AIza[A-Za-z0-9_-]{30,}$/,
    testUrl: (key) => `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
    testHeaders: (key) => ({}),
    okStatus: [200],
    listModels: true,
    completionTest: {
      url: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      body: { contents: [{ parts: [{ text: "Say 'ok'" }] }] },
    },
    rateLimitHeaders: null,
  },
  openai: {
    label: "OpenAI",
    autoDetect: /^sk-(?:proj-)?[A-Za-z0-9_-]{20,}$/,
    testUrl: () => "https://api.openai.com/v1/models",
    testHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    okStatus: [200],
    listModels: true,
    completionTest: {
      url: () => "https://api.openai.com/v1/chat/completions",
      headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
      body: { model: "gpt-4o-mini", messages: [{ role: "user", content: "Say ok" }], max_tokens: 5 },
    },
    rateLimitHeaders: ["x-ratelimit-limit-requests", "x-ratelimit-remaining-requests", "x-ratelimit-reset-requests"],
  },
  xai: {
    label: "xAI Grok",
    autoDetect: /^xai-[A-Za-z0-9]{40,}$/,
    testUrl: () => "https://api.x.ai/v1/models",
    testHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    okStatus: [200],
    listModels: true,
    completionTest: {
      url: () => "https://api.x.ai/v1/chat/completions",
      headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
      body: { model: "grok-3", messages: [{ role: "user", content: "Say ok" }], max_tokens: 5 },
    },
    rateLimitHeaders: null,
  },
  anthropic: {
    label: "Anthropic Claude",
    autoDetect: /^sk-ant-[A-Za-z0-9_-]{30,}$/,
    testUrl: () => "https://api.anthropic.com/v1/models",
    testHeaders: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
    okStatus: [200],
    listModels: true,
    completionTest: {
      url: () => "https://api.anthropic.com/v1/messages",
      headers: (key) => ({ "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }),
      body: { model: "claude-3-5-haiku-latest", max_tokens: 5, messages: [{ role: "user", content: "Say ok" }] },
    },
    rateLimitHeaders: ["anthropic-ratelimit-requests-limit", "anthropic-ratelimit-requests-remaining", "anthropic-ratelimit-tokens-limit", "anthropic-ratelimit-tokens-remaining"],
  },
  mistral: {
    label: "Mistral AI",
    autoDetect: /^[A-Za-z0-9]{20,40}$/,
    testUrl: () => "https://api.mistral.ai/v1/models",
    testHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    okStatus: [200],
    listModels: true,
    completionTest: {
      url: () => "https://api.mistral.ai/v1/chat/completions",
      headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
      body: { model: "mistral-small-latest", messages: [{ role: "user", content: "Say ok" }], max_tokens: 5 },
    },
    rateLimitHeaders: null,
  },
  deepseek: {
    label: "DeepSeek",
    autoDetect: /^sk-[A-Za-z0-9]{32,}$/,
    testUrl: () => "https://api.deepseek.com/v1/models",
    testHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    okStatus: [200],
    listModels: true,
    completionTest: {
      url: () => "https://api.deepseek.com/chat/completions",
      headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
      body: { model: "deepseek-chat", messages: [{ role: "user", content: "Say ok" }], max_tokens: 5 },
    },
    rateLimitHeaders: null,
  },
  groq: {
    label: "Groq",
    autoDetect: /^gsk_[A-Za-z0-9]{30,}$/,
    testUrl: () => "https://api.groq.com/openai/v1/models",
    testHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    okStatus: [200],
    listModels: true,
    completionTest: {
      url: () => "https://api.groq.com/openai/v1/chat/completions",
      headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
      body: { model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: "Say ok" }], max_tokens: 5 },
    },
    rateLimitHeaders: ["x-ratelimit-limit-requests", "x-ratelimit-remaining-requests", "x-ratelimit-reset-requests"],
  },
  together: {
    label: "Together AI",
    autoDetect: /^[A-Za-z0-9]{30,50}$/,
    testUrl: () => "https://api.together.xyz/v1/models",
    testHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    okStatus: [200],
    listModels: true,
    rateLimitHeaders: null,
  },
  cohere: {
    label: "Cohere",
    autoDetect: /^[A-Za-z0-9]{30,50}$/,
    testUrl: (key) => `https://api.cohere.com/v2/models`,
    testHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    okStatus: [200],
    listModels: true,
    rateLimitHeaders: null,
  },
  perplexity: {
    label: "Perplexity AI",
    autoDetect: /^pplx-[A-Za-z0-9]{30,}$/,
    testUrl: () => "https://api.perplexity.ai/chat/completions",
    testHeaders: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
    okStatus: [200],
    listModels: false,
    completionTest: {
      url: () => "https://api.perplexity.ai/chat/completions",
      headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
      body: { model: "sonar-small-online", messages: [{ role: "user", content: "Say ok" }], max_tokens: 5 },
    },
    rateLimitHeaders: null,
  },
  nvidiaNim: {
    label: "NVIDIA NIM",
    autoDetect: /^nvapi-[A-Za-z0-9_-]{20,}$/,
    testUrl: () => "https://integrate.api.nvidia.com/v1/models",
    testHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    okStatus: [200],
    listModels: true,
    rateLimitHeaders: null,
  },
  completions: {
    label: "Completions AI",
    autoDetect: /^sk-cp_[A-Za-z0-9_-]{20,}$/,
    testUrl: () => "https://completions.me/api/v1/models",
    testHeaders: (key) => ({ authorization: `Bearer ${key}` }),
    okStatus: [200],
    listModels: true,
    rateLimitHeaders: null,
  },
};

function extractRateLimits(headers, headerNames) {
  if (!headerNames || !headers) return null;
  const limits = {};
  for (const name of headerNames) {
    const val = headers.get(name);
    if (val !== null) limits[name] = val;
  }
  return Object.keys(limits).length > 0 ? limits : null;
}

export async function inspectKey(key) {
  if (!key || key.length < 10) {
    return { ok: false, error: "Key too short to be valid" };
  }

  // Auto-detect provider
  let detectedProvider = null;
  for (const [id, p] of Object.entries(PROVIDERS)) {
    if (p.autoDetect && p.autoDetect.test(key)) {
      detectedProvider = id;
      break;
    }
  }

  if (!detectedProvider) {
    return {
      ok: false,
      error: "Could not auto-detect key format. Supported: Gemini, OpenAI, xAI Grok, Anthropic, Mistral, DeepSeek, Groq, Together, Perplexity, NVIDIA",
      format: key.slice(0, 10) + "...",
    };
  }

  const provider = PROVIDERS[detectedProvider];
  const result = {
    ok: false,
    provider: detectedProvider,
    label: provider.label,
    format: `${detectedProvider} (${key.slice(0, 8)}...)`,
    status: null,
    rateLimits: null,
    models: [],
    completionTest: null,
    latency: null,
    errors: [],
  };

  const startTime = Date.now();

  // Step 1: Basic API access test
  try {
    const url = typeof provider.testUrl === "function" ? provider.testUrl(key) : provider.testUrl();
    const headers = provider.testHeaders ? provider.testHeaders(key) : {};
    const res = await fetch(url, {
      headers: { ...headers, "user-agent": "SiteAudit-KeyInspector/1.0" },
      signal: AbortSignal.timeout(12000),
    });

    result.status = res.status;
    result.latency = Date.now() - startTime;
    result.rateLimits = extractRateLimits(res.headers, provider.rateLimitHeaders);

    if (provider.okStatus.includes(res.status)) {
      result.ok = true;

      // Step 2: List models if supported
      if (provider.listModels) {
        try {
          const data = await res.json();
          const modelList = data?.data || data?.models || data?.model || [];
          result.models = (Array.isArray(modelList) ? modelList : [modelList])
            .slice(0, 15)
            .map(m => typeof m === "string" ? m : m.id || m.name || m.model || "?");
        } catch {}
      }

      // Step 3: Test a small completion
      if (provider.completionTest) {
        try {
          const cStart = Date.now();
          const curl = provider.completionTest.url(key);
          const cheaders = provider.completionTest.headers
            ? provider.completionTest.headers(key)
            : { "content-type": "application/json", ...provider.testHeaders(key) };
          const cres = await fetch(curl, {
            method: "POST",
            headers: cheaders,
            body: JSON.stringify(provider.completionTest.body),
            signal: AbortSignal.timeout(15000),
          });
          const cLatency = Date.now() - cStart;

          if (cres.ok) {
            let text = "";
            try {
              const cdata = await cres.json();
              text = cdata?.candidates?.[0]?.content?.parts?.[0]?.text
                || cdata?.choices?.[0]?.message?.content
                || cdata?.content?.[0]?.text
                || cdata?.response
                || "";
            } catch {}
            
            result.completionTest = {
              ok: true,
              latency: cLatency,
              model: provider.completionTest.body.model || "unknown",
              response: text.trim(),
              tokenUsage: extractTokenUsage(cres.headers),
            };
          } else {
            const errText = await cres.text().catch(() => "");
            result.completionTest = {
              ok: false,
              status: cres.status,
              latency: cLatency,
              error: errText.slice(0, 200),
            };

            // Check specific error messages
            if (cres.status === 429) {
              result.errors.push("Rate limited — quota exhausted or too many requests");
            } else if (cres.status === 402) {
              result.errors.push("Billing required — no credits/balance on this account");
            }
          }
        } catch (err) {
          result.completionTest = { ok: false, error: err.message };
        }
      }
    } else {
      const errText = await res.text().catch(() => "");
      result.errors.push(`API returned HTTP ${res.status}`);

      if (res.status === 401 || res.status === 403) {
        result.errors.push("Invalid or revoked API key");
      } else if (res.status === 429) {
        result.errors.push("Rate limited — key is valid but quota exhausted");
      } else {
        result.errors.push(errText.slice(0, 150));
      }
    }
  } catch (err) {
    result.status = 0;
    result.errors.push(`Connection failed: ${err.message}`);
  }

  return result;
}

function extractTokenUsage(headers) {
  try {
    const usage = {};
    const inputTokens = headers.get("x-usage-input-tokens")
      || headers.get("x-usage-prompt-tokens")
      || headers.get("x-ratelimit-tokens");
    const outputTokens = headers.get("x-usage-output-tokens")
      || headers.get("x-usage-completion-tokens");
    if (inputTokens) usage.input = parseInt(inputTokens);
    if (outputTokens) usage.output = parseInt(outputTokens);
    return Object.keys(usage).length > 0 ? usage : null;
  } catch {
    return null;
  }
}
