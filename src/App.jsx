import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as adgen from './api';
import { fileToBase64 } from './api';

const SCREENS = { setup: 'setup', input: 'input', ideas: 'ideas', generation: 'generation' };

const DEFAULT_IDEA_PROMPT = `You are an expert social media ad strategist for short-form video ads.

Given:
- a single product image
- an optional user theme or idea (may be empty)

Generate exactly 10 short ad video ideas suitable for social media (5–20 seconds).

IMPORTANT DISTRIBUTION RULE:
- Ideas 1–5 must follow proven short-form ad best practices (clear benefit, transformation, problem/solution, demonstration, scroll-stopping hook).
- Ideas 6–8 must be original or creative while still realistic and product-focused.
- Ideas 9–10 must be experimental but still visually achievable in a short UGC-style video.

Each idea must be:
- easy to understand for a non-technical e-commerce user
- short enough to read in one line
- visual and concrete (no abstract concepts)
- suitable for a silent video (no audio required)

Output ONLY a valid JSON array of exactly 10 objects.
No markdown. No explanations. No extra text.

Each object MUST contain exactly these fields:

- "angle": a short marketing angle (one short phrase)
- "hook": a clear scroll-stopping opening idea
- "visualAction": what is visibly happening in the video (concrete actions only)
- "outcome": the result, benefit, or visual call-to-action

Do NOT:
- include video duration
- include tone, mood, or brand language
- include camera terminology
- include text overlays or audio instructions
`;

const DEFAULT_VIDEO_PROMPT = `You are a video director generating a prompt for a short social media video.

Input:
- One ad idea containing: angle, hook, visualAction, outcome
- A product image will be provided separately
- A target video duration (already decided by the user)

Your task:
Write ONE detailed video generation prompt that expands the idea into a short UGC-style video.

Rules:
- The video must be purely visual (no audio, no voice-over, no on-screen text).
- The product must appear clearly and naturally.
- The video should feel like short-form social content (simple, realistic, engaging).
- Use a simple multi-shot structure (2–4 shots maximum).
- Describe only what is visible and happening.
- Do NOT include camera terminology (no lens types, no camera angles).
- Do NOT include tone labels, emotions as abstract words, or brand language.

Structure the prompt clearly using this order:
1. Brief overall description of the video
2. Shot-by-shot visual breakdown (short sentences)
3. How the product is used or highlighted
4. Final visual outcome

The description must be concrete enough that a video model can generate a complete video from it.

Output ONLY the video generation prompt.
No preamble.
No explanations.
No quotes.
`;

