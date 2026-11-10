// ---------------------------------------------------------------------------
// Open Image Edit Studio — UI + Hugging Face Spaces calls (client-side only)
// ---------------------------------------------------------------------------
import { Client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client@2/dist/index.min.js";
import { MODELS } from "./models.js";
import { pickEndpoint, buildPayload, extractImageUrls } from "./engine.js";

const $ = (s, r = document) => r.querySelector(s);
const LS = {
  get: (k, d = null) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
const MAX_IMAGES = 3;
const CONNECT_TIMEOUT_MS = 180_000;

const state = {
  files: [],                 // [{ blob, url, name, w, h }]
  overrides: LS.get("ies.overrides", {}),
  selected: new Set(LS.get("ies.selected", MODELS.filter((m) => m.defaultOn).map((m) => m.id))),
  clients: new Map(),        // spaceId -> { client, endpoint } (cached per token)
  results: [],               // [{ model, blob, url, filename }]
  jobs: new Map(),           // card -> submission
};

// ---------------------------------------------------------------- theme
const savedTheme = LS.get("ies.theme");
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
else if (matchMedia("(prefers-color-scheme: dark)").matches) document.documentElement.dataset.theme = "dark";
$("#themeBtn").onclick = () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  LS.set("ies.theme", t);
};

// ---------------------------------------------------------------- repo link
(() => {
  const a = $("#repoLink");
  const h = location.hostname;
  if (h.endsWith("github.io")) {
    const user = h.split(".")[0];
    const repo = location.pathname.split("/").filter(Boolean)[0] || `${user}.github.io`;
    a.href = `https://github.com/${user}/${repo}`;
  } else a.hidden = true;
})();

// ---------------------------------------------------------------- token
const tokenEl = $("#token");
const rememberEl = $("#rememberTok");
const savedTok = LS.get("ies.token");
if (savedTok) { tokenEl.value = savedTok; rememberEl.checked = true; }
const getToken = () => {
  const t = tokenEl.value.trim();
  return t.startsWith("hf_") ? t : undefined;
};
const persistToken = () => (rememberEl.checked && getToken() ? LS.set("ies.token", getToken()) : LS.del("ies.token"));
rememberEl.onchange = persistToken;
tokenEl.onchange = () => { persistToken(); state.clients.clear(); };

// ---------------------------------------------------------------- models UI
function allModels() {
  const list = [...MODELS];
  const custom = $("#customSpace").value.trim() || LS.get("ies.custom", "");
  if (custom && /^[\w.-]+\/[\w.-]+$/.test(custom)) {
    list.push({
      id: "custom", name: `Custom: ${custom}`, org: "Your Space", params: "",
      license: "See Space", licenseNote: "", weights: `https://huggingface.co/spaces/${custom}`,
      spaces: [custom], endpoints: [], multiImage: true,
    });
  }
  return list;
}

function renderModels() {
  const box = $("#modelList");
  box.innerHTML = "";
  for (const m of allModels()) {
    const open = /apache|mit|openrail/i.test(m.license);
    const el = document.createElement("label");
    el.className = "model";
    el.innerHTML = `
      <input type="checkbox" value="${m.id}" ${state.selected.has(m.id) ? "checked" : ""}/>
      <div>
        <div class="m-name">${m.name}</div>
        <div class="m-sub">${m.org}${m.params ? " · " + m.params : ""}${m.multiImage ? " · multi-image" : ""}</div>
        <span class="lic ${open ? "open" : "nc"}" title="${m.licenseNote}">${m.license}</span>
        <a class="m-sub" href="${m.weights}" target="_blank" rel="noopener" style="margin-left:6px">weights ↗</a>
      </div>`;
    el.querySelector("input").onchange = (e) => {
      e.target.checked ? state.selected.add(m.id) : state.selected.delete(m.id);
      LS.set("ies.selected", [...state.selected]);
    };
    box.appendChild(el);
  }
}

function renderOverrides() {
  const box = $("#overrides");
  box.innerHTML = "";
  for (const m of MODELS) {
    const row = document.createElement("div");
    row.className = "override-row";
    row.innerHTML = `<span>${m.name.split(" ")[0]}</span><input type="text" placeholder="${m.spaces[0]}" value="${state.overrides[m.id] || ""}"/>`;
    row.querySelector("input").onchange = (e) => {
      const v = e.target.value.trim();
      v ? (state.overrides[m.id] = v) : delete state.overrides[m.id];
      LS.set("ies.overrides", state.overrides);
    };
    box.appendChild(row);
  }
}
$("#customSpace").value = LS.get("ies.custom", "");
$("#customSpace").onchange = (e) => {
  const v = e.target.value.trim();
  LS.set("ies.custom", v);
  if (v) state.selected.add("custom"); else state.selected.delete("custom");
  renderModels();
};
$("#resetOverrides").onclick = () => {
  state.overrides = {}; LS.del("ies.overrides"); LS.del("ies.custom");
  $("#customSpace").value = ""; state.selected.delete("custom");
  renderOverrides(); renderModels();
};
renderModels();
renderOverrides();

// ---------------------------------------------------------------- image input
const drop = $("#drop");
const fileInput = $("#fileInput");
drop.addEventListener("click", (e) => { if (!e.target.closest(".x")) fileInput.click(); });
drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
fileInput.onchange = () => { addFiles(fileInput.files); fileInput.value = ""; };
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
window.addEventListener("paste", (e) => {
  const files = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith("image/")).map((i) => i.getAsFile());
  if (files.length) addFiles(files);
});

