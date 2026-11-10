# Open Image Edit Studio

🔗 **Live demo:** https://bibek-cse.github.io/image-edit-studio/

A free web app for image + text → image editing with open-weight models. Upload an image, write a prompt, pick one or more models, and download the results.

## Models

| Model | License |
|---|---|
| Qwen-Image-Edit | Apache-2.0 |
| FLUX.1 Kontext [dev] | Non-commercial |
| FireRed-Image-Edit | Apache-2.0 |
| SDXL (CosXL Edit) | Non-commercial |

## How it works

The page runs entirely in your browser and calls free public Hugging Face Spaces for each model. There is no backend and no server cost.

## GPU quota

The Spaces run on free Hugging Face ZeroGPU, which has a small daily limit per visitor. For more generations, paste a free Hugging Face **read** token ([get one here](https://huggingface.co/settings/tokens)) into the page. Your token stays in your browser.

## Files

```
index.html   page layout
style.css    styling
app.js       UI and Hugging Face calls
engine.js    maps inputs to each Space's API
models.js    list of models and their Spaces
```

## Note

Each model keeps its own license. FLUX.1 Kontext [dev] and SDXL (CosXL Edit) are for non-commercial / research use only.
