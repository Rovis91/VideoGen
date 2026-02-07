# Backend – Kie.ai API

Backend needs, model list, and response handling (aligned with [Kie.ai docs](https://docs.kie.ai/)).

## Flow

1. **Ideas** – Frontend calls `/api/ideas` → backend uses **Gemini 2.5 Flash** chat (Kie) + image URL to get 10 ad ideas (JSON).
2. **Video prompt** – For each video, backend turns the selected idea into a video prompt via **Gemini 2.5 Flash** chat (text-only, no image).
3. **Video job** – Backend starts a video task (Veo or Jobs API), returns `taskId` + `provider`.
4. **Status / result** – Frontend polls `GET /api/video?taskId=&provider=` until `status: success`, then downloads via `/api/video/download`.

All Kie responses use `{ code, msg, data }` for errors; chat success uses OpenAI-style `{ choices: [{ message: { content } }] }`. The backend normalizes both.

## Chat (Gemini 2.5 Flash)

- **Endpoint:** `POST https://api.kie.ai/gemini-2.5-flash/v1/chat/completions`
- **Doc:** [Gemini 2.5 Flash](https://docs.kie.ai/market/gemini/gemini-2.5-flash)
- **Success:** Body = `{ id, object, model, choices: [{ message: { content } }] }`
- **Error:** Body = `{ code, msg }` (no `choices`). Backend throws with `msg` so the user sees a clear message instead of "No content in chat response. Response keys: code, msg."

## Credits

- **Endpoint:** `GET https://api.kie.ai/api/v1/chat/credit`
- **Doc:** [Get Remaining Credits](https://docs.kie.ai/common-api/get-account-credits)
- **Response:** `{ code, msg, data }` where `data` = remaining credits number.

## Video models

| App model ID | Label | API | Endpoint / status | Doc |
|--------------|--------|-----|-------------------|-----|
| `veo3` | Veo 3.1 Quality | Veo | POST `/api/v1/veo/generate` → GET `record-info`, `get-1080p-video` | [Veo 3.1](https://docs.kie.ai/veo3-api/quickstart), [Generate](https://docs.kie.ai/veo3-api/generate-veo-3-video) |
| `veo3_fast` | Veo 3.1 Fast | Veo | Same | Same |
| `sora-2-pro-image-to-video` | Sora 2 Pro (Image) | Jobs | POST `createTask` → GET `recordInfo` | [Sora 2 Pro Image](https://docs.kie.ai/market/sora2/sora-2-pro-image-to-video) |
| `sora-2-pro-text-to-video` | Sora 2 Pro (Text) | Jobs | Same | [Sora 2 Pro Text](https://docs.kie.ai/market/sora2/sora-2-pro-text-to-video) |
| `kling-2.6/image-to-video` | Kling 2.6 (Image) | Jobs | Same | [Kling 2.6 Image](https://docs.kie.ai/market/kling/image-to-video) |
| `kling-2.6/motion-control` | Kling 2.6 Motion Control | Jobs | Same | [Kling Motion Control](https://docs.kie.ai/market/kling/motion-control) |

### Inputs per model (Kie doc-backed)

- **Veo (veo3, veo3_fast):** 1–2 images (`imageUrls`), prompt, `aspect_ratio: "16:9"`, `generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO"`. Status: `record-info` → `successFlag` 0|1|2|3; result in `resultUrls` or via `get-1080p-video`.
- **Sora 2 Pro Image:** 1 image (`image_urls`), `prompt`, `aspect_ratio: "landscape"`, `n_frames` ("10"|"15"), `size` ("standard"|"high"), `remove_watermark: true`.
- **Sora 2 Pro Text:** No image. `prompt`, `aspect_ratio: "landscape"`, `n_frames`, `size: "high"`, `remove_watermark: true`.
- **Kling 2.6 Image:** 1 image (`image_urls`), `prompt`, `sound: false`, `duration: "5"|"10"`.
- **Kling 2.6 Motion:** 1 image (`input_urls`), 1 video (`video_urls`, 3–30 s, ≤100 MB), `prompt`, `mode: "720p"`, `character_orientation: "image"|"video"`.

### Jobs API (Market)

- **Create:** `POST https://api.kie.ai/api/v1/jobs/createTask` — body: `{ model, input [, callBackUrl ] }` → `{ code, msg, data: { taskId } }`.
- **Status:** `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=` — doc: [Get Task Details](https://docs.kie.ai/market/common/get-task-detail). Response: `data.state` = `waiting`|`queuing`|`generating`|`success`|`fail`; on success `data.resultJson` is a JSON string `{ "resultUrls": [ "..." ] }`; on fail `data.failMsg` / `data.failCode`.

## Recovery and timeouts

- **Chat:** If the server returns `{ code, msg }` only (e.g. rate limit, filter, timeout), the backend throws with `msg` so the UI can show "Try again or use a different prompt" instead of a generic "No content" message.
- **Video:** Frontend polls with a fixed interval and max attempts; backend does not block on long-running jobs. For faster feedback, consider adding `callBackUrl` when creating tasks (optional).