async function addFiles(list) {
  for (const f of [...list].filter((f) => f.type.startsWith("image/"))) {
    if (state.files.length >= MAX_IMAGES) break;
    const bmp = await createImageBitmap(f).catch(() => null);
    state.files.push({ blob: f, url: URL.createObjectURL(f), name: f.name, w: bmp?.width, h: bmp?.height });
    bmp?.close?.();
  }
  renderThumbs();
}
function renderThumbs() {
  const t = $("#thumbs");
  t.innerHTML = "";
  state.files.forEach((f, i) => {
    const d = document.createElement("div");
    d.className = "thumb";
    d.innerHTML = `<img src="${f.url}" alt=""/><span class="role">${i === 0 ? "main" : "ref " + i}</span>
      <button class="x" type="button" title="Remove">×</button><div class="meta">${f.w || "?"}×${f.h || "?"}</div>`;
    d.querySelector(".x").onclick = (e) => {
      e.stopPropagation();
      URL.revokeObjectURL(f.url);
      state.files.splice(i, 1);
      renderThumbs();
    };
    t.appendChild(d);
  });
  drop.classList.toggle("has-files", state.files.length > 0);
}

async function prepareBlob(f) {
  if (!$("#resizeChk").checked) return f.blob;
  const max = Math.max(256, Math.min(2048, Number($("#maxSide").value) || 1024));
  const bmp = await createImageBitmap(f.blob);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (scale === 1 && f.blob.size < 8e6) { bmp.close?.(); return f.blob; }
  // keep dimensions multiple of 16 (most DiT / UNet models prefer it)
  const w = Math.max(16, Math.round((bmp.width * scale) / 16) * 16);
  const h = Math.max(16, Math.round((bmp.height * scale) / 16) * 16);
  const c = new OffscreenCanvas(w, h);
  c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return c.convertToBlob({ type: "image/png" });
}

// ---------------------------------------------------------------- Space connection
function withTimeout(p, ms, msg) {
  let t;
  return Promise.race([p, new Promise((_, rej) => (t = setTimeout(() => rej(new Error(msg)), ms)))]).finally(() => clearTimeout(t));
}

async function connectModel(model, ui) {
  const list = [state.overrides[model.id], ...model.spaces].filter(Boolean);
  const unique = [...new Set(list)];
  const errors = [];
  for (const space of unique) {
    const cacheKey = `${space}|${getToken() ? "tok" : "anon"}`;
    if (state.clients.has(cacheKey)) return { space, ...state.clients.get(cacheKey) };
    ui.status(`Connecting to ${space}…`);
    ui.space(space);
    try {
      const client = await withTimeout(
        Client.connect(space, {
          token: getToken(),
          events: ["data", "status"],
          status_callback: (s) => {
            const st = String(s.status || "").toLowerCase();
            if (st === "sleeping") ui.status(`${space} is asleep — waking it up (can take 1–3 min)…`);
            else if (st === "building") ui.status(`${space} is building…`);
            else if (st === "error" || st === "space_error") ui.status(`${space}: ${s.message || "Space error"}`);
            else if (s.message) ui.status(s.message);
          },
        }),
        CONNECT_TIMEOUT_MS,
        `Timed out connecting to ${space}`
      );
      const api = await client.view_api();
      const ep = pickEndpoint(api, model.endpoints);
      if (!ep) throw new Error("No image+prompt endpoint found in this Space's API");
      const entry = { client, endpoint: ep, api };
      state.clients.set(cacheKey, entry);
      return { space, ...entry };
    } catch (e) {
      errors.push(`${space}: ${e?.message || e}`);
    }
  }
  throw new Error("Could not use any Space for this model.\n" + errors.join("\n"));
}

