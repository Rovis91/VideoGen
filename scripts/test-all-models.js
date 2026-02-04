/**
 * Test every video model once: generates a short video per model using
 * image (and video for motion control) from project root. Requires KIE_API_KEY.
 *
 * Usage: node scripts/test-all-models.js
 * Optional env: IMAGE_PATH=path/to/image.png VIDEO_PATH=path/to/video.mp4
 *
 * Output: test-output/<model>.mp4 for each model.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'test-output');

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp'];
const VIDEO_EXT = ['.mp4', '.mov', '.mkv'];

function findFirst(dir, exts) {
  const names = fs.readdirSync(dir);
  for (const ext of exts) {
    const f = names.find((n) => n.toLowerCase().endsWith(ext));
    if (f) return path.join(dir, f);
  }
  return null;
}

function fileToBase64(filePath) {
  const buf = fs.readFileSync(filePath);
  return buf.toString('base64');
}

function mimeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.png'].includes(ext)) return 'image/png';
  if (['.jpg', '.jpeg'].includes(ext)) return 'image/jpeg';
  if (['.webp'].includes(ext)) return 'image/webp';
  if (['.mp4'].includes(ext)) return 'video/mp4';
  if (['.mov'].includes(ext)) return 'video/quicktime';
  if (['.mkv'].includes(ext)) return 'video/x-matroska';
  return 'application/octet-stream';
}

function slug(modelId) {
  return modelId.replace(/\//g, '-');
}

async function main() {
  const apiKey = process.env.KIE_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    console.error('Set KIE_API_KEY (or GOOGLE_API_KEY) in the environment.');
    process.exit(1);
  }

  const imagePath = process.env.IMAGE_PATH || findFirst(ROOT, IMAGE_EXT);
  const videoPath = process.env.VIDEO_PATH || findFirst(ROOT, VIDEO_EXT);

  if (!imagePath || !fs.existsSync(imagePath)) {
    console.error('No image found in project root. Set IMAGE_PATH or add a .png/.jpg/.webp file.');
    process.exit(1);
  }
  if (!videoPath || !fs.existsSync(videoPath)) {
    console.warn('No video found in root. Motion Control test will be skipped. Set VIDEO_PATH or add a .mp4/.mov/.mkv.');
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const imageBase64 = fileToBase64(imagePath);
  const imageMime = mimeFromPath(imagePath);
  const videoBase64 = videoPath && fs.existsSync(videoPath) ? fileToBase64(videoPath) : null;
  const videoMime = videoPath ? mimeFromPath(videoPath) : 'video/mp4';

  const { generateOneVideo, VIDEO_MODELS, MODEL_INPUTS } = require(path.join(ROOT, 'video.js'));
  let models = Object.keys(VIDEO_MODELS);
  const modelFilter = process.env.MODEL;
  if (modelFilter && modelFilter.trim()) {
    const prefix = modelFilter.trim().toLowerCase();
    models = models.filter((id) => id.toLowerCase().startsWith(prefix) || id.toLowerCase().includes(prefix));
    if (models.length === 0) {
      console.error(`No model id matches filter: ${modelFilter}`);
      process.exit(1);
    }
    console.log(`Filter: only ${models.join(', ')}\n`);
  }

  const ideaConcept = 'Product showcase: smooth reveal, close-up, short ad.';
  const durationSeconds = 5;
  const index = 0;

  for (const modelId of models) {
    const inputs = MODEL_INPUTS[modelId];
    const needsImage = inputs && inputs.imageMin > 0;
    const needsVideo = inputs && inputs.videoMin > 0;

    if (needsVideo && !videoBase64) {
      console.log(`[SKIP] ${modelId} (no video input)`);
      continue;
    }

    const opts = {
      apiKey: apiKey.trim(),
      ideaConcept,
      durationSeconds,
      index,
      videoPrompt: '',
      veoModel: modelId,
    };

    if (needsImage) {
      opts.imageBase64List = [imageBase64];
      opts.imageMimeTypes = [imageMime];
    }
    if (needsVideo) {
      opts.videoBase64 = videoBase64;
      opts.videoMimeType = videoMime;
    }

    const outFile = path.join(OUT_DIR, `${slug(modelId)}.mp4`);
    process.stdout.write(`[${modelId}] Generating… `);
    const start = Date.now();
    try {
      const result = await generateOneVideo(opts);
      fs.writeFileSync(outFile, result.buffer);
      console.log(`OK (${((Date.now() - start) / 1000).toFixed(0)}s) → ${outFile}`);
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