function formatIdeaDisplay(idea) {
  const a = (idea.angle ?? '').trim();
  const h = (idea.hook ?? '').trim();
  const v = (idea.visualAction ?? '').trim();
  const o = (idea.outcome ?? '').trim();
  if (!a && !h && !v && !o) return idea.concept ?? '';
  return a + (h ? ' — ' + h : '') + (v ? ' | ' + v : '') + (o ? ' | ' + o : '');
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.setup);
  const [apiKey, setApiKey] = useState('');
  const [ideaPrompt, setIdeaPrompt] = useState('');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupSaving, setSetupSaving] = useState(false);

  const [imageFile, setImageFile] = useState(null);
  const [imageName, setImageName] = useState('');
  const [imageError, setImageError] = useState('');
  const [optionalIdea, setOptionalIdea] = useState('');
  const [duration, setDuration] = useState(10);
  const [veoModel, setVeoModel] = useState('veo-3.1-generate-preview');
  const [ideas, setIdeas] = useState([]);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState('');
  const [generationMessage, setGenerationMessage] = useState('');
  const [showOpenFolder, setShowOpenFolder] = useState(false);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [videoStatuses, setVideoStatuses] = useState([]);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [apiKeyTestResult, setApiKeyTestResult] = useState(null);
  const [apiKeyTesting, setApiKeyTesting] = useState(false);

  useEffect(() => {
    const cfg = adgen.getConfig();
    if (cfg.googleApiKey) setApiKey(cfg.googleApiKey);
    setIdeaPrompt(cfg.ideaGenerationPrompt != null && cfg.ideaGenerationPrompt !== '' ? cfg.ideaGenerationPrompt : DEFAULT_IDEA_PROMPT);
    setVideoPrompt(cfg.videoGenerationPrompt != null && cfg.videoGenerationPrompt !== '' ? cfg.videoGenerationPrompt : DEFAULT_VIDEO_PROMPT);
    if (cfg.defaultDurationSeconds) setDuration(cfg.defaultDurationSeconds);
    if (cfg.veoModel) setVeoModel(cfg.veoModel);
    setHasApiKey(!!(cfg.googleApiKey && cfg.googleApiKey.trim()));
  }, []);

  useEffect(() => {
    const cfg = adgen.getConfig();
    if (cfg.googleApiKey && cfg.googleApiKey.trim()) {
      setScreen(SCREENS.input);
    }
  }, []);

  useEffect(() => {
    if (screen !== SCREENS.generation) return;
    const cfg = adgen.getConfig();
    setHasApiKey(!!(cfg?.googleApiKey?.trim()));
  }, [screen]);

  async function handleSetupSave() {
    setSetupError('');
    setApiKeyTestResult(null);
    const key = apiKey.trim();
    if (!key) {
      setSetupError('Veuillez saisir une clé API valide.');
      return;
    }
    setSetupSaving(true);
    try {
      await adgen.saveConfig({
        googleApiKey: key,
        ideaGenerationPrompt: ideaPrompt.trim() === DEFAULT_IDEA_PROMPT.trim() ? '' : ideaPrompt,
        videoGenerationPrompt: videoPrompt.trim() === DEFAULT_VIDEO_PROMPT.trim() ? '' : videoPrompt,
      });
      setHasApiKey(true);
      setScreen(SCREENS.input);
    } catch (e) {
      setSetupError(e.message || 'Erreur lors de l\'enregistrement.');
    }
    setSetupSaving(false);
  }

  async function handleTestApiKey() {
    setApiKeyTestResult(null);
    const key = apiKey.trim();
    if (!key) {
      setApiKeyTestResult({ ok: false, error: 'Saisissez une clé d\'abord.' });
      return;
    }
    setApiKeyTesting(true);
    try {
      const result = await adgen.testApiKey(key);
      setApiKeyTestResult(result);
    } catch (e) {
      setApiKeyTestResult({ ok: false, error: e.message || 'Erreur.' });
    }
    setApiKeyTesting(false);
  }

  async function handlePickImage() {
    const file = await adgen.openImageFile();
    if (!file) return;
    const result = adgen.validateImage(file);
    if (!result.ok) {
      setImageError(result.error);
      setImageFile(null);
      setImageName('');
    } else {
      setImageFile(file);
      setImageError('');
      setImageName(file.name);
    }
  }

  function handleDurationChange(e) {
    const v = parseInt(e.target.value, 10);
    setDuration(v);
    adgen.saveConfig({ defaultDurationSeconds: v });
  }

  async function handleGenerateIdeas() {
    if (!imageFile) return;
    setIdeasLoading(true);
    setIdeasError('');
    await adgen.saveConfig({
      ideaGenerationPrompt: ideaPrompt.trim() === DEFAULT_IDEA_PROMPT.trim() ? '' : ideaPrompt.trim(),
    });
    setScreen(SCREENS.ideas);
    try {
      const imageBase64 = await fileToBase64(imageFile);
      const cfg = adgen.getConfig();
      const list = await adgen.generateIdeas({
        imageBase64,
        mimeType: imageFile.type || 'image/jpeg',
        optionalText: optionalIdea,
        durationSeconds: duration,
        ideaPrompt: ideaPrompt || undefined,
        apiKey: (cfg.googleApiKey || apiKey || '').trim() || undefined,
      });
      setIdeas(list);
      setSelectedIndices(new Set());
    } catch (e) {
      setIdeasError(e.message || 'Échec de la génération des idées.');
    }
    setIdeasLoading(false);
  }

  function handleBackFromIdeas() {
    adgen.cancelGenerateIdeas?.();
    setScreen(SCREENS.input);
  }

  function toggleIdea(index) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleGenerateVideos() {
    if (selectedIndices.size === 0) return;
    if (!imageFile) {
      setGenerationError('Image produit manquante. Retournez à l\'écran Entrée.');
      return;
    }
    await adgen.saveConfig({
      videoGenerationPrompt: videoPrompt.trim() === DEFAULT_VIDEO_PROMPT.trim() ? '' : videoPrompt.trim(),
    });
    setScreen(SCREENS.generation);
    setGenerationError('');
    setGenerationMessage('');
    setShowOpenFolder(false);
    setGenerationLoading(true);
    const cfg = adgen.getConfig();
    if (!cfg?.googleApiKey?.trim()) {
      setGenerationError('Clé API manquante. Allez dans Configuration pour saisir une clé Google.');
      setGenerationLoading(false);
      return;
    }
    const imageBase64 = await fileToBase64(imageFile);
    const selectedIdeas = Array.from(selectedIndices).map((i) => ideas[i]);
    const promptToSend = videoPrompt.trim() === DEFAULT_VIDEO_PROMPT.trim() ? '' : videoPrompt;
    const statuses = selectedIdeas.map(() => ({ status: 'pending', error: null }));
    setVideoStatuses(statuses);
    const CONCURRENCY = 2;
    let anyDone = false;
    const runOne = async (idea, idx) => {
      setVideoStatuses((prev) => {
        const next = [...prev];
        next[idx] = { status: 'loading', error: null };
        return next;
      });
      try {
        const result = await adgen.generateVideo({
          imageBase64,
          mimeType: imageFile.type || 'image/jpeg',
          videoPrompt: promptToSend,
          ideaConcept: formatIdeaDisplay(idea),
          index: idx,
          durationSeconds: duration,
          apiKey: (cfg.googleApiKey || '').trim() || undefined,
          veoModel: veoModel || undefined,
        });
        anyDone = true;
        setShowOpenFolder(true);
        setVideoStatuses((prev) => {
          const next = [...prev];
          next[idx] = { status: 'done', error: null, url: result.url, filename: result.filename };
          return next;
        });
      } catch (e) {
        setVideoStatuses((prev) => {
          const next = [...prev];
          next[idx] = { status: 'error', error: e.message || 'Erreur' };
          return next;
        });
      }
    };
    for (let i = 0; i < selectedIdeas.length; i += CONCURRENCY) {
      await Promise.all(
        selectedIdeas.slice(i, i + CONCURRENCY).map((idea, j) => runOne(idea, i + j))
      );
    }
    setGenerationLoading(false);
    setGenerationMessage(anyDone ? 'Téléchargez les vidéos ci-dessous.' : '');
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <nav className="flex gap-2 mb-6">
        <Button variant={screen === SCREENS.setup ? 'default' : 'outline'} onClick={() => setScreen(SCREENS.setup)}>Configuration</Button>
        <Button variant={screen === SCREENS.input ? 'default' : 'outline'} onClick={() => setScreen(SCREENS.input)}>Entrée</Button>
        <Button variant={screen === SCREENS.ideas ? 'default' : 'outline'} onClick={() => setScreen(SCREENS.ideas)}>Idées</Button>
        <Button variant={screen === SCREENS.generation ? 'default' : 'outline'} onClick={() => setScreen(SCREENS.generation)}>Génération</Button>
      </nav>

      {screen === SCREENS.setup && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">Clé API Google</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Collez votre clé API Google"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="idea-prompt">Prompt idées (génération d&apos;idées pub)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIdeaPrompt(DEFAULT_IDEA_PROMPT);
                    adgen.saveConfig({ ideaGenerationPrompt: '' });
                  }}
                >
                  Réinitialiser
                </Button>
              </div>
              <Textarea
                id="idea-prompt"
                value={ideaPrompt}
                onChange={(e) => setIdeaPrompt(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="video-prompt">Prompt vidéo (génération de vidéos)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setVideoPrompt(DEFAULT_VIDEO_PROMPT);
                    adgen.saveConfig({ videoGenerationPrompt: '' });
                  }}
                >
                  Réinitialiser
                </Button>
              </div>
              <Textarea
                id="video-prompt"
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                className="min-h-[80px] font-mono text-xs"
              />
            </div>
            {setupError && <p className="text-sm text-red-600">{setupError}</p>}
            {apiKeyTestResult && (
              <div className={`rounded-md p-3 text-sm ${apiKeyTestResult.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                {apiKeyTestResult.ok ? '✓ Clé API valide.' : `✗ ${apiKeyTestResult.error}`}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleTestApiKey} variant="outline" disabled={apiKeyTesting || !apiKey.trim()}>
                {apiKeyTesting ? 'Test…' : 'Tester la clé API'}
              </Button>
              <Button onClick={handleSetupSave} disabled={setupSaving}>Enregistrer</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {screen === SCREENS.input && (
        <Card>
          <CardHeader>
            <CardTitle>Entrée</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Image produit</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handlePickImage}>Choisir une image</Button>
                <span className="text-sm text-neutral-600 truncate flex-1">{imageName || '—'}</span>
              </div>
              {imageError && <p className="text-sm text-red-600">{imageError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="idea">Idée optionnelle (indice texte)</Label>
              <Textarea
                id="idea"
                placeholder="ex. soldes d'été, look luxe"
                value={optionalIdea}
                onChange={(e) => setOptionalIdea(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Durée vidéo (secondes)</Label>
              <Select id="duration" value={duration} onChange={handleDurationChange}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="veo-model">Modèle Veo 3</Label>
              <Select
                id="veo-model"
                value={veoModel}
                onChange={(e) => {
                  const v = e.target.value;
                  setVeoModel(v);
                  adgen.saveConfig({ veoModel: v });
                }}
              >
                <option value="veo-3.1-generate-preview">Veo 3.1 Preview</option>
                <option value="veo-3.1-generate">Veo 3.1 Pro</option>
              </Select>
            </div>
            <Button onClick={handleGenerateIdeas} disabled={!imageFile || ideasLoading}>
              Générer les idées
            </Button>
          </CardContent>
        </Card>
      )}

      {screen === SCREENS.ideas && (
        <Card>
          <CardHeader>
            <CardTitle>Idées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ideasLoading && <p className="text-sm text-neutral-600">Génération des idées…</p>}
            {ideasError && <p className="text-sm text-red-600">{ideasError}</p>}
            {!ideasLoading && ideas.length > 0 && (
              <div className="space-y-3">
                {ideas.map((idea, i) => {
                  const display = formatIdeaDisplay(idea);
                  return (
                    <label key={i} className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedIndices.has(i)}
                        onChange={() => toggleIdea(i)}
                      />
                      <span className="text-sm">{display}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBackFromIdeas}>Retour</Button>
              <Button
                onClick={handleGenerateVideos}
                disabled={selectedIndices.size === 0}
              >
                Générer les vidéos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {screen === SCREENS.generation && (
        <Card>
          <CardHeader>
            <CardTitle>Génération</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasApiKey && (
              <div className="rounded-md p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
                <strong>Clé API manquante.</strong> Allez dans <button type="button" className="underline font-medium" onClick={() => setScreen(SCREENS.setup)}>Configuration</button> pour saisir votre clé Google.
              </div>
            )}
            {hasApiKey && generationLoading && (
              <div className="flex items-center gap-3 rounded-md p-4 bg-neutral-50 border border-neutral-200">
                <div className="h-6 w-6 rounded-full border-2 border-neutral-300 border-t-neutral-900 animate-spin shrink-0" aria-hidden />
                <p className="text-sm text-neutral-700">Génération en cours… (Veo 3.1)</p>
              </div>
            )}
            {videoStatuses.length > 0 && (
              <ul className="space-y-2 text-sm">
                {videoStatuses.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">Vidéo {i + 1} :</span>
                    {item.status === 'pending' && <span className="text-neutral-500">En attente</span>}
                    {item.status === 'loading' && (
                      <span className="flex items-center gap-1">
                        <span className="h-3 w-3 rounded-full border-2 border-neutral-300 border-t-neutral-700 animate-spin shrink-0" />
                        En cours…
                      </span>
                    )}
                    {item.status === 'done' && (
                      <>
                        <span className="text-green-600">✓ Terminé</span>
                        {item.url && item.filename && (
                          <a
                            href={item.url}
                            download={item.filename}
                            className="text-blue-600 underline font-medium"
                          >
                            Télécharger {item.filename}
                          </a>
                        )}
                      </>
                    )}
                    {item.status === 'error' && (
                      <span className="text-red-600">✗ {item.error || 'Erreur'}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {hasApiKey && !generationLoading && generationError && (
              <div className="rounded-md p-4 bg-red-50 border border-red-200 text-red-700 text-sm">
                <strong>Erreur :</strong> {generationError}
              </div>
            )}
            {hasApiKey && !generationLoading && generationMessage && (
              <p className="text-sm text-neutral-600">{generationMessage}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
