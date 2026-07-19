import { spawn } from "node:child_process";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "playwright";

const appUrl = process.env.DEMO_APP_URL || "http://127.0.0.1:4173";
const outputDir = resolve("docs/media");
const publicDir = resolve("public");
const tempDir = resolve("tmp/demo-video");
const voiceDir = join(tempDir, "voice");
const rawVideo = join(tempDir, "proofodds.raw.webm");
const narration = join(tempDir, "proofodds-narration.wav");
const concatList = join(tempDir, "voice-list.txt");
const finalVideo = join(outputDir, "proofodds-demo.mp4");
const finalSubtitles = join(outputDir, "proofodds-demo.srt");
const publicVideo = join(publicDir, "proofodds-demo.mp4");
const publicSubtitles = join(publicDir, "proofodds-demo.srt");
const edgePython = resolve("../agentpay-firewall/tmp/edge-tts-venv/bin/python");
const voice = process.env.DEMO_TTS_VOICE || "en-US-AndrewMultilingualNeural";

const segments = [
  {
    minDuration: 7,
    voiceover: "A World Cup market should not settle because one API returned a score. It should settle because the result is reproducible.",
  },
  {
    minDuration: 10,
    voiceover: "ProofOdds is a deterministic resolution workbench for analysts and prediction-market operators, built around TxLINE fixture and score feeds.",
  },
  {
    minDuration: 12,
    voiceover: "For reproducibility after matches end, I use historical replay while staying connected to the live TxLINE API. Ordered events reconstruct the match through the final four-six score.",
  },
  {
    minDuration: 13,
    voiceover: "I propose Participant Two and run verification. ProofOdds selects final sequence eleven ninety-five, derives the outcome, and validates score keys one and two.",
  },
  {
    minDuration: 13,
    voiceover: "The Solana simulation passes and the proposal settles. The audit receipt exposes source, payload hash, proof depths, root account, program ID, and compute units.",
  },
  {
    minDuration: 21,
    voiceover: "Now I submit Participant One for the same proof. The engine does not rubber-stamp it. The proven Participant Two win conflicts with the proposal, so ProofOdds returns dispute. The receipt stays Solana verified; only the deterministic market decision changes.",
  },
  {
    minDuration: 16,
    voiceover: "The resolution state machine is small and testable. Final plus verified plus matching means settle. A verified mismatch means dispute. Missing finality or failed proof means hold.",
  },
  {
    minDuration: 18,
    voiceover: "The live path calls TxLINE fixture, score, and stat-validation endpoints, then simulates validate Stat V two against the official devnet program. No private key is required and no wagering funds are handled.",
  },
  {
    minDuration: 9,
    voiceover: "ProofOdds makes soccer settlement understandable to users, deterministic for engineers, and auditable for market operators.",
  },
];

const pause = (milliseconds) => new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));

