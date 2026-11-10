# Open Image Edit Studio

A **free, static** web interface for image + text → image editing with open-weight models:

| Model | Default Space(s) | License |
|---|---|---|
| **Qwen-Image-Edit** (20B) | `Qwen/Qwen-Image-Edit-2511` → `-2509` → `Qwen/Qwen-Image-Edit` | Apache-2.0 |
| **FLUX.1 Kontext [dev]** (12B) | `black-forest-labs/FLUX.1-Kontext-Dev` | FLUX.1 [dev] Non-Commercial |
| **FireRed-Image-Edit** | `FireRedTeam/FireRed-Image-Edit-1.1` → `-1.0` → `prithivMLmods/FireRed-Image-Edit-1.0-Fast` | Apache-2.0 |
| **SDXL** (CosXL Edit / SDXL-Turbo img2img) | `multimodalart/cosxl` → `Manjushri/SDXL-Turbo-Img2Img-CPU` | Stability Non-Commercial |

Users upload an image (plus up to 2 reference images), write a prompt, tick one or more models, and download each result. They can also download every result as a `.zip`.

## How it works

GitHub Pages only serves static files and can't run a GPU. So the page uses the official
[`@gradio/client`](https://www.npmjs.com/package/@gradio/client) **in the visitor's browser** to call the
**public Hugging Face Spaces** that already host these models, the same API shown on each Space's "Use via API" page.

* No backend, no server costs, no API keys in the repo.
* The site reads each Space's API schema (`view_api()`) and auto-maps
  *image / prompt / seed / steps / guidance / negative prompt* to the Space's own parameter names. If a Space renames
  its inputs, it usually keeps working without code changes. Click **Inspect API** on a result card to see the mapping.
* If the first Space for a model is down, the next one in the list is tried.

## Deploy on GitHub Pages (5 minutes)

1. Create a new **public** repository on GitHub, e.g. `image-edit-studio`.
2. Upload all files from this folder to the repo root: `index.html`, `style.css`, `app.js`, `engine.js`, `models.js`, `.nojekyll`, `README.md`.
   ```bash
   git init && git add . && git commit -m "Open Image Edit Studio"
   git branch -M main
   git remote add origin https://github.com/<your-username>/image-edit-studio.git
   git push -u origin main
   ```
3. On the repo page, open **Settings → Pages**. Set **Source: Deploy from a branch**, **Branch: `main` / `(root)`**, then Save.
4. After about a minute the site is live at `https://<your-username>.github.io/image-edit-studio/`.

## GPU quota (important)

The model Spaces run on Hugging Face **ZeroGPU**, which is free but rate-limited **per visitor**:

* **Anonymous visitors** get a very small daily GPU quota, often just a few generations.
* **Free HF account**: paste a *read* token from <https://huggingface.co/settings/tokens> into step 4 of the page. Calls then use that account's quota, which is larger. **PRO** accounts get much more.
* The token stays in the visitor's browser. It is sent only to `huggingface.co` / `*.hf.space`, and is saved to `localStorage` only if "remember" is ticked. **Never commit a token to the repo.**

If a model says *"GPU quota exceeded"*, add a token or wait for the quota to reset.

## Customising

* **Change or add Spaces:** edit `models.js` and add Space IDs to `spaces: [...]`, best first.
  Or use **Model settings** on the page to override per browser.
* **Any other Gradio Space:** type `owner/space` into **Custom Space ID**. Any Space that has an image input and a
  text prompt will work.
* **Your own un-queued copy:** open a Space on Hugging Face, click **⋮ → Duplicate this Space**, pick a GPU, and put the new ID
  first in `models.js`. Your own GPU hardware is billed to you, and hosting your own ZeroGPU Space requires PRO.

## Files

```
index.html   page layout
style.css    styling (light/dark)
app.js       UI, uploads, Space connection, queue/progress, downloads
engine.js    schema-driven endpoint picking + payload building (pure JS, testable)
models.js    model → Space registry (edit this to add models)
.nojekyll    tells GitHub Pages to serve files as-is
```

## Licenses and responsible use

This interface is MIT-licensed. **Each model keeps its own license.** Qwen-Image-Edit and FireRed-Image-Edit
are Apache-2.0, so commercial use is allowed. FLUX.1 Kontext [dev], CosXL and SDXL-Turbo are **non-commercial / research only**.
Calling a public Space through its API is the intended use of that API. Follow each Space's terms and
Hugging Face's content policy, and don't use edits to deceive or impersonate real people.
