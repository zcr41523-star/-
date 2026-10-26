// 可选的真实运行时集成检查：使用合成摄像头，不能作为真人识别实验。
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.CARE_DEMO_URL || "http://127.0.0.1:8000");
  await page.getByRole("button", { name: "启动摄像头" }).click();
  await page.waitForFunction(
    () =>
      document.getElementById("cameraStatus").textContent ===
        "实时 AI 识别中" || document.getElementById("error").textContent,
    {},
    { timeout: 120000 },
  );
  const error = await page.locator("#error").textContent();
  if (error) throw Error(error);
  await page.waitForTimeout(2000);
  console.log(
    "真实 JS/WASM/模型初始化与合成视频推理：",
    await page.locator("#gesture").textContent(),
    await page.locator("#score").textContent(),
  );
  await page.getByRole("button", { name: "停止", exact: true }).click();
  if ((await page.locator("#progress").evaluate((el) => el.value)) !== 0)
    throw Error("停止后未重置");
  await page.setViewportSize({ width: 390, height: 844 });
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    )
  )
    throw Error("手机视口横向溢出");
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "停止重置、390px 布局与未捕获异常检查通过；不代表真实手部识别效果。",
  );
} finally {
  await browser.close();
}
