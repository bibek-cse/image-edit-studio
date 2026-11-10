// ---------------------------------------------------------------------------
// Engine: schema-driven mapping between this UI and any Gradio Space.
// Pure functions (no DOM) so they are easy to test and reuse.
// ---------------------------------------------------------------------------
import { ENDPOINT_BLOCKLIST } from "./models.js";

const lc = (s) => String(s ?? "").toLowerCase();
const key = (p) => lc(p.parameter_name || p.label);
const keyAndLabel = (p) => `${lc(p.parameter_name)} ${lc(p.label)}`;

export function isImageParam(p) {
  const c = lc(p.component);
  const t = lc(p.python_type?.type) + " " + lc(p.type);
  if (["image", "imageeditor", "gallery", "imageslider"].includes(c)) return true;
  if (c === "file" || c === "files") return /image|img|photo|picture/.test(keyAndLabel(p));
  return /imagedata|image\b/.test(t) && !/textbox|number|slider|checkbox/.test(c);
}

export function isPromptParam(p) {
  const c = lc(p.component);
  if (!["textbox", "textarea", "text", "multimodaltextbox"].includes(c)) return false;
  const k = keyAndLabel(p);
  return !/neg|system|token|api|seed|lora|url/.test(k);
}

export function isNegativeParam(p) {
  return ["textbox", "textarea"].includes(lc(p.component)) && /neg/.test(keyAndLabel(p));
}

/** Choose the best endpoint (image + prompt in, image out) from view_api(). */
export function pickEndpoint(apiInfo, preferred = []) {
  const named = apiInfo?.named_endpoints || {};
  const candidates = [];
  for (const [name, info] of Object.entries(named)) {
    const params = info.parameters || [];
    const returns = info.returns || [];
    const hasImg = params.some(isImageParam);
    const hasPrompt = params.some(isPromptParam);
    if (!hasImg || !hasPrompt) continue;
    let score = 0;
    const n = lc(name);
    const pi = preferred.map(lc).indexOf(n);
    if (pi >= 0) score += 1000 - pi;
    if (/infer|edit|generate|run|predict|process|submit/.test(n)) score += 50;
    if (ENDPOINT_BLOCKLIST.some((b) => n.includes(b))) score -= 500;
    if (returns.some(isImageParam)) score += 100;
    score -= params.length * 0.1; // tie-break: simpler wins
    candidates.push({ name, info, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function fallbackValue(p) {
  if (p.parameter_has_default) return p.parameter_default;
  if (p.example_input !== undefined) return p.example_input;
  const c = lc(p.component);
  if (c === "checkbox") return false;
  if (c === "number" || c === "slider") return 0;
  if (c === "textbox") return "";
  return null;
}

/**
 * Build a keyword payload for client.submit(endpoint, payload).
 * @param {object} info   endpoint info from view_api
 * @param {object} input  { images: [FileRef...], prompt, negative, seed, steps, guidance }
 *                        FileRef = result of handle_file(blob)
 * @returns {{payload: object, mapping: Array}}  mapping is for the "Inspect" view
 */
export function buildPayload(info, input) {
  const payload = {};
  const mapping = [];
  let imgIdx = 0;
  const imgs = input.images || [];
  const params = info.parameters || [];
  const promptParam =
    params.find((p) => isPromptParam(p) && /prompt|instruction|edit/.test(keyAndLabel(p))) ||
    params.find(isPromptParam);

  for (const p of params) {
    const name = p.parameter_name;
    const c = lc(p.component);
    const k = keyAndLabel(p);
    let v;
    let src = "default";

    if (isImageParam(p)) {
      if (c === "gallery") {
        v = imgs.map((f) => ({ image: f, caption: null }));
        src = `gallery(${imgs.length} imgs)`;
        imgIdx = imgs.length;
      } else if (c === "imageeditor") {
        v = imgs[imgIdx] ? { background: imgs[imgIdx], layers: [], composite: null } : null;
        src = `image #${imgIdx + 1} (editor)`;
        imgIdx++;
      } else {
        v = imgs[imgIdx] ?? (p.parameter_has_default ? p.parameter_default : null);
        src = imgs[imgIdx] ? `image #${imgIdx + 1}` : "empty";
        imgIdx++;
      }
    } else if (isNegativeParam(p)) {
      v = input.negative ?? fallbackValue(p);
      src = input.negative ? "negative prompt" : "default";
    } else if (p === promptParam) {
      v = input.prompt;
      src = "prompt";
    } else if (/random/.test(k) && c === "checkbox") {
      v = input.seed == null || input.seed === "";
      src = v ? "randomize=true" : "randomize=false (fixed seed)";
    } else if (/seed/.test(k) && (c === "number" || c === "slider")) {
      v = input.seed == null || input.seed === "" ? fallbackValue(p) : Number(input.seed);
      src = input.seed == null || input.seed === "" ? "default" : "seed";
    } else if (/step/.test(k) && (c === "number" || c === "slider") && input.steps) {
      v = Number(input.steps);
      src = "steps";
    } else if (/guid|cfg/.test(k) && (c === "number" || c === "slider") && input.guidance) {
      v = Number(input.guidance);
      src = "guidance";
    } else {
      v = fallbackValue(p);
    }
    payload[name] = v;
    mapping.push({ name, label: p.label, component: p.component, source: src });
  }
  return { payload, mapping };
}

/** Find every image URL inside a Gradio result (Image, Gallery, ImageSlider, File...). */
export function extractImageUrls(data) {
  const out = [];
  const seen = new Set();
  const isImgUrl = (s) =>
    typeof s === "string" &&
    (/^data:image\//.test(s) || /^https?:\/\/.+\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(s));
  const walk = (x) => {
    if (x == null) return;
    if (typeof x === "string") {
      if (isImgUrl(x) && !seen.has(x)) { seen.add(x); out.push(x); }
      return;
    }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeof x === "object") {
      if (typeof x.url === "string" && !seen.has(x.url)) {
        const mime = lc(x.mime_type);
        const looksImage = !mime || mime.startsWith("image") || isImgUrl(x.url) || /\/file=|gradio_api\/file/.test(x.url);
        if (looksImage) { seen.add(x.url); out.push(x.url); return; }
      }
      for (const v of Object.values(x)) walk(v);
    }
  };
  walk(data);
  return out;
}
