// This file is copied from the Antigravity brain workspace to the project scripts folder.
// It contains the comprehensive Playwright end‑to‑end test suite for BharatLink.

import { test, expect } from '@playwright/test';
import { toCentralDocument } from '../src/lib/central-doc-extractor';
import fs from 'fs';
import path from 'path';

// Playwright config (see playwright.config.ts) enables video recording for each test.
// This suite now also covers OCR extraction and voice transcription via the
// global voice navigator and the WhatsApp webhook.

test.describe('BharatLink comprehensive demo', () => {
  // ---------------------------------------------------------------------
  // 1️⃣ Landing page + sign‑in (unchanged)
  // ---------------------------------------------------------------------
  test('Landing page and sign‑in flow', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/BharatLink/);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const cta = page.locator('text=Get Started, text=Sign In, text=Continue');
    if (await cta.count()) await cta.first().click();
    const clerkForm = page.locator('input[type="email"], text=Sign in with Email');
    await expect(clerkForm).toBeVisible();
  });

  // ---------------------------------------------------------------------
  // 2️⃣ Global Voice Navigator toggle (unchanged)
  // ---------------------------------------------------------------------
  test('Voice navigator toggle works', async ({ page }) => {
    await page.goto('http://localhost:3000');
    const toggle = page.locator('[data-testid="global-voice-navigator-toggle"]');
    await expect(toggle).toBeVisible();
    await toggle.click();
    // Wait a few seconds for the speech synthesis to speak the current UI description.
    await page.waitForTimeout(3000);
  });

  // ---------------------------------------------------------------------
  // 3️⃣ Assistant page query (unchanged)
  // ---------------------------------------------------------------------
  test('Assistant page query', async ({ page }) => {
    await page.goto('http://localhost:3000/assistant');
    const input = page.locator('textarea[placeholder*="Ask"]');
    await input.fill('What is PM‑Kisan?');
    const sendBtn = page.locator('button:has-text("Send")');
    await sendBtn.click();
    const response = page.locator('.assistant-response').first();
    await expect(response).toContainText('PM‑Kisan');
  });

  // ---------------------------------------------------------------------
  // 4️⃣ Documents upload & vault storage (unchanged)
  // ---------------------------------------------------------------------
  test('Documents upload and vault storage', async ({ page }) => {
    await page.goto('http://localhost:3000/documents');
    const upload = page.locator('input[type="file"]');
    await upload.setInputFiles('public/sample.png');
    const saveBtn = page.locator('button:has-text("Save")');
    await saveBtn.click();
    const docItem = page.locator('text=sample.png');
    await expect(docItem).toBeVisible();
  });

  // ---------------------------------------------------------------------
  // 5️⃣ OCR extraction flow (new)
  // ---------------------------------------------------------------------
  test('OCR scan of Aadhaar and field extraction', async ({ page }) => {
    // The scan‑form page lets the user upload an Aadhaar scan image.
    await page.goto('http://localhost:3000/scan-form');
    // Upload a sample Aadhaar image placed in the repo (public/aadhaar-sample.jpg).
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('public/aadhaar-sample.jpg');
    // Click the "Process" button (text may vary).
    const processBtn = page.locator('button:has-text("Process"), button:has-text("Scan")');
    await processBtn.click();
    // Wait for the extracted fields to appear. The UI shows a table with keys like "Name", "Aadhaar Number".
    const nameCell = page.locator('text=Name');
    const aadhaarCell = page.locator('text=Aadhaar Number');
    await expect(nameCell).toBeVisible({ timeout: 15000 });
    await expect(aadhaarCell).toBeVisible({ timeout: 15000 });
  });

  // ---------------------------------------------------------------------
  // 6️⃣ Voice transcription via WhatsApp webhook (new)
  // ---------------------------------------------------------------------
  test('WhatsApp voice note transcription (mock)', async ({ request }) => {
    // We cannot reach Twilio from the test environment, but we can invoke the webhook directly.
    // Load a small audio file (public/voice-sample.ogg) that the Groq Whisper model can handle.
    const audioPath = 'public/voice-sample.ogg';
    const form = new FormData();
    const fileBuffer = await (await import('fs')).promises.readFile(audioPath);
    const blob = new Blob([fileBuffer], { type: 'audio/ogg' });
    form.append('From', 'whatsapp:+1234567890');
    form.append('Body', '');
    form.append('MediaUrl0', 'data:audio/ogg;base64,' + Buffer.from(fileBuffer).toString('base64'));
    form.append('MediaContentType0', 'audio/ogg');

    const response = await request.post('/api/whatsapp/webhook', {
      multipart: form,
    });
    expect(response.status()).toBe(200);
    const body = await response.text();
    // The response should contain a <Message> element with some AI answer.
    expect(body).toContain('<Message>');
  });

  // ---------------------------------------------------------------------
  // 7️⃣ Language toggle test (new)
  // ---------------------------------------------------------------------
  test('Language toggle switches UI to Hindi', async ({ page }) => {
    await page.goto('http://localhost:3000');
    // Assume there is a language selector with data-testid="language-toggle".
    const langToggle = page.locator('[data-testid="language-toggle"]');
    await expect(langToggle).toBeVisible();
    await langToggle.click();
    // Select Hindi from the dropdown (option text "हिन्दी").
    const hindiOption = page.locator('text=हिन्दी');
    await hindiOption.click();
    // Verify that a known Hindi string appears, e.g., landing page heading.
    const heading = page.locator('text=भारतलिंक'); // assuming this is the Hindi title.
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  // ---------------------------------------------------------------------
  // 8️⃣ Simple API schema validation test (new)
  // ---------------------------------------------------------------------
  test('WhatsApp webhook rejects malformed payload', async ({ request }) => {
    // Send an empty form – missing required fields.
    const response = await request.post('/api/whatsapp/webhook', {
      multipart: new FormData(),
    });
    // The server should respond with 400 Bad Request.
    expect(response.status()).toBe(400);
  });

  // ---------------------------------------------------------------------
  // 9️⃣ PWA offline cache test (unchanged)
  // ---------------------------------------------------------------------
  test('PWA offline cache test', async ({ page, context }) => {
    await page.goto('http://localhost:3000');
    const sw = await context.serviceWorkers()[0];
    expect(sw).toBeTruthy();
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('text=Connecting every voice')).toBeVisible();
    await context.setOffline(false);
  });
  // ---------------------------------------------------------------------
  // 10️⃣ Centralised document‑extraction tests (Aadhaar, DL, PAN)
  // ---------------------------------------------------------------------

  test('Central extract Aadhaar', async ({ page }) => {
    await page.goto('http://localhost:3000/scan-form');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('public/aadhaar-sample.jpg');
    const processBtn = page.locator('button:has-text("Process"), button:has-text("Scan")');
    await processBtn.click();
    const responsePre = page.locator('pre#ocr-result');
    await expect(responsePre).toBeVisible({ timeout: 15000 });
    const raw = JSON.parse((await responsePre.textContent()) ?? '{}');
    const central = toCentralDocument(raw, 'aadhaar');
    const outPath = path.join('test-results', 'central-extracted.json');
    const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf-8')) : [];
    existing.push(central);
    fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));
    expect(central.id).toMatch(/^\d{12}$/);
    expect(central.name).not.toBe('');
  });

  test('Central extract Driver Licence', async ({ page }) => {
    await page.goto('http://localhost:3000/scan-form');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('public/driver-licence-sample.jpg');
    const processBtn = page.locator('button:has-text("Process"), button:has-text("Scan")');
    await processBtn.click();
    const responsePre = page.locator('pre#ocr-result');
    await expect(responsePre).toBeVisible({ timeout: 15000 });
    const raw = JSON.parse((await responsePre.textContent()) ?? '{}');
    const central = toCentralDocument(raw, 'dl');
    const outPath = path.join('test-results', 'central-extracted.json');
    const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf-8')) : [];
    existing.push(central);
    fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));
    expect(central.id).toMatch(/^[A-Z0-9]{10,15}$/);
    expect(central.name).not.toBe('');
  });

  test('Central extract PAN', async ({ page }) => {
    await page.goto('http://localhost:3000/scan-form');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles('public/pan-card-sample.jpg');
    const processBtn = page.locator('button:has-text("Process"), button:has-text("Scan")');
    await processBtn.click();
    const responsePre = page.locator('pre#ocr-result');
    await expect(responsePre).toBeVisible({ timeout: 15000 });
    const raw = JSON.parse((await responsePre.textContent()) ?? '{}');
    const central = toCentralDocument(raw, 'pan');
    const outPath = path.join('test-results', 'central-extracted.json');
    const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf-8')) : [];
    existing.push(central);
    fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));
    expect(central.id).toMatch(/^[A-Z]{5}[0-9]{4}[A-Z]$/);
    expect(central.name).not.toBe('');
  });

});