const run = (command, args, options = {}) => new Promise((resolveRun, rejectRun) => {
  const child = spawn(command, args, {
    cwd: resolve("."),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
  child.on("error", rejectRun);
  child.on("close", (code) => {
    if (code === 0) resolveRun({ stdout, stderr });
    else rejectRun(new Error(`${command} failed with code ${code}\n${stdout}\n${stderr}`));
  });
});

const probeDuration = async (filePath) => {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", filePath,
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Invalid audio: ${filePath}`);
  return duration;
};

const synthesize = async (textPath, audioPath) => {
  try {
    await run(edgePython, [
      "-m", "edge_tts", "--voice", voice, "--rate", "-2%", "--file", textPath,
      "--write-media", audioPath,
    ]);
  } catch {
    const fallback = audioPath.replace(/\.mp3$/, ".aiff");
    await run("say", ["-v", "Evan", "-r", "165", "-f", textPath, "-o", fallback]);
    return fallback;
  }
  return audioPath;
};

const prepareNarration = async () => {
  const timed = [];
  await mkdir(voiceDir, { recursive: true });
  for (const [index, segment] of segments.entries()) {
    const key = String(index + 1).padStart(2, "0");
    const textPath = join(voiceDir, `${key}.txt`);
    const mediaPath = join(voiceDir, `${key}.mp3`);
    const paddedPath = join(voiceDir, `${key}.wav`);
    await writeFile(textPath, `${segment.voiceover}\n`);
    const sourcePath = await synthesize(textPath, mediaPath);
    const audioDuration = await probeDuration(sourcePath);
    const duration = Number(Math.max(segment.minDuration, audioDuration + 0.55).toFixed(3));
    await run("ffmpeg", [
      "-y", "-i", sourcePath,
      "-af", `apad=pad_dur=${Math.max(0, duration - audioDuration).toFixed(3)},atrim=0:${duration},asetpts=N/SR/TB`,
      "-ar", "48000", "-ac", "1", paddedPath,
    ]);
    timed.push({ ...segment, duration, paddedPath });
  }
  await writeFile(concatList, `${timed.map((segment) => `file '${segment.paddedPath.replaceAll("'", "'\\''")}'`).join("\n")}\n`);
  await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concatList, "-c:a", "pcm_s16le", narration]);
  return timed;
};

const srtTime = (seconds) => {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
};

const buildSrt = (timed) => {
  let cursor = 0;
  return `${timed.map((segment, index) => {
    const start = cursor;
    cursor += segment.duration;
    return `${index + 1}\n${srtTime(start)} --> ${srtTime(cursor)}\n${segment.voiceover}\n`;
  }).join("\n")}\n`;
};

const reachable = async () => {
  try {
    const response = await fetch(appUrl, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
};

const ensureApp = async () => {
  if (await reachable()) return () => {};
  const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1"], {
    cwd: resolve("."), env: { ...process.env, BROWSER: "none" }, stdio: "ignore",
  });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await reachable()) return () => child.kill("SIGTERM");
    await pause(500);
  }
  child.kill("SIGTERM");
  throw new Error(`Could not reach ${appUrl}`);
};

const installSceneStyles = async (page) => page.addStyleTag({ content: `
  #demo-caption { position: fixed; left: 50%; bottom: 28px; z-index: 100001; width: min(1180px, calc(100vw - 80px)); transform: translateX(-50%); box-sizing: border-box; padding: 13px 18px; border: 1px solid rgba(255,255,255,.38); border-radius: 6px; color: #fff; background: rgba(6, 12, 15, .9); font: 700 20px/1.35 Inter, ui-sans-serif, system-ui, sans-serif; text-align: center; }
  #demo-caption.top { left: 320px; right: 390px; top: 76px; bottom: auto; width: auto; transform: none; }
  .resolution-panel::after { content: ""; display: block; height: 130px; }
  #demo-scene { position: fixed; inset: 0; z-index: 100000; display: flex; flex-direction: column; justify-content: center; padding: 72px 92px; box-sizing: border-box; color: #f7faf8; background: rgba(8, 15, 18, .94); font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  #demo-scene .eyebrow { color: #71e1ae; font-size: 18px; font-weight: 800; text-transform: uppercase; }
  #demo-scene h1 { max-width: 1100px; margin: 18px 0 20px; font-size: 68px; line-height: 1.02; letter-spacing: 0; }
  #demo-scene p { max-width: 920px; margin: 0; color: #c9d5d0; font-size: 26px; line-height: 1.45; }
  #demo-scene .logic-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 34px; }
  #demo-scene .logic-item { min-height: 155px; padding: 24px; border: 1px solid #60706a; border-radius: 7px; background: #111d1a; }
  #demo-scene .logic-item b { display: block; margin-bottom: 12px; font-size: 28px; }
  #demo-scene .logic-item span { color: #b9c7c1; font-size: 19px; line-height: 1.42; }
  #demo-scene .logic-item.settle b { color: #71e1ae; }
  #demo-scene .logic-item.dispute b { color: #ff8f7d; }
  #demo-scene .logic-item.hold b { color: #f6d46b; }
  #demo-scene .integration { display: grid; grid-template-columns: 1.2fr .8fr; gap: 40px; align-items: center; }
  #demo-scene .stack { display: grid; gap: 12px; }
  #demo-scene .stack div { padding: 17px 20px; border-left: 4px solid #71e1ae; background: #111d1a; font: 700 20px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; }
  #demo-scene code { color: #a8f2d1; }
` });

const showScene = async (page, kind) => page.evaluate((sceneKind) => {
  document.getElementById("demo-scene")?.remove();
  const scene = document.createElement("section");
  scene.id = "demo-scene";
  if (sceneKind === "intro") {
    scene.innerHTML = `<span class="eyebrow">ProofOdds / TxLINE World Cup track</span><h1>What proves a market outcome?</h1><p>Deterministic soccer resolution from ordered data, verifiable proofs, and portable receipts.</p>`;
  } else if (sceneKind === "logic") {
    scene.innerHTML = `<span class="eyebrow">Deterministic state machine</span><h1>Same evidence. Same decision.</h1><div class="logic-grid"><div class="logic-item settle"><b>SETTLE</b><span>Final + proof passed + proposal matches outcome</span></div><div class="logic-item dispute"><b>DISPUTE</b><span>Final + proof passed + proposal conflicts with outcome</span></div><div class="logic-item hold"><b>HOLD</b><span>Not final or cryptographic verification failed</span></div></div>`;
  } else if (sceneKind === "integration") {
    scene.innerHTML = `<div class="integration"><div><span class="eyebrow">Live verifier active</span><h1>TxLINE data. Solana proof. One receipt.</h1><p>The production deployment uses official validation payloads and a read-only simulation. Clearly labeled reference mode remains available only as a judging fallback.</p></div><div class="stack"><div>GET <code>/fixtures/snapshot</code></div><div>GET <code>/scores/stat-validation</code></div><div>Solana <code>validateStatV2</code></div><div>JSON <code>SettlementReceipt</code></div></div></div>`;
  } else {
    scene.innerHTML = `<span class="eyebrow">ProofOdds</span><h1>Reproducible outcomes for soccer markets.</h1><p>Built for the TxODDS World Cup track.</p>`;
  }
  document.body.appendChild(scene);
}, kind);

const hideScene = async (page) => page.evaluate(() => document.getElementById("demo-scene")?.remove());

const showCaption = async (page, text) => page.evaluate((captionText) => {
  let caption = document.getElementById("demo-caption");
  if (!caption) {
    caption = document.createElement("div");
    caption.id = "demo-caption";
    document.body.appendChild(caption);
  }
  caption.classList.remove("top");
  caption.textContent = captionText;
}, text);

const moveCaptionToTop = async (page) => page.evaluate(() => {
  document.getElementById("demo-caption")?.classList.add("top");
});

const step = async (page, timed, index, action) => {
  const started = Date.now();
  await showCaption(page, timed[index].voiceover);
  if (action) await action();
  const remaining = timed[index].duration * 1000 - (Date.now() - started);
  if (remaining > 0) await pause(remaining);
};

const record = async (timed) => {
  const stopApp = await ensureApp();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      recordVideo: { dir: tempDir, size: { width: 1600, height: 900 } },
    });
    const page = await context.newPage();
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await installSceneStyles(page);
    const live = (await page.locator(".source-status").innerText()).includes("TxLINE connected");

    await step(page, timed, 0, () => showScene(page, "intro"));
    await step(page, timed, 1, () => hideScene(page));
    await step(page, timed, 2, async () => {
      if (live) {
        await page.locator(".fixture-row", { hasText: "#18257865" }).click();
        await page.getByText("game finalised").waitFor({ timeout: 8000 });
      }
      await page.locator(".event-tape").scrollIntoViewIfNeeded();
    });
    await step(page, timed, 3, async () => {
      await page.locator(".proposal-control button").nth(live ? 2 : 1).click();
      await page.getByRole("button", { name: "Verify and resolve" }).click();
      await page.getByText(live ? "SETTLE" : "REFERENCE MATCH", { exact: true }).waitFor({ timeout: 15000 });
      await page.locator(".resolution-panel").evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await moveCaptionToTop(page);
    });
    await step(page, timed, 4, async () => {
      await page.locator(".receipt-panel").evaluate((element) => { element.scrollTop = element.scrollHeight; });
    });
    await step(page, timed, 5, async () => {
      await page.locator(".receipt-panel").evaluate((element) => { element.scrollTop = 0; });
      await page.locator(".resolution-panel").evaluate((element) => { element.scrollTop = 0; });
      await page.locator(".proposal-control button").nth(0).click();
      await page.getByRole("button", { name: "Verify and resolve" }).click();
      await page.getByText(live ? "DISPUTE" : "REFERENCE CONFLICT", { exact: true }).waitFor({ timeout: 15000 });
      await page.locator(".resolution-panel").evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await moveCaptionToTop(page);
    });
    await step(page, timed, 6, () => showScene(page, "logic"));
    await step(page, timed, 7, () => showScene(page, "integration"));
    await step(page, timed, 8, () => showScene(page, "outro"));

    const video = page.video();
    await context.close();
    if (!video) throw new Error("Playwright did not create a video");
    await copyFile(await video.path(), rawVideo);
  } finally {
    await browser?.close();
    stopApp();
  }
};

await rm(tempDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await mkdir(publicDir, { recursive: true });
await mkdir(tempDir, { recursive: true });

const timed = await prepareNarration();
const duration = timed.reduce((total, segment) => total + segment.duration, 0);
await writeFile(finalSubtitles, buildSrt(timed));
await copyFile(finalSubtitles, publicSubtitles);
await record(timed);

const videoCodecArgs = process.platform === "darwin"
  ? ["-c:v", "h264_videotoolbox", "-b:v", "3500k", "-maxrate", "5000k", "-profile:v", "high"]
  : ["-c:v", "libx264", "-preset", "fast", "-crf", "18"];

await run("ffmpeg", [
  "-y", "-i", rawVideo, "-i", narration,
  "-vf", "fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=12",
  "-t", duration.toFixed(3), "-map", "0:v:0", "-map", "1:a:0",
  "-af", "loudnorm=I=-16:TP=-1.5:LRA=9", ...videoCodecArgs,
  "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", finalVideo,
]);
await copyFile(finalVideo, publicVideo);

console.log(`Video: ${finalVideo}`);
console.log(`Subtitles: ${finalSubtitles}`);
console.log(`Duration: ${duration.toFixed(1)} seconds`);
