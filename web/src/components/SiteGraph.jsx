import { useState, useEffect, useRef, useCallback } from "react";

function parseHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function buildGraph(scan) {
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  const host = parseHost(scan.targetUrl || "");

  function getOrCreateNode(id, type, label) {
    if (nodeMap.has(id)) return nodeMap.get(id);
    const node = {
      id,
      type,
      label: label || id,
      x: Math.random() * 600 + 100,
      y: Math.random() * 400 + 100,
      vx: 0,
      vy: 0,
    };
    nodes.push(node);
    nodeMap.set(id, node);
    return node;
  }

  function addEdge(sourceId, targetId) {
    const key = [sourceId, targetId].sort().join("::");
    if (edges.some((e) => e.key === key)) return;
    const source = getOrCreateNode(sourceId, "page", sourceId);
    const target = getOrCreateNode(targetId, "page", targetId);
    edges.push({ source, target, key, weight: 1 });
  }

  const centerId = host || "target";
  const center = {
    id: centerId,
    type: "center",
    label: scan.targetUrl || centerId,
    x: 400,
    y: 250,
    vx: 0,
    vy: 0,
  };
  nodes.push(center);
  nodeMap.set(centerId, center);

  const endpoints = scan?.meta?.endpoints || [];
  const services = scan?.meta?.services || [];
  const pagesCrawled = scan?.meta?.pagesCrawled || 0;

  if (pagesCrawled > 0) {
    for (let i = 0; i < Math.min(pagesCrawled, 20); i++) {
      const pageId = `page-${i}`;
      const label = i === 0 ? host : `${host}/page-${i + 1}`;
      const page = getOrCreateNode(pageId, "page", label);
      addEdge(centerId, pageId);
      page.x = 400 + Math.cos((2 * Math.PI * i) / Math.min(pagesCrawled, 20)) * 150;
      page.y = 250 + Math.sin((2 * Math.PI * i) / Math.min(pagesCrawled, 20)) * 150;
    }
  }

  const pageNodes = nodes.filter((n) => n.type === "page");
  if (endpoints.length > 0) {
    for (let i = 0; i < Math.min(endpoints.length, 30); i++) {
      const ep = endpoints[i];
      const epId = `api-${i}`;
      const label = ep.path || ep.url || `endpoint-${i}`;
      const apiNode = getOrCreateNode(epId, "api", label);
      const angle = Math.random() * 2 * Math.PI;
      apiNode.x = 400 + Math.cos(angle) * (180 + Math.random() * 60);
      apiNode.y = 250 + Math.sin(angle) * (180 + Math.random() * 60);
      if (pageNodes.length > 0) {
        const nearest = pageNodes[Math.floor(Math.random() * pageNodes.length)];
        addEdge(nearest.id, epId);
      } else {
        addEdge(centerId, epId);
      }
    }
  }

  if (services.length > 0) {
    for (let i = 0; i < Math.min(services.length, 25); i++) {
      const svc = services[i];
      const svcId = `svc-${i}`;
      const label = svc.name || `service-${i}`;
      const svcNode = getOrCreateNode(svcId, "service", label);
      const angle = (2 * Math.PI * i) / Math.min(services.length, 25) + Math.PI * 0.25;
      svcNode.x = 400 + Math.cos(angle) * (220 + Math.random() * 40);
      svcNode.y = 250 + Math.sin(angle) * (220 + Math.random() * 40);
      if (pageNodes.length > 0) {
        const nearest = pageNodes[Math.floor(Math.random() * pageNodes.length)];
        addEdge(nearest.id, svcId);
      } else {
        addEdge(centerId, svcId);
      }
    }
  }

  return { nodes, edges };
}

