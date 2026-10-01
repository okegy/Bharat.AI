# OCR Flow and WhatsApp Voice‑Note Handling in BharatLink

## OCR Extraction Flow

1. **UI – Scan Form** (`/scan-form`)
   - The page contains an `<input type="file">` that accepts an image of an identity document (e.g., Aadhaar).
   - When a user selects a file, the UI shows a *Process* button.

2. **Client‑side Trigger**
   - Clicking **Process** sends the image to the backend via a **POST** request to `/api/ocr/parse` (implemented in `src/app/api/ocr/parse/route.ts`).
   - The image is sent as `multipart/form‑data` (field name `file`).

3. **Server‑side Handler** (`src/app/api/ocr/parse/route.ts`)
   - The route extracts the file from `request.formData()`.
   - It forwards the binary to the **Groq OCR** model using `fetch` with the appropriate API key.
   - The model returns a JSON payload containing extracted **key/value** pairs (e.g., `Name`, `Aadhaar Number`).

4. **Response**
   - The server formats the OCR result into a simple JSON object and returns it.
   - The frontend receives the response, populates a table, and the Playwright test asserts the presence of the `Name` and `Aadhaar Number` rows.

### Why it works in the test suite
- The test uploads a static image `public/aadhaar‑sample.jpg` that is known to contain those fields.
- After clicking *Process*, the test waits for the two table cells to become visible (up to 15 s). If the OCR service is down, the test will fail, surfacing the integration problem.

---

## WhatsApp Voice‑Note Webhook Flow

1. **Twilio → WhatsApp**
   - When a user sends a voice note to the registered WhatsApp number, Twilio makes a **POST** request to our endpoint `/api/whatsapp/webhook`.
   - The request includes:
     - `From` – the sender’s WhatsApp number.
     - `MediaUrl0` – a public URL to the audio file.
     - `MediaContentType0` – MIME type (e.g., `audio/ogg`).

2. **Webhook Handler** (`src/app/api/whatsapp/webhook/route.ts`)
   - The handler validates the payload (returns `400` when required fields are missing).
   - It downloads the audio via `fetch(MediaUrl0)`.
   - The audio buffer is sent to **Groq Whisper** (speech‑to‑text) using the Groq API.
   - The transcription text is then fed to the internal LLM to generate a reply.
   - The reply is wrapped in an XML `<Message>` payload and sent back to Twilio, which forwards it to the user.

3. **Playwright Mock Test**
   - Because a real Twilio endpoint is unavailable during CI, the test constructs a **multipart/form‑data** request directly against the endpoint.
   - The audio file `public/voice‑sample.ogg` (≈ 1 KB) is read, base‑64‑encoded, and placed in the `MediaUrl0` field as a `data:` URI.
   - The test expects a `200` status and checks that the response body contains the `<Message>` XML tag, confirming that the webhook processed the audio successfully.

## Key Points for Developers
- **File locations**: All sample assets live under `public/` so they are served statically in development and bundled for the test runner.
- **Environment variables**: `GROQ_API_KEY` must be present in `.env.local` for both OCR and Whisper calls.
- **Error handling**: The webhook returns `400` on malformed payloads – we added a dedicated test to verify this behavior.
- **Video recording**: Playwright records a separate `.webm` for each test (thanks to `video` config). After the suite finishes, run `scripts\combine_videos.bat` to produce a single `demo_combined.webm` demo.

---

**Next steps**
1. Install the missing Windows runtime libraries (`icutu77.dll`, `libpng16.dll`) or use the Playwright installer with the `--with-deps` flag.
2. Finish installing `@playwright/test` (the background `npm install` task).
3. Run `npx playwright test` – videos will land in `test-results/`.
4. Execute `scripts\combine_videos.bat` to generate `demo_combined.webm`.
5. The test suite now includes language‑toggle and schema‑validation cases.

Feel free to let me know if you need assistance installing the DLLs or running the concat script.
