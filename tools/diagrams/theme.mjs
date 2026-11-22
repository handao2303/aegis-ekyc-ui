/* Theme Aegis cho Mermaid – màu lấy từ skin-aurora (src/styles/tokens.css) */
export const C = {
  ink: "#1a1a1a", sub: "#575c6b", line: "#8d84a6", border: "#cfd2da", soft: "#f7f5fb",
  brand: "#6d34c4", brandSoft: "#f3ecfe", brandText: "#4d2391",
  amber: "#f2a516", amberSoft: "#fef4dd", amberText: "#8a5300",
  good: "#157347", goodSoft: "#e8f7ef", bad: "#b42318", badSoft: "#fdf0ee",
};

export const FONT = "Lexend";

export const mermaidConfig = {
  startOnLoad: false,
  securityLevel: "loose",
  theme: "base",
  fontFamily: `${FONT}, -apple-system, Arial, sans-serif`,
  themeVariables: {
    fontFamily: `${FONT}, -apple-system, Arial, sans-serif`,
    fontSize: "15px",
    background: "#ffffff",
    primaryColor: C.brandSoft, primaryBorderColor: C.brand, primaryTextColor: C.ink,
    secondaryColor: C.amberSoft, secondaryBorderColor: C.amber, secondaryTextColor: C.ink,
    tertiaryColor: C.soft, tertiaryBorderColor: C.border, tertiaryTextColor: C.ink,
    lineColor: C.line, textColor: C.ink,
    clusterBkg: C.soft, clusterBorder: "#ddd6ec",
    edgeLabelBackground: "#ffffff",
    // sequence
    actorBkg: C.brandSoft, actorBorder: C.brand, actorTextColor: C.brandText, actorLineColor: "#c9bfe0",
    signalColor: C.sub, signalTextColor: C.ink, labelBoxBkgColor: C.amberSoft, labelBoxBorderColor: C.amber, labelTextColor: C.amberText,
    loopTextColor: C.amberText, noteBkgColor: "#fffaf0", noteBorderColor: C.amber, noteTextColor: C.ink,
    activationBkgColor: C.brandSoft, activationBorderColor: C.brand, sequenceNumberColor: "#ffffff",
    // state
    stateBkg: C.brandSoft, stateLabelColor: C.ink, compositeBackground: C.soft, transitionColor: C.line, transitionLabelColor: C.sub,
    // er
    attributeBackgroundColorOdd: "#ffffff", attributeBackgroundColorEven: C.soft,
  },
  flowchart: { htmlLabels: true, curve: "basis", padding: 14, nodeSpacing: 46, rankSpacing: 56 },
  sequence: { actorMargin: 60, boxMargin: 12, messageMargin: 40, mirrorActors: false, useMaxWidth: false, showSequenceNumbers: true },
  state: { padding: 10 },
  er: { useMaxWidth: false },
  elk: { mergeEdges: false, nodePlacementStrategy: "BRANDES_KOEPF" },
  themeCSS: `
    .node rect, .node polygon, .node circle, .node path { stroke-width: 1.4px; }
    .node rect { rx: 10px; ry: 10px; }
    .cluster rect { rx: 14px; ry: 14px; stroke-dasharray: 0; }
    .cluster-label, .cluster .nodeLabel { font-weight: 600; color: ${C.brandText}; fill: ${C.brandText}; }
    .edgeLabel, .edgeLabel p { font-size: 13px; color: ${C.sub}; }
    .flowchart-link, .transition { stroke-width: 1.5px; }
    .messageText { font-size: 14px; }
    .actor { rx: 10px; ry: 10px; }
    text.actor > tspan { font-weight: 600; }
    .note { rx: 6px; ry: 6px; }
    .statediagram-state rect.basic, .stateGroup rect { rx: 10px; ry: 10px; }
    .er.entityBox { fill: ${C.brandSoft}; stroke: ${C.brand}; }
    .er.relationshipLabelBox { fill: #fff; }
  `,
};

