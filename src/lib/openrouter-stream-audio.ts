/**
 * Collect base64 audio from OpenRouter chat completions SSE
 * (modalities text + audio, stream: true).
 */

export async function collectStreamingAudioBase64(
  response: Response,
): Promise<{ audioB64: string; transcript: string }> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  const audioChunks: string[] = [];
  const transcriptChunks: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice("data: ".length).trim();
      if (data === "[DONE]") continue;
      try {
        const chunk = JSON.parse(data) as {
          choices?: Array<{
            delta?: {
              audio?: { data?: string; transcript?: string };
            };
          }>;
        };
        const audio = chunk.choices?.[0]?.delta?.audio;
        if (audio?.data) audioChunks.push(audio.data);
        if (audio?.transcript) transcriptChunks.push(audio.transcript);
      } catch {
        /* ignore malformed chunk */
      }
    }
  }

  return {
    audioB64: audioChunks.join(""),
    transcript: transcriptChunks.join(""),
  };
}