function simulateStep(nodes, edges, width, height) {
  const k = 180;
  const k2 = k * k;
  const gravity = 0.04;

  for (const n of nodes) {
    n.vx = 0;
    n.vy = 0;
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = k2 / dist;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  for (const e of edges) {
    let dx = e.target.x - e.source.x;
    let dy = e.target.y - e.source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (dist - 80) * gravity * e.weight;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    e.source.vx += fx;
    e.source.vy += fy;
    e.target.vx -= fx;
    e.target.vy -= fy;
  }

  for (const n of nodes) {
    if (n.type === "center") {
      n.vx += (width / 2 - n.x) * 0.01;
      n.vy += (height / 2 - n.y) * 0.01;
    }
    n.vx *= 0.65;
    n.vy *= 0.65;
    n.x += n.vx;
    n.y += n.vy;
    n.x = Math.max(40, Math.min(width - 40, n.x));
    n.y = Math.max(40, Math.min(height - 40, n.y));
  }
}

function diamondPath(cx, cy, size) {
  const h = size * 0.7;
  const w = size;
  return [
    `M ${cx} ${cy - h}`,
    `L ${cx + w} ${cy}`,
    `L ${cx} ${cy + h}`,
    `L ${cx - w} ${cy}`,
    "Z",
  ].join(" ");
}

export default function SiteGraph({ scan }) {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffsetStart, setDragOffsetStart] = useState({ x: 0, y: 0 });
  const forceRef = useRef(null);
  const animRef = useRef(null);
  const graph = useRef({ nodes: [], edges: [] });
  const [tick, setTick] = useState(0);
  const svgWidth = 800;
  const svgHeight = 500;

  useEffect(() => {
    const { nodes, edges } = buildGraph(scan);
    graph.current = { nodes, edges };

    let iteration = 0;
    const maxIterations = 250;

    if (animRef.current) cancelAnimationFrame(animRef.current);

    function step() {
      if (iteration < maxIterations) {
        simulateStep(nodes, edges, svgWidth, svgHeight);
        iteration++;
        setTick(iteration);
        animRef.current = requestAnimationFrame(step);
      }
    }
    animRef.current = requestAnimationFrame(step);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [scan]);

  const handleMouseDown = useCallback(
    (e) => {
      if (e.target === svgRef.current || e.target.tagName === "rect") {
        setDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
        setDragOffsetStart({ ...offset });
      }
    },
    [offset]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (dragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        setOffset({ x: dragOffsetStart.x + dx, y: dragOffsetStart.y + dy });
      }
    },
    [dragging, dragStart, dragOffsetStart]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setScale((s) => Math.max(0.3, Math.min(3, s + delta)));
  }, []);

  const getNodeColor = (type) => {
    switch (type) {
      case "center":
        return "#00d4ff";
      case "api":
        return "#33ffa1";
      case "service":
        return "#ff79c6";
      case "page":
      default:
        return "#7f92b8";
    }
  };

  const getNodeSize = (type) => {
    switch (type) {
      case "center":
        return 14;
      case "api":
        return 8;
      case "service":
        return 7;
      case "page":
      default:
        return 6;
    }
  };

  const edgeGrouped = new Map();
  for (const e of graph.current.edges) {
    if (!edgeGrouped.has(e.key)) edgeGrouped.set(e.key, { ...e, weight: 0 });
    edgeGrouped.get(e.key).weight++;
  }
  const dedupedEdges = [...edgeGrouped.values()];
  const maxWeight = Math.max(1, ...dedupedEdges.map((e) => e.weight));

  const isNeighbor = (nodeId) => {
    if (!selected) return false;
    return graph.current.edges.some(
      (e) =>
        (e.source.id === selected && e.target.id === nodeId) ||
        (e.target.id === selected && e.source.id === nodeId)
    );
  };

  const isHighlighted = (nodeId) => {
    if (!selected) return true;
    if (nodeId === selected) return true;
    return isNeighbor(nodeId);
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="console">
      <div className="console-title">
        <span>SITE ARCHITECTURE GRAPH</span>
        <span className="dim" style={{ fontSize: 11 }}>
          {graph.current.nodes.length} nodes · {dedupedEdges.length} edges
        </span>
      </div>
      <div className="console-body" style={{ padding: 0, overflow: "hidden" }}>
        <div
          ref={containerRef}
          style={{
            position: "relative",
            width: "100%",
            height: svgHeight,
            background: "rgba(0,0,0,0.3)",
            cursor: dragging ? "grabbing" : "grab",
          }}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
        >
          {tooltip && !hovered && (
            <div
              style={{
                position: "absolute",
                left: tooltip.x + 12,
                top: tooltip.y - 10,
                background: "rgba(10,10,20,0.95)",
                border: "1px solid rgba(0,212,255,0.3)",
                borderRadius: 4,
                padding: "4px 10px",
                fontSize: 12,
                color: "#fff",
                pointerEvents: "none",
                zIndex: 10,
                whiteSpace: "nowrap",
              }}
            >
              {tooltip.label}
            </div>
          )}
          <svg
            ref={svgRef}
            width="100%"
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ display: "block" }}
          >
            <g transform={`translate(${offset.x},${offset.y}) scale(${scale})`}>
              {dedupedEdges.map((e) => {
                const alpha = 0.08 + (e.weight / maxWeight) * 0.35;
                const dimmed =
                  selected && !(isHighlighted(e.source.id) && isHighlighted(e.target.id));
                const strokeColor = dimmed
                  ? `rgba(127,146,184,0.04)`
                  : `rgba(127,146,184,${alpha.toFixed(2)})`;
                const sw = 0.5 + (e.weight / maxWeight) * 2.5;
                return (
                  <line
                    key={e.key}
                    x1={e.source.x}
                    y1={e.source.y}
                    x2={e.target.x}
                    y2={e.target.y}
                    stroke={strokeColor}
                    strokeWidth={dimmed ? 0.5 : sw}
                  />
                );
              })}

              {graph.current.nodes.map((n) => {
                const color = getNodeColor(n.type);
                const size = getNodeSize(n.type);
                const dimmed = !isHighlighted(n.id);
                const fill = dimmed ? `${color}33` : color;
                const strokeW = n.id === selected ? 2 : 0;
                const labelFontSize = n.type === "center" ? 10 : 8;

                if (n.type === "api") {
                  return (
                    <g key={n.id}>
                      <path
                        d={diamondPath(n.x, n.y, size)}
                        fill={fill}
                        stroke={n.id === selected ? "#fff" : color}
                        strokeWidth={strokeW}
                        opacity={dimmed ? 0.3 : 1}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) => {
                          const rect = containerRef.current?.getBoundingClientRect();
                          setHovered(n.id);
                          setTooltip({
                            x: (e.clientX - (rect?.left || 0)) / scale - offset.x / scale,
                            y: (e.clientY - (rect?.top || 0)) / scale - offset.y / scale,
                            label: n.label,
                          });
                        }}
                        onMouseLeave={() => {
                          setHovered(null);
                          setTooltip(null);
                        }}
                        onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
                      />
                      <text
                        x={n.x}
                        y={n.y + size * 0.7 + 12}
                        textAnchor="middle"
                        fill={dimmed ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)"}
                        fontSize={labelFontSize}
                        style={{ pointerEvents: "none" }}
                      >
                        {n.label.length > 18 ? n.label.slice(0, 16) + "..." : n.label}
                      </text>
                    </g>
                  );
                }

                return (
                  <g key={n.id}>
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={size}
                      fill={fill}
                      stroke={n.id === selected ? "#fff" : color}
                      strokeWidth={strokeW}
                      opacity={dimmed ? 0.3 : 1}
                      style={{ cursor: "pointer" }}
                      onMouseEnter={(e) => {
                        const rect = containerRef.current?.getBoundingClientRect();
                        setHovered(n.id);
                        setTooltip({
                          x: (e.clientX - (rect?.left || 0)) / scale - offset.x / scale,
                          y: (e.clientY - (rect?.top || 0)) / scale - offset.y / scale,
                          label: n.label,
                        });
                      }}
                      onMouseLeave={() => {
                        setHovered(null);
                        setTooltip(null);
                      }}
                      onClick={() => setSelected((s) => (s === n.id ? null : n.id))}
                    />
                    <text
                      x={n.x}
                      y={n.y + size + 12}
                      textAnchor="middle"
                      fill={dimmed ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)"}
                      fontSize={labelFontSize}
                      style={{ pointerEvents: "none" }}
                    >
                      {n.label.length > 18 ? n.label.slice(0, 16) + "..." : n.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "10px 14px",
            borderTop: "1px solid rgba(0,212,255,0.08)",
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "Target", color: "#00d4ff", shape: "●" },
            { label: "Page", color: "#7f92b8", shape: "●" },
            { label: "API", color: "#33ffa1", shape: "◆" },
            { label: "Service", color: "#ff79c6", shape: "●" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              <span style={{ color: item.color, fontSize: 14 }}>{item.shape}</span>
              {item.label}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
            drag to pan · scroll to zoom · click to focus
          </span>
        </div>
      </div>
    </div>
  );
}
