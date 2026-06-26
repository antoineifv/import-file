// ── Fonction serverless Vercel : proxy sécurisé vers l'API AGOL ──────────
// Cette fonction tourne sur le serveur Vercel, JAMAIS dans le navigateur.
// La clé API reste ici, dans une variable d'environnement (process.env),
// elle n'est jamais transmise au client.
//
// Fichier à placer dans : /api/agol-proxy.js (à la racine du projet Vercel)

const PORTAL_URL = "https://vignevin.maps.arcgis.com";

export default async function handler(req, res) {
  // Autorise les requêtes depuis votre portail (CORS)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée" });
    return;
  }

  // ⚠️ La clé est lue depuis les variables d'environnement Vercel,
  // jamais écrite en dur dans ce fichier.
  const API_KEY = process.env.AGOL_API_KEY;

  if (!API_KEY) {
    res.status(500).json({ error: "Clé API non configurée côté serveur" });
    return;
  }

  const { action } = req.body;

  try {
    let result;

    switch (action) {
      case "upload":
        result = await handleUpload(req.body, API_KEY);
        break;
      case "analyze": {
  await new Promise(resolve => setTimeout(resolve, 2000));
  const { itemId, csvText } = body;
  const analyzeParams = new URLSearchParams({
    text: csvText,
    fileType: "csv",
    f: "json",
    token: API_KEY,
    analyzeParameters: JSON.stringify({ locationType: "none" })
  });
  const analyzeResp = await fetch(`${PORTAL_URL}/sharing/rest/content/features/analyze`, {
    method: "POST",
    body: analyzeParams
  });
  const analyzeData = await analyzeResp.json();
  if (analyzeData.error) throw new Error("analyze : " + analyzeData.error.message);
  return res.status(200).json(analyzeData);
}

    res.status(200).json(result);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ── addItem : upload du fichier CSV brut ──────────────────────────────
async function handleUpload({ username, fileName, fileContent }, token) {
  // fileContent arrive en base64 depuis le navigateur (voir formulaire)
  const buffer = Buffer.from(fileContent, "base64");
  const blob = new Blob([buffer], { type: "text/csv" });

  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("title", "upload_" + Date.now());
  formData.append("type", "CSV");
  formData.append("token", token);
  formData.append("f", "json");

  const resp = await fetch(`${PORTAL_URL}/sharing/rest/content/users/${username}/addItem`, {
    method: "POST",
    body: formData
  });
  const data = await resp.json();
  if (data.error) throw new Error("addItem : " + data.error.message);
  return data;
}

// ── analyze : détection automatique de la structure du CSV ────────────
async function handleAnalyze({ itemId }, token) {
  const params = new URLSearchParams({
    itemId,
    f: "json",
    token,
    fileType: "csv",
    analyzeParameters: JSON.stringify({ locationType: "none" })
  });

  const resp = await fetch(`${PORTAL_URL}/sharing/rest/content/features/analyze`, {
    method: "POST",
    body: params
  });
  const data = await resp.json();
  if (data.error) throw new Error("analyze : " + data.error.message);
  return data;
}

// ── publish : publication en Feature Layer ─────────────────────────────
async function handlePublish({ username, itemId, publishParameters }, token) {
  publishParameters.name = "couche_" + Date.now();

  const params = new URLSearchParams({
    itemId,
    filetype: "csv",
    publishParameters: JSON.stringify(publishParameters),
    token,
    f: "json"
  });

  const resp = await fetch(`${PORTAL_URL}/sharing/rest/content/users/${username}/publish`, {
    method: "POST",
    body: params
  });
  const data = await resp.json();
  if (data.error) throw new Error("publish : " + data.error.message);
  if (!data.services || !data.services[0] || data.services[0].success === false) {
    throw new Error("publish : échec de la publication");
  }
  return data;
}

// ── execute : lancement du Notebook ────────────────────────────────────
async function handleRunNotebook({ notebookId, notebookParams }, token) {
  const params = new URLSearchParams({
    token,
    f: "json",
    notebookExecutionType: "ipythonKernel",
    params: JSON.stringify(notebookParams)
  });

  const resp = await fetch(`${PORTAL_URL}/sharing/rest/content/items/${notebookId}/execute`, {
    method: "POST",
    body: params
  });
  const data = await resp.json();
  if (data.error) throw new Error("execute : " + data.error.message);
  return data;
}
