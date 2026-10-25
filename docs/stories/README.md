# Story films — production notes

Short pre-made films (30–45 s) for the hero landmarks. Each script below has 4–5 scenes
of 6–8 s: a visual prompt for the video model, one narration sentence, and a label.
Narration text is taken from `src/lib/landmark-stories.ts`; keep History and Legend
labelled in the captions (`[History]` / `[Legend]` at the start of each cue).

Pipeline (one-off, not at runtime):

1. Generate one clip per scene — Veo 3.1 through the Lovable AI gateway
   (`google/veo-3.1-lite` / `veo-3.1-fast` / `veo-3.1`, job-based) or an external tool.
   No people's faces; "artistic visualisation", not a reconstruction.
2. Narration audio: `openai/gpt-4o-mini-tts` through the gateway (or any TTS), one file per film.
3. Assemble with ffmpeg: concat clips, mix narration, soft crossfades; export
   1080×1920 (portrait, mobile) and optionally 1280×720; keep each film ≤ 15 MB;
   export a poster frame and a `.vtt` captions file.
4. Upload to Supabase Storage bucket `stories` (public read):
   `stories/<landmark-id>/story.mp4`, `story.vtt`, `poster.jpg`.
5. Fill `media` for the landmark in `src/lib/landmark-stories.ts`.

Credits line shown under the player: "AI-generated visualisation (Veo 3.1). Narration based on
documented history; legends are labelled."
