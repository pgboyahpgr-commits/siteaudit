import { useState } from "react";

const STATUS_COLOR = {
  "200": "#33ffa1",
  "201": "#33ffa1",
  "204": "#33ffa1",
  "301": "#38e1ff",
  "302": "#38e1ff",
  "400": "#ffb020",
  "401": "#ffb020",
  "403": "#ffb020",
  "404": "#7f92b8",
  "500": "#ff4d5e",
  "502": "#ff4d5e",
  "503": "#ff4d5e",
};

export default function EndpointTable({ endpoints }) {
  const [filter, setFilter] = useState("all");

  const list = [...(endpoints || [])];
  const filtered = filter === "all" ? list : list.filter((e) => (filter === "api" ? e.isApi : e.status >= 400));
  const apiCount = list.filter((e) => e.isApi).length;
  const errorCount = list.filter((e) => e.status >= 400).length;

  return (
    <div className="console">
      <div className="console-title">
        <span>
          ENDPOINT ANALYSIS — status, type &amp; flags
        </span>
        <span className="dim">
          {list.length} total · {apiCount} api · {errorCount} errors
        </span>
      </div>
      <div className="console-body" style={{ padding: 14 }}>
        <div className="filters" style={{ marginBottom: 12 }}>
          <button className={`chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
            all
          </button>
          <button className={`chip ${filter === "api" ? "active" : ""}`} onClick={() => setFilter("api")}>
            api ({apiCount})
          </button>
          <button className={`chip ${filter === "errors" ? "active" : ""}`} onClick={() => setFilter("errors")}>
            errors ({errorCount})
          </button>
        </div>
        <div className="eptable">
          {filtered.map((e, i) => (
            <div className="eprow" key={i}>
              <span className="ep-status" style={{ color: STATUS_COLOR[String(e.status)] || "#dce7f5" }}>
                {e.status || "--"}
              </span>
              {e.isApi && <span className="ep-api">API</span>}
              <span className="ep-url" title={e.url}>
                {e.url}
              </span>
              <span className="ep-type">{e.contentType || "—"}</span>
            </div>
          ))}
          {filtered.length === 0 && <div className="dim small" style={{ padding: 12 }}>none</div>}
        </div>
      </div>
    </div>
  );
}
