import { useMemo } from "react";

function scoreColor(score) {
  if (score == null) return "var(--dim)";
  if (score >= 90) return "var(--green)";
  if (score >= 70) return "var(--cyan)";
  if (score >= 50) return "var(--amber)";
  return "var(--red)";
}

function Badge({ children, color }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
        padding: "2px 7px",
        border: `1px solid ${color}`,
        color,
        marginLeft: 6,
      }}
    >
      {children}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--dim)",
          marginBottom: 8,
          borderBottom: "1px dashed var(--line)",
          paddingBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function DiffRow({ label, a, b, aColor, bColor, renderA, renderB }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        padding: "5px 0",
        fontSize: 12.5,
        borderBottom: "1px solid rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ color: aColor || "var(--text)" }}>
        {renderA ? renderA(a) : a ?? "—"}
      </div>
      <div style={{ color: bColor || "var(--text)" }}>
        {renderB ? renderB(b) : b ?? "—"}
      </div>
    </div>
  );
}

function getDiffedItems(oldList, newList, keyFn) {
  const oldKeys = new Set((oldList || []).map(keyFn));
  const newKeys = new Set((newList || []).map(keyFn));
  const added = (newList || []).filter((x) => !oldKeys.has(keyFn(x)));
  const removed = (oldList || []).filter((x) => !newKeys.has(keyFn(x)));
  const unchanged = (oldList || []).filter((x) => newKeys.has(keyFn(x)));
  return { added, removed, unchanged };
}

function getDiffedStrings(oldList, newList) {
  const oldSet = new Set(oldList || []);
  const newSet = new Set(newList || []);
  const added = (newList || []).filter((s) => !oldSet.has(s));
  const removed = (oldList || []).filter((s) => !newSet.has(s));
  return { added, removed };
}

