import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const appUrl = process.env.SOCIAL_APP_URL || "https://proofodds.vercel.app";
const outputDir = resolve("docs/media/social");

const screenshot = (page, name) => page.screenshot({
  path: resolve(outputDir, name),
  type: "png",
});

const installSocialStyles = (page) => page.addStyleTag({ content: `
  #social-scene {
    position: fixed;
    inset: 0;
    z-index: 100000;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 76px 92px;
    color: #f7faf8;
    background: rgba(8, 15, 18, .96);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }
  #social-scene .brand {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 54px;
    font-size: 24px;
    font-weight: 850;
  }
  #social-scene .mark {
    display: grid;
    width: 42px;
    height: 42px;
    place-items: center;
    border: 2px solid #0b130f;
    border-radius: 7px;
    color: #111512;
    background: #a8ef37;
    font-size: 22px;
  }
  #social-scene .eyebrow {
    margin-bottom: 18px;
    color: #a8ef37;
    font-size: 18px;
    font-weight: 800;
    text-transform: uppercase;
  }
  #social-scene h1 {
    max-width: 1180px;
    margin: 0;
    font-size: 76px;
    line-height: 1.03;
    letter-spacing: 0;
  }
  #social-scene .lede {
    max-width: 1060px;
    margin: 24px 0 0;
    color: #c7d2cd;
    font-size: 27px;
    line-height: 1.45;
  }
  #social-scene .pipeline {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-top: 44px;
    font-size: 17px;
    font-weight: 750;
  }
  #social-scene .pipeline span {
    padding: 12px 15px;
    border: 1px solid #53615b;
    border-radius: 5px;
    background: #111d1a;
  }
  #social-scene .pipeline b { color: #a8ef37; }
  #social-scene .logic-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-top: 42px;
  }
  #social-scene .logic-item {
    min-height: 198px;
    padding: 28px;
    border: 1px solid #53615b;
    border-radius: 7px;
    background: #111d1a;
  }
  #social-scene .logic-item b {
    display: block;
    margin-bottom: 17px;
    font-size: 31px;
  }
  #social-scene .logic-item p {
    margin: 0;
    color: #becac5;
    font-size: 21px;
    line-height: 1.42;
  }
  #social-scene .settle b { color: #71e1ae; }
  #social-scene .dispute b { color: #ff8f7d; }
  #social-scene .hold b { color: #f6d46b; }
  #social-scene .footnote {
    margin-top: 32px;
    color: #91a099;
    font: 700 17px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  }
` });

const showScene = (page, scene) => page.evaluate((sceneName) => {
  document.getElementById("social-scene")?.remove();
  const element = document.createElement("section");
  element.id = "social-scene";
  if (sceneName === "cover") {
    element.innerHTML = `
      <div class="brand"><span class="mark">✓</span>ProofOdds</div>
      <div class="eyebrow">TxODDS World Cup Hackathon / Prediction Markets & Settlement</div>
      <h1>Markets should settle on proof.</h1>
      <p class="lede">Verifiable soccer resolution from ordered TxLINE events to Solana validation to a portable deterministic receipt.</p>
      <div class="pipeline"><span>TxLINE feed</span><b>→</b><span>Merkle proof</span><b>→</b><span>Solana simulation</span><b>→</b><span>SETTLE / DISPUTE / HOLD</span></div>`;
  } else {
    element.innerHTML = `
      <div class="eyebrow">Deterministic resolution engine</div>
      <h1>One verified result. Three explicit outcomes.</h1>
      <div class="logic-grid">
        <div class="logic-item settle"><b>SETTLE</b><p>Final record, proof passed, and the proposal matches the proven outcome.</p></div>
        <div class="logic-item dispute"><b>DISPUTE</b><p>Final record and proof passed, but the proposal conflicts with the proven outcome.</p></div>
        <div class="logic-item hold"><b>HOLD</b><p>The match is not final or cryptographic verification did not pass.</p></div>
      </div>
      <div class="footnote">TxLINE event tape · validateStatV2 · stable JSON receipt ID</div>`;
  }
  document.body.appendChild(element);
}, scene);

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await installSocialStyles(page);

  await showScene(page, "cover");
  await screenshot(page, "01-proofodds-cover.png");
  await page.evaluate(() => document.getElementById("social-scene")?.remove());

  const live = (await page.locator(".source-status").innerText()).includes("TxLINE connected");
  if (live) {
    await page.locator(".fixture-row", { hasText: "#18257865" }).click();
    await page.getByText("game finalised").waitFor({ timeout: 8000 });
  }

  await page.locator(".proposal-control button").nth(live ? 2 : 1).click();
  await page.getByRole("button", { name: "Verify and resolve" }).click();
  await page.getByText(live ? "SETTLE" : "REFERENCE MATCH", { exact: true }).waitFor({ timeout: 15000 });
  await page.locator(".resolution-panel").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.locator(".receipt-panel").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await screenshot(page, "02-proofodds-settle.png");

  await page.locator(".receipt-panel").evaluate((element) => { element.scrollTop = 0; });
  await page.locator(".resolution-panel").evaluate((element) => { element.scrollTop = 0; });
  await page.locator(".proposal-control button").nth(0).click();
  await page.getByRole("button", { name: "Verify and resolve" }).click();
  await page.getByText(live ? "DISPUTE" : "REFERENCE CONFLICT", { exact: true }).waitFor({ timeout: 15000 });
  await page.locator(".resolution-panel").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.locator(".receipt-panel").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await screenshot(page, "03-proofodds-dispute.png");

  await showScene(page, "logic");
  await screenshot(page, "04-proofodds-logic.png");
  await context.close();
} finally {
  await browser.close();
}

console.log(`Social assets: ${outputDir}`);
