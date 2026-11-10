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

The Spaces run on free Hugging Face ZeroGPU, which has a small daily limit. Click **Sign in with Hugging Face** on the page so your generations use your own account's quota.

Out of quota? Click **Open in Colab** to run SDXL editing on your own free Colab GPU.

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/bibek-cse/image-edit-studio/blob/main/colab/sdxl_edit.ipynb)

## Enable "Sign in with Hugging Face" (one-time)

1. Go to <https://huggingface.co/settings/connected-applications> and create a new OAuth app.
2. Homepage URL and Redirect URL: `https://bibek-cse.github.io/image-edit-studio/`
3. Scopes: `openid`, `profile`, `read-repos`, `inference-api`
4. Copy the **Client ID** into `hfOAuthClientId` in `config.js` and push. The Client ID is public, so it's safe to commit. Never commit the client secret or any token.

## Files

```
index.html             page layout
style.css              styling
app.js                 UI, sign-in, Hugging Face calls
engine.js              maps inputs to each Space's API
models.js              list of models and their Spaces
config.js              sign-in Client ID and Colab notebook path
colab/sdxl_edit.ipynb  SDXL editing notebook for Colab
```

## Note

Each model keeps its own license. FLUX.1 Kontext [dev] and SDXL (CosXL Edit) are for non-commercial / research use only.
