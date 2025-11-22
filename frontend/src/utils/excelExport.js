const DEFAULT_STYLES = `
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111827; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; }
  th { background: #f1f5f9; }
`;

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFilename(text) {
  if (!text) return "export";
  return text
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "export";
}

export function formatExportTimestamp(date = new Date()) {
  try {
    return date.toLocaleString("ro-RO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch (err) {
    return date.toISOString();
  }
}

export function downloadExcel({ filenameBase, headingHtml = "", tableHtml, extraCss = "" }) {
  if (!tableHtml) return;
  const styles = `${DEFAULT_STYLES}${extraCss || ""}`;
  const documentHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>${styles}</style></head><body>${headingHtml || ""}${tableHtml}</body></html>`;
  const blob = new Blob([documentHtml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
  const safeName = sanitizeFilename(filenameBase || "export");
  link.href = url;
  link.download = `${safeName}-${stamp}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