/* Tô màu tự động theo ý nghĩa của nút: lỗi/từ chối – chờ/cảnh báo – thành công – điểm quyết định */
const BAD = /REJECTED|DECLINED|Từ chối|từ chối|Lỗi|lỗi|chặn|Chặn|FAILED|EXPIRED|LOCKED|hết hạn|Hết hạn|Cách ly|QUA_HAN|Breach|STOPPED|Dừng|Quá hạn|quá hạn|DOC_EXPIRED|UNDER_AGE|Khoá thẻ/;
const WARN = /REFER|PENDING|Chờ |chờ |ESCALATED|SAP_QUA_HAN|TAM_DUNG|Gắn cờ|HALF_OPEN|Cảnh báo|Leo thang|Nghi vấn|ABANDONED|Yêu cầu bổ sung|Vùng biên|OCR-only/;
const GOOD = /STP_APPROVED|APPROVED|Thành công|SETTLED|POSTED|^DONE$|DA_XU_LY|RESOLVED|Hoàn tất|zero-touch|ACTIVE|Tiếp tục Liveness|Chốt MRZ|Phê duyệt/;

const CLASSDEF = {
  flow: [
    `classDef bad fill:${C.badSoft},stroke:${C.bad},color:${C.bad}`,
    `classDef warn fill:${C.amberSoft},stroke:${C.amber},color:${C.amberText}`,
    `classDef good fill:${C.goodSoft},stroke:${C.good},color:${C.good}`,
    `classDef dec fill:#fffaf0,stroke:${C.amber},color:${C.ink}`,
  ],
};

const kind = (label) => (BAD.test(label) && GOOD.test(label) ? null : BAD.test(label) ? "bad" : WARN.test(label) ? "warn" : GOOD.test(label) ? "good" : null);

export function decorate(code) {
  const head = code.trimStart().split("\n")[0].trim();
  if (/^(flowchart|graph)\b/.test(head)) {
    const classes = new Map();
    const re = /(?:^|[\s;>-])([A-Za-z][\w]*)\s*(\{\{|\{|\[\[|\[\(|\(\[|\(\(|\[|\(|>)\s*"([^"]*)"/g;
    for (const m of code.matchAll(re)) {
      const [, id, shape, label] = m;
      if (classes.has(id)) continue;
      const k = shape === "{" || shape === "{{" ? "dec" : shape === "[(" ? null : kind(label);
      if (k) classes.set(id, k);
    }
    if (!classes.size) return code;
    const lines = [...CLASSDEF.flow];
    for (const k of ["bad", "warn", "good", "dec"]) {
      const ids = [...classes].filter(([, v]) => v === k).map(([id]) => id);
      if (ids.length) lines.push(`class ${ids.join(",")} ${k}`);
    }
    return code.trimEnd() + "\n" + lines.map((l) => "    " + l).join("\n") + "\n";
  }
  if (/^stateDiagram/.test(head)) {
    const names = new Set();
    for (const m of code.matchAll(/(?:^|\s)([A-Z][A-Z0-9_]{2,})(?=\s*(?:-->|:|$))/gm)) names.add(m[1]);
    for (const m of code.matchAll(/-->\s*([A-Z][A-Z0-9_]{2,})/g)) names.add(m[1]);
    const lines = [];
    const groups = { bad: [], warn: [], good: [] };
    for (const n of names) { const k = kind(n.replace(/_/g, "_")); if (k) groups[k].push(n); }
    if (!groups.bad.length && !groups.warn.length && !groups.good.length) return code;
    lines.push(`classDef bad fill:${C.badSoft},stroke:${C.bad},color:${C.bad}`);
    lines.push(`classDef warn fill:${C.amberSoft},stroke:${C.amber},color:${C.amberText}`);
    lines.push(`classDef good fill:${C.goodSoft},stroke:${C.good},color:${C.good}`);
    for (const [k, ids] of Object.entries(groups)) for (const id of ids) lines.push(`class ${id} ${k}`);
    return code.trimEnd() + "\n" + lines.map((l) => "    " + l).join("\n") + "\n";
  }
  return code;
}