export default function ScanDiff({ scan1, scan2 }) {
  const sections = useMemo(() => {
    const s = {};

    // Score
    const delta = (scan2.score ?? 0) - (scan1.score ?? 0);
    s.scoreDelta = delta;
    s.improved = delta > 0;

    // Findings
    s.findingsDiff = getDiffedItems(
      scan1.findings || [],
      scan2.findings || [],
      (f) => f.title + (f.url || "")
    );

    // Headers
    s.headersDiff = getDiffedStrings(
      scan1.headers || [],
      scan2.headers || []
    );

    // Tech stack
    s.techDiff = getDiffedItems(
      scan1.meta?.tech || [],
      scan2.meta?.tech || [],
      (t) => t.name
    );

    // Third-party services
    s.servicesDiff = getDiffedItems(
      scan1.meta?.services || [],
      scan2.meta?.services || [],
      (sv) => sv.name
    );

    // Endpoints
    s.endpointsDiff = getDiffedStrings(
      scan1.endpoints || [],
      scan2.endpoints || []
    );

    return s;
  }, [scan1, scan2]);

  const renderItemList = (items, color) => {
    if (!items.length) return <span style={{ color: "var(--dim-2)" }}>none</span>;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 8px" }}>
        {items.map((item, i) => (
          <span key={i} style={{ color }}>
            {typeof item === "string" ? item : item.name || item.title || item}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="console mt" style={{ maxWidth: "100%" }}>
      <div className="console-title">
        <span className="traffic">
          <span className="t g" />
          <span className="t a" />
          <span className="t r" />
        </span>
        <span>SCAN DIFF — compare.exe</span>
      </div>
      <div className="console-body">
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: "1px dashed var(--line)",
            fontSize: 12,
            color: "var(--dim)",
            letterSpacing: 1,
          }}
        >
          <div>
            OLDER SCAN
            <div style={{ color: "var(--cyan)", fontSize: 11, wordBreak: "break-all", marginTop: 2 }}>
              {scan1.url}
            </div>
          </div>
          <div>
            NEWER SCAN
            <div style={{ color: "var(--cyan)", fontSize: 11, wordBreak: "break-all", marginTop: 2 }}>
              {scan2.url}
            </div>
          </div>
        </div>

        {/* Score */}
        <Section title="SCORE">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <span style={{ color: scoreColor(scan1.score), fontSize: 28, fontWeight: 700 }}>
                {scan1.score ?? "—"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: scoreColor(scan2.score), fontSize: 28, fontWeight: 700 }}>
                {scan2.score ?? "—"}
              </span>
              {sections.scoreDelta !== 0 && (
                <span
                  style={{
                    color: sections.improved ? "var(--green)" : "var(--red)",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {sections.improved ? "↑" : "↓"} {Math.abs(sections.scoreDelta)}
                </span>
              )}
            </div>
          </div>
        </Section>

        {/* Findings */}
        <Section title={`FINDINGS (${scan1.findings?.length || 0} → ${scan2.findings?.length || 0})`}>
          {sections.findingsDiff.added.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: "var(--red)", fontSize: 11, letterSpacing: 1 }}>
                NEW <Badge color="var(--red)">{sections.findingsDiff.added.length}</Badge>
              </span>
              <div style={{ marginTop: 4 }}>
                {sections.findingsDiff.added.map((f, i) => (
                  <div key={i} style={{ color: "var(--red)", fontSize: 12, padding: "2px 0" }}>
                    • {f.title}
                  </div>
                ))}
              </div>
            </div>
          )}
          {sections.findingsDiff.removed.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: "var(--green)", fontSize: 11, letterSpacing: 1 }}>
                FIXED <Badge color="var(--green)">{sections.findingsDiff.removed.length}</Badge>
              </span>
              <div style={{ marginTop: 4 }}>
                {sections.findingsDiff.removed.map((f, i) => (
                  <div key={i} style={{ color: "var(--green)", fontSize: 12, padding: "2px 0" }}>
                    • {f.title}
                  </div>
                ))}
              </div>
            </div>
          )}
          {sections.findingsDiff.unchanged.length > 0 && (
            <div>
              <span style={{ color: "var(--dim-2)", fontSize: 11, letterSpacing: 1 }}>
                UNCHANGED ({sections.findingsDiff.unchanged.length})
              </span>
            </div>
          )}
          {sections.findingsDiff.added.length === 0 && sections.findingsDiff.removed.length === 0 && (
            <span style={{ color: "var(--dim-2)", fontSize: 12 }}>No changes in findings</span>
          )}
        </Section>

        {/* Headers */}
        <Section title={`HEADERS (${scan1.headers?.length || 0} → ${scan2.headers?.length || 0})`}>
          {sections.headersDiff.added.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: "var(--green)", fontSize: 11, letterSpacing: 1 }}>
                ADDED <Badge color="var(--green)">{sections.headersDiff.added.length}</Badge>
              </span>
              {renderItemList(sections.headersDiff.added, "var(--green)")}
            </div>
          )}
          {sections.headersDiff.removed.length > 0 && (
            <div>
              <span style={{ color: "var(--red)", fontSize: 11, letterSpacing: 1 }}>
                REMOVED <Badge color="var(--red)">{sections.headersDiff.removed.length}</Badge>
              </span>
              {renderItemList(sections.headersDiff.removed, "var(--red)")}
            </div>
          )}
          {sections.headersDiff.added.length === 0 && sections.headersDiff.removed.length === 0 && (
            <span style={{ color: "var(--dim-2)", fontSize: 12 }}>No header changes</span>
          )}
        </Section>

        {/* Tech Stack */}
        <Section title="TECH STACK">
          {sections.techDiff.added.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: "var(--green)", fontSize: 11, letterSpacing: 1 }}>
                NEW TECH <Badge color="var(--green)">{sections.techDiff.added.length}</Badge>
              </span>
              {renderItemList(sections.techDiff.added, "var(--green)")}
            </div>
          )}
          {sections.techDiff.removed.length > 0 && (
            <div>
              <span style={{ color: "var(--red)", fontSize: 11, letterSpacing: 1 }}>
                REMOVED TECH <Badge color="var(--red)">{sections.techDiff.removed.length}</Badge>
              </span>
              {renderItemList(sections.techDiff.removed, "var(--red)")}
            </div>
          )}
          {sections.techDiff.added.length === 0 && sections.techDiff.removed.length === 0 && (
            <span style={{ color: "var(--dim-2)", fontSize: 12 }}>No tech stack changes</span>
          )}
        </Section>

        {/* Third-party services */}
        <Section title="THIRD-PARTY SERVICES">
          {sections.servicesDiff.added.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: "var(--green)", fontSize: 11, letterSpacing: 1 }}>
                ADDED <Badge color="var(--green)">{sections.servicesDiff.added.length}</Badge>
              </span>
              {renderItemList(sections.servicesDiff.added, "var(--green)")}
            </div>
          )}
          {sections.servicesDiff.removed.length > 0 && (
            <div>
              <span style={{ color: "var(--red)", fontSize: 11, letterSpacing: 1 }}>
                REMOVED <Badge color="var(--red)">{sections.servicesDiff.removed.length}</Badge>
              </span>
              {renderItemList(sections.servicesDiff.removed, "var(--red)")}
            </div>
          )}
          {sections.servicesDiff.added.length === 0 && sections.servicesDiff.removed.length === 0 && (
            <span style={{ color: "var(--dim-2)", fontSize: 12 }}>No service changes</span>
          )}
        </Section>

        {/* Endpoints */}
        <Section title={`ENDPOINTS (${scan1.endpoints?.length || 0} → ${scan2.endpoints?.length || 0})`}>
          {sections.endpointsDiff.added.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: "var(--green)", fontSize: 11, letterSpacing: 1 }}>
                ADDED <Badge color="var(--green)">{sections.endpointsDiff.added.length}</Badge>
              </span>
              {renderItemList(sections.endpointsDiff.added, "var(--green)")}
            </div>
          )}
          {sections.endpointsDiff.removed.length > 0 && (
            <div>
              <span style={{ color: "var(--red)", fontSize: 11, letterSpacing: 1 }}>
                REMOVED <Badge color="var(--red)">{sections.endpointsDiff.removed.length}</Badge>
              </span>
              {renderItemList(sections.endpointsDiff.removed, "var(--red)")}
            </div>
          )}
          {sections.endpointsDiff.added.length === 0 && sections.endpointsDiff.removed.length === 0 && (
            <span style={{ color: "var(--dim-2)", fontSize: 12 }}>No endpoint changes</span>
          )}
        </Section>

        {/* Summary */}
        <div
          style={{
            marginTop: 20,
            padding: "14px 16px",
            border: `1px solid ${sections.improved ? "var(--green)" : "var(--red)"}`,
            background: sections.improved
              ? "rgba(51,255,161,0.06)"
              : "rgba(255,77,94,0.06)",
            fontSize: 14,
            fontWeight: 700,
            color: sections.improved ? "var(--green)" : "var(--red)",
            letterSpacing: 1,
          }}
        >
          {sections.improved
            ? `Your site improved by ${sections.scoreDelta} points`
            : `Your site regressed by ${Math.abs(sections.scoreDelta)} points`}
        </div>
      </div>
    </div>
  );
}
