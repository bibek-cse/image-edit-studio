// ---------------------------------------------------------------------------
// Site configuration — edit these values, nothing else is required.
// ---------------------------------------------------------------------------
export const CONFIG = {
  // "Sign in with Hugging Face"
  // 1. Go to https://huggingface.co/settings/connected-applications → create a new OAuth app
  // 2. Homepage URL + Redirect URL: https://bibek-cse.github.io/image-edit-studio/
  // 3. Scopes: openid, profile, read-repos, inference-api
  // 4. Paste the Client ID below (it is public, safe to commit).
  // Leave empty to hide the button (users can still paste a token).
  hfOAuthClientId: "",
  hfOAuthScopes: "openid profile read-repos inference-api",

  // "Open in Colab" — notebook path inside this GitHub repo
  githubRepo: "bibek-cse/image-edit-studio",
  githubBranch: "main",
  colabNotebook: "colab/sdxl_edit.ipynb",
};
