import { useState, useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "sa_settings";

const DEFAULT_SETTINGS = {
  apiKeys: {
    gemini: "",
    xai: "",
    openai: "",
    anthropic: "",
    completions: "",
    mistral: "",
    nvidiaNim: "",
  },
  lmStudio: {
    enabled: false,
    baseUrl: "http://localhost:1234/v1",
    model: "",
  },
};

const API_KEY_FIELDS = [
  { key: "gemini", label: "Gemini API Key", placeholder: "sk-..." },
  { key: "xai", label: "xAI API Key", placeholder: "sk-..." },
  { key: "openai", label: "OpenAI API Key", placeholder: "sk-..." },
  { key: "anthropic", label: "Anthropic API Key", placeholder: "sk-..." },
  { key: "completions", label: "Completions AI Key", placeholder: "sk-..." },
  { key: "mistral", label: "Mistral API Key", placeholder: "sk-..." },
  { key: "nvidiaNim", label: "NVIDIA NIM API Key", placeholder: "sk-..." },
];

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...parsed.apiKeys },
        lmStudio: { ...DEFAULT_SETTINGS.lmStudio, ...parsed.lmStudio },
      };
    }
  } catch {
    /* corrupted — fall through to defaults */
  }
  return { ...DEFAULT_SETTINGS, apiKeys: { ...DEFAULT_SETTINGS.apiKeys }, lmStudio: { ...DEFAULT_SETTINGS.lmStudio } };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(loadSettings);
  const [showKeys, setShowKeys] = useState({});
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});
  const [lmStatus, setLmStatus] = useState(null);
  const [lmTesting, setLmTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const saveTimer = useRef(null);

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(clearToast, 4000);
  }

  // Debounced persist to localStorage
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [settings]);

  function updateApiKey(key, value) {
    setSettings((prev) => ({
      ...prev,
      apiKeys: { ...prev.apiKeys, [key]: value },
    }));
  }

  function updateLmStudio(field, value) {
    setSettings((prev) => ({
      ...prev,
      lmStudio: { ...prev.lmStudio, [field]: value },
    }));
  }

  function toggleKeyVisibility(key) {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function testApiKey(keyName) {
    setTesting((prev) => ({ ...prev, [keyName]: true }));
    setTestResults((prev) => ({ ...prev, [keyName]: null }));
    try {
      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: keyName, key: settings.apiKeys[keyName] }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTestResults((prev) => ({ ...prev, [keyName]: "ok" }));
      } else {
        setTestResults((prev) => ({ ...prev, [keyName]: "fail" }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [keyName]: "fail" }));
    } finally {
      setTesting((prev) => ({ ...prev, [keyName]: false }));
    }
  }

  async function testLmStudio() {
    setLmTesting(true);
    setLmStatus(null);
    try {
      const url = settings.lmStudio.baseUrl.replace(/\/+$/, "") + "/models";
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const modelList = data?.data || [];
        setLmStatus({
          reachable: true,
          models: modelList.length,
          message: `Connected · ${modelList.length} model${modelList.length !== 1 ? "s" : ""} available`,
        });
      } else {
        setLmStatus({ reachable: false, message: `HTTP ${res.status} — check your LM Studio instance` });
      }
    } catch (err) {
      setLmStatus({ reachable: false, message: err.name === "TimeoutError" ? "Connection timed out after 8s" : "LM Studio unreachable — is it running?" });
    } finally {
      setLmTesting(false);
    }
  }

  async function saveToBackend() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        showToast("ok", "Settings saved and applied to backend.");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("err", data?.error?.message || "Failed to save settings.");
      }
    } catch {
      showToast("err", "Could not reach the backend. Is the server running?");
    } finally {
      setSaving(false);
    }
  }

  function maskedKey(val) {
    if (!val) return "";
    if (val.length <= 8) return "*".repeat(val.length);
    return val.slice(0, 4) + "*".repeat(Math.min(val.length - 8, 16)) + val.slice(-4);
  }

  return (
    <>
      <div className="section-head">
        <div>
          <h2>SETTINGS</h2>
          <span className="small dim">Configure AI providers and local model connection</span>
        </div>
      </div>

      {/* ---- API KEYS ---- */}
      <div className="console mt">
        <div className="console-title">
          <span className="traffic">
            <span className="t g" />
            <span className="t a" />
            <span className="t r" />
          </span>
          <span>API KEYS</span>
        </div>
        <div className="console-body">
          {API_KEY_FIELDS.map(({ key, label, placeholder }) => {
            const val = settings.apiKeys[key];
            const visible = showKeys[key];
            const isTesting = testing[key];
            const result = testResults[key];

            return (
              <div className="field" key={key}>
                <div className="field-label">
                  <span>{label}</span>
                  <span className="small dim">{val ? (visible ? val : maskedKey(val)) : "—"}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="url-input"
                    style={{ flex: 1 }}
                    type={visible ? "text" : "password"}
                    value={val}
                    onChange={(e) => updateApiKey(key, e.target.value)}
                    placeholder={placeholder}
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => toggleKeyVisibility(key)}
                    title={visible ? "Hide key" : "Show key"}
                    style={{ flexShrink: 0, minWidth: 52 }}
                  >
                    {visible ? "HIDE" : "SHOW"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => testApiKey(key)}
                    disabled={isTesting || !val}
                    style={{ flexShrink: 0, minWidth: 52 }}
                  >
                    {isTesting ? "..." : "TEST"}
                  </button>
                </div>
                {result && (
                  <div className="small mt" style={{ color: result === "ok" ? "var(--green)" : "var(--red)" }}>
                    {result === "ok" ? "\u2713 Connection successful" : "\u2717 Connection failed"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- LM STUDIO ---- */}
      <div className="console mt">
        <div className="console-title">
          <span className="traffic">
            <span className="t g" />
            <span className="t a" />
            <span className="t r" />
          </span>
          <span>LM STUDIO · LOCAL LLM</span>
        </div>
        <div className="console-body">
          {/* Enable toggle */}
          <div className="field">
            <div className="field-label">
              <span>Enable Local Model</span>
              <span style={{ color: settings.lmStudio.enabled ? "var(--green)" : "var(--dim-2)" }}>
                {settings.lmStudio.enabled ? "ACTIVE" : "OFF"}
              </span>
            </div>
            <div className="toggle">
              <button
                className={!settings.lmStudio.enabled ? "active" : ""}
                onClick={() => updateLmStudio("enabled", false)}
              >
                OFF
              </button>
              <button
                className={settings.lmStudio.enabled ? "active" : ""}
                onClick={() => updateLmStudio("enabled", true)}
              >
                ON
              </button>
            </div>
          </div>

          {/* Base URL */}
          <div className="field">
            <div className="field-label">
              <span>Base URL</span>
              <span className="small dim">endpoint</span>
            </div>
            <input
              className="url-input"
              type="text"
              value={settings.lmStudio.baseUrl}
              onChange={(e) => updateLmStudio("baseUrl", e.target.value)}
              placeholder="http://localhost:1234/v1"
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          {/* Model name */}
          <div className="field">
            <div className="field-label">
              <span>Model Name</span>
              <span className="small dim">optional override</span>
            </div>
            <input
              className="url-input"
              type="text"
              value={settings.lmStudio.model}
              onChange={(e) => updateLmStudio("model", e.target.value)}
              placeholder="llama-3.2-3b-instruct"
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          {/* Test local connection */}
          <div className="btn-row">
            <button className="btn btn-ghost btn-sm" onClick={testLmStudio} disabled={lmTesting}>
              {lmTesting ? "TESTING..." : "TEST LOCAL CONNECTION"}
            </button>
          </div>

          {/* Status indicator */}
          {lmStatus && (
            <div className="mt" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  background: lmStatus.reachable ? "var(--green)" : "var(--red)",
                  boxShadow: lmStatus.reachable ? "0 0 8px var(--green)" : "0 0 8px var(--red)",
                  flexShrink: 0,
                }}
              />
              <span className="small" style={{ color: lmStatus.reachable ? "var(--green)" : "var(--red)" }}>
                {lmStatus.message}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ---- SAVE ---- */}
      <div className="console mt">
        <div className="console-title">
          <span className="traffic">
            <span className="t g" />
            <span className="t a" />
            <span className="t r" />
          </span>
          <span>APPLY · BACKEND</span>
        </div>
        <div className="console-body">
          <p className="small dim" style={{ marginBottom: 14 }}>
            Settings are auto-saved to this browser. Click below to push them to the backend server.
          </p>
          <button className="btn btn-primary" onClick={saveToBackend} disabled={saving}>
            {saving ? "SAVING..." : "SAVE & APPLY TO BACKEND"}
          </button>
        </div>
      </div>

      {/* ---- TOAST ---- */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 30,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 999,
            padding: "12px 22px",
            border: `1px solid ${toast.type === "ok" ? "var(--green)" : "var(--red)"}`,
            background: "var(--panel-2)",
            color: toast.type === "ok" ? "var(--green)" : "var(--red)",
            fontSize: 13,
            fontFamily: "var(--mono)",
            boxShadow: toast.type === "ok" ? "0 0 20px rgba(16,185,129,0.3)" : "0 0 20px rgba(239,68,68,0.3)",
            cursor: "pointer",
            maxWidth: "90vw",
            textAlign: "center",
          }}
          onClick={clearToast}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