// ---------------------------------------------------------------- result cards
function makeCard(model) {
  const node = $("#cardTpl").content.firstElementChild.cloneNode(true);
  $(".c-name", node).textContent = model.name;
  const badge = $(".c-badge", node);
  const text = $(".c-text", node);
  const bar = $(".bar", node);
  const fill = $(".bar-fill", node);
  const dbg = $(".c-debug", node);
  const started = performance.now();
  let timer = setInterval(() => ($(".c-time", node).textContent = `${((performance.now() - started) / 1000).toFixed(0)} s`), 1000);
  bar.classList.add("indet");
  const ui = {
    node,
    space(id) { const a = $(".c-space", node); a.textContent = id; a.href = `https://huggingface.co/spaces/${id}`; },
    status(t) { text.textContent = t; },
    badge(t, cls = "") { badge.textContent = t; badge.className = `badge c-badge ${cls}`; },
    progress(frac) {
      if (frac == null) { bar.classList.add("indet"); return; }
      bar.classList.remove("indet");
      fill.style.width = `${Math.round(frac * 100)}%`;
    },
    debug(obj) { dbg.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2); },
    stop(final) {
      clearInterval(timer);
      $(".c-time", node).textContent = `${((performance.now() - started) / 1000).toFixed(1)} s${final ? " · " + final : ""}`;
      $(".c-cancel", node).hidden = true;
    },
  };
  $(".c-inspect", node).onclick = () => (dbg.hidden = !dbg.hidden);
  return ui;
}

