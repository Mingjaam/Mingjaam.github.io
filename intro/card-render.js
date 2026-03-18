/* =============================================
   card-render.js — 공통 유틸리티
   ============================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbz9WY2FocgrcNJjDKi3xFlqWSJFz1NP3S1XbPtfFPCQbVzOTLl5kwrTOtCscJO_624qbA/exec";

const BADGE_STYLE = {
  "프론트엔드": { bg: "#1e1208", text: "#ffb74d" },
  "백엔드":     { bg: "#0e1820", text: "#64b5f6" },
  "AI/ML":      { bg: "#1a0e20", text: "#ce93d8" },
  "데이터":     { bg: "#0e1e18", text: "#80cbc4" },
  "모바일":     { bg: "#1e1208", text: "#ffb74d" },
  "DevOps":     { bg: "#0e180e", text: "#a5d6a7" },
  "기타":       { bg: "#1a1a1a", text: "#aaaaaa" },
};

const MBTI_COLOR = {
  INTJ:"#ce93d8", INTP:"#b39ddb", ENTJ:"#ef9a9a", ENTP:"#ff8a65",
  INFJ:"#80cbc4", INFP:"#a5d6a7", ENFJ:"#fff176", ENFP:"#ffcc80",
  ISTJ:"#90caf9", ISFJ:"#80deea", ESTJ:"#ef9a9a", ESFJ:"#f48fb1",
  ISTP:"#b0bec5", ISFP:"#a5d6a7", ESTP:"#ff8a65", ESFP:"#ffcc80",
};

const BADGE_FIELDS = new Set(["field", "mbti"]);

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderBadge(fieldId, value) {
  if (fieldId === "mbti") {
    const color = MBTI_COLOR[value] || "#ffb74d";
    return `<span class="badge" style="background:#1a1a1a;color:${color};border-color:${color}44;">${escapeHtml(value)}</span>`;
  }
  const s = BADGE_STYLE[value] || {};
  return `<span class="badge" style="background:${s.bg || "#1a1a1a"};color:${s.text || "#ffb74d"};">${escapeHtml(value)}</span>`;
}

function buildCard(row, fields) {
  const mainFields = fields.filter(f => f.id !== "name" && f.id !== "major");

  const body = mainFields
    .filter(f => row[f.id] && f.type !== "image")
    .map(f => {
      const val = String(row[f.id]);

      // goal 필드: 라벨 없이 quote 스타일
      if (f.id === "goal") {
        return `<div class="field-goal">${escapeHtml(val)}</div>`;
      }

      const valueHtml = BADGE_FIELDS.has(f.id)
        ? renderBadge(f.id, val)
        : `<span class="field-value">${escapeHtml(val)}</span>`;

      return `
        <div class="field-row">
          <span class="field-label">${escapeHtml(f.label)}</span>
          ${valueHtml}
        </div>`;
    }).join('<hr class="divider">');

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-name">${escapeHtml(row.name || "")}</span>
        <span class="card-major">${escapeHtml(row.major || "")}</span>
      </div>
      ${body}
      <div class="card-time">${escapeHtml(String(row.timestamp || ""))}</div>
    </div>`;
}
