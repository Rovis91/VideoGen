const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const ideasService = require('./ideas');
const videoService = require('./video');

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

function validateImagePath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!IMAGE_EXT.includes(ext)) return { ok: false, error: 'Unsupported format. Use JPEG, PNG, or WebP.' };
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return { ok: false, error: 'Not a file.' };
    if (stat.size > IMAGE_MAX_BYTES) return { ok: false, error: 'File too large (max 10 MB).' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'Cannot read file.' };
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Ad Video Generator',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.ELECTRON_RENDERER_URL;
  if (isDev) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  ipcMain.handle('getConfig', () => config.readConfig());
  ipcMain.handle('saveConfig', (_event, data) => {
    const current = config.readConfig();
    config.writeConfig({ ...current, ...data });
  });
  ipcMain.handle('openImageFile', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('openOutputFolder', async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('validateImage', (_event, filePath) => validateImagePath(filePath));
  ipcMain.handle('generateIdeas', async (_event, { imagePath, optionalText, durationSeconds, ideaPrompt }) => {
    const cfg = config.readConfig();
    if (!cfg.googleApiKey) throw new Error('No API key.');
    return ideasService.generateIdeas({
      apiKey: cfg.googleApiKey,
      imagePath,
      optionalText: optionalText || '',
      durationSeconds: durationSeconds || 10,
      ideaPrompt: ideaPrompt ?? cfg.ideaGenerationPrompt ?? undefined,
    });
  });
  ipcMain.handle('cancelGenerateIdeas', () => ideasService.cancelGenerateIdeas());
  ipcMain.handle('openFolder', (_event, dirPath) => shell.openPath(dirPath));
  ipcMain.handle('generateVideo', async (_event, { imagePath, outputFolder, videoPrompt, ideaConcept, index, durationSeconds }) => {
    const cfg = config.readConfig();
    if (!cfg?.googleApiKey?.trim()) throw new Error('Clé API manquante.');
    return videoService.generateOneVideo({
      apiKey: cfg.googleApiKey,
      imagePath,
      outputFolder,
      videoPrompt: videoPrompt ?? cfg.videoGenerationPrompt ?? '',
      ideaConcept: ideaConcept || '',
      index: index ?? 0,
      durationSeconds: durationSeconds ?? 8,
    });
  });
  ipcMain.handle('testApiKey', async (_event, apiKey) => {
    const key = (apiKey || '').trim();
    if (!key) return { ok: false, error: 'Clé vide.' };
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with OK.' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        return { ok: false, error: res.status === 401 ? 'Clé API invalide.' : (err || `Erreur ${res.status}`) };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || 'Erreur réseau.' };
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
