// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------
// Each model points to one or more FREE public Hugging Face Spaces.
// The site tries them in order and uses the first one that is running.
//
//  - spaces:    Space IDs ("owner/name"). Add your own duplicated Space first
//               in the list if you want a private, un-queued copy.
//  - endpoints: preferred Gradio API endpoint names (checked first). If none
//               match, the site auto-detects the endpoint that takes an image
//               + a text prompt by reading the Space's API schema.
//
// You can also override the Space ID from the UI ("Model settings") without
// editing this file. Overrides are stored in your browser only.
// ---------------------------------------------------------------------------

export const MODELS = [
  {
    id: "qwen",
    name: "Qwen-Image-Edit",
    org: "Alibaba Qwen",
    params: "20B",
    license: "Apache-2.0",
    licenseNote: "Commercial use allowed",
    weights: "https://huggingface.co/Qwen/Qwen-Image-Edit-2509",
    spaces: [
      "Qwen/Qwen-Image-Edit-2511",
      "Qwen/Qwen-Image-Edit-2509",
      "Qwen/Qwen-Image-Edit",
    ],
    endpoints: ["/infer"],
    multiImage: true,
    defaultOn: true,
  },
  {
    id: "flux",
    name: "FLUX.1 Kontext [dev]",
    org: "Black Forest Labs",
    params: "12B",
    license: "FLUX.1 [dev] Non-Commercial",
    licenseNote: "Research / non-commercial only",
    weights: "https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev",
    spaces: ["black-forest-labs/FLUX.1-Kontext-Dev"],
    endpoints: ["/infer"],
    multiImage: false,
    defaultOn: true,
  },
  {
    id: "firered",
    name: "FireRed-Image-Edit",
    org: "FireRed Team",
    params: "Qwen-Image backbone",
    license: "Apache-2.0",
    licenseNote: "Commercial use allowed",
    weights: "https://huggingface.co/FireRedTeam/FireRed-Image-Edit-1.1",
    spaces: [
      "FireRedTeam/FireRed-Image-Edit-1.1",
      "FireRedTeam/FireRed-Image-Edit-1.0",
      "prithivMLmods/FireRed-Image-Edit-1.0-Fast",
    ],
    endpoints: ["/infer"],
    multiImage: true,
    defaultOn: true,
  },
  {
    id: "sdxl",
    name: "SDXL (CosXL Edit / img2img)",
    org: "Stability AI",
    params: "3.5B",
    license: "Stability Non-Commercial (CosXL / SDXL-Turbo)",
    licenseNote: "Research / non-commercial only",
    weights: "https://huggingface.co/stabilityai/cosxl",
    spaces: [
      "multimodalart/cosxl",
      "Manjushri/SDXL-Turbo-Img2Img-CPU",
    ],
    // CosXL Space exposes both a text-only and an edit endpoint; prefer edit.
    endpoints: ["/run_edit", "/predict"],
    multiImage: false,
    defaultOn: false,
  },
];

// Endpoint names that are clearly NOT the main generate call.
export const ENDPOINT_BLOCKLIST = [
  "rewrite", "enhance", "update", "random", "example", "clear", "reset",
  "load", "use_output", "swap", "upscale_only", "lambda", "toggle", "show",
  "hide", "change", "select", "on_", "set_", "get_", "refresh", "turbo_toggle",
];