function addImageToCard(ui, model, blob, url, idx) {
  const ext = (blob?.type || "image/png").split("/")[1].replace("jpeg", "jpg");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${model.id}_${stamp}${idx ? "_" + idx : ""}.${ext}`;
  const href = blob ? URL.createObjectURL(blob) : url;
  const d = document.createElement("div");
  d.className = "out";
  d.innerHTML = `<img alt="${model.name} result"/><a class="dl" download="${filename}" target="_blank" rel="noopener">Download</a>`;
  d.querySelector("img").src = href;
  d.querySelector("a").href = href;
  $(".c-imgs", ui.node).appendChild(d);
  if (blob) state.results.push({ model, blob, filename });
  $("#zipBtn").disabled = state.results.length === 0;
}

// ---------------------------------------------------------------- run one model
async function runModel(model, images, input, ui) {
  ui.badge("connecting", "run");
  const { space, client, endpoint } = await connectModel(model, ui);
  ui.space(space);

  const usable = model.multiImage ? images : images.slice(0, 1);
  const refs = usable.map((b) => handle_file(b));
  const { payload, mapping } = buildPayload(endpoint.info, { ...input, images: refs });
  ui.debug({ space, endpoint: endpoint.name, mapping });

  ui.badge("queued", "run");
  ui.status("Submitting…");
  const job = client.submit(endpoint.name, payload);
  state.jobs.set(ui.node, job);
  $(".c-cancel", ui.node).onclick = () => { job.cancel(); ui.status("Cancelled"); ui.badge("cancelled", "err"); ui.node.classList.add("failed"); ui.stop(); };

  let urls = [];
  for await (const msg of job) {
    if (msg.type === "status") {
      const s = msg;
      if (s.stage === "pending") {
        ui.badge("queued", "run");
        ui.status(s.position != null ? `In queue: position ${s.position + 1}${s.size ? " of " + s.size : ""}${s.eta ? ` · ETA ${Math.round(s.eta)} s` : ""}` : "Waiting for GPU…");
        ui.progress(null);
      } else if (s.stage === "generating" || s.stage === "pending" || s.progress_data) {
        ui.badge("generating", "run");
        const p = s.progress_data?.[0];
        if (p?.index != null && p?.length) {
          ui.status(`${p.desc || "Generating"} ${p.index}/${p.length}${p.unit ? " " + p.unit : ""}`);
          ui.progress(p.index / p.length);
        } else { ui.status("Generating…"); ui.progress(null); }
      } else if (s.stage === "error") {
        throw new Error(s.message || "The Space returned an error");
      }
    } else if (msg.type === "data") {
      const found = extractImageUrls(msg.data);
      if (found.length) urls = found;
    }
  }
  state.jobs.delete(ui.node);
  if (!urls.length) throw new Error("Finished, but no image came back. Open “Inspect API” and check the endpoint/parameters.");

  // Some Spaces return [input, output] (ImageSlider). Keep the last image if there are 2 and the first is our input.
  if (urls.length === 2 && /slider/i.test(JSON.stringify(endpoint.info.returns || []))) urls = [urls[1]];

  ui.status("Downloading result…");
  let i = 0;
  for (const url of urls) {
    let blob = null;
    try {
      const r = await fetch(url);
      if (r.ok) blob = await r.blob();
    } catch { /* CORS: fall back to direct link */ }
    addImageToCard(ui, model, blob, url, urls.length > 1 ? ++i : 0);
  }
  ui.badge("done", "ok");
  ui.node.classList.add("done");
  ui.stop(space.split("/")[1]);
}

// ---------------------------------------------------------------- generate
const runBtn = $("#runBtn");
const formMsg = $("#formMsg");

runBtn.onclick = async () => {
  formMsg.textContent = "";
  const prompt = $("#prompt").value.trim();
  const models = allModels().filter((m) => state.selected.has(m.id));
  if (!state.files.length) return (formMsg.textContent = "Please add an input image.");
  if (!prompt) return (formMsg.textContent = "Please write a prompt.");
  if (!models.length) return (formMsg.textContent = "Select at least one model.");

  persistToken();
  runBtn.disabled = true;
  runBtn.textContent = "Generating…";
  const grid = $("#grid");
  $(".empty-state", grid)?.remove();

  let images;
  try {
    images = await Promise.all(state.files.map(prepareBlob));
  } catch (e) {
    formMsg.textContent = "Could not read the image: " + e.message;
    runBtn.disabled = false; runBtn.textContent = "Generate";
    return;
  }
  const input = {
    prompt,
    negative: $("#negative").value.trim() || undefined,
    seed: $("#seed").value,
    steps: $("#steps").value,
    guidance: $("#guidance").value,
  };

  const runOne = async (model) => {
    const ui = makeCard(model);
    grid.prepend(ui.node);
    const go = async () => {
      ui.node.classList.remove("failed", "done");
      $(".c-status", ui.node).classList.remove("error");
      $(".c-retry", ui.node).hidden = true;
      try {
        await runModel(model, images, input, ui);
      } catch (e) {
        const msg = String(e?.message || e);
        const hint = /quota|exceeded|ZeroGPU|GPU task aborted/i.test(msg)
          ? "\n→ GPU quota reached. Add your free HF token (step 4) or wait and retry."
          : /401|403|unauthor/i.test(msg) ? "\n→ This Space needs a token or is private."
          : "";
        ui.badge("failed", "err");
        ui.node.classList.add("failed");
        $(".c-status", ui.node).classList.add("error");
        ui.status(msg + hint);
        ui.stop();
        $(".c-retry", ui.node).hidden = false;
        // drop the cached client so a retry reconnects (Space may have restarted)
        for (const k of state.clients.keys()) if (k.startsWith(($(".c-space", ui.node).textContent || "") + "|")) state.clients.delete(k);
      }
    };
    $(".c-retry", ui.node).onclick = go;
    await go();
  };

  await Promise.allSettled(models.map(runOne));
  runBtn.disabled = false;
  runBtn.textContent = "Generate";
};

// Ctrl/⌘+Enter to run
$("#prompt").addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runBtn.click(); });

// ---------------------------------------------------------------- zip & clear
$("#zipBtn").onclick = async () => {
  if (!state.results.length) return;
  const btn = $("#zipBtn");
  btn.disabled = true; btn.textContent = "Zipping…";
  try {
    const { default: JSZip } = await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
    const zip = new JSZip();
    const prompt = $("#prompt").value.trim();
    zip.file("prompt.txt", prompt + "\n");
    state.results.forEach((r) => zip.file(r.filename, r.blob));
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `image-edit-results_${Date.now()}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) {
    formMsg.textContent = "Zip failed: " + e.message;
  } finally {
    btn.disabled = false; btn.textContent = "Download all (.zip)";
  }
};
$("#clearBtn").onclick = () => {
  for (const job of state.jobs.values()) try { job.cancel(); } catch {}
  state.jobs.clear();
  state.results = [];
  $("#zipBtn").disabled = true;
  $("#grid").innerHTML = `<div class="empty-state"><p>Your generated images will appear here, one card per model.</p></div>`;
};
