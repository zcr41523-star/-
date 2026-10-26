import { test, expect } from "@playwright/test";
test("subpath assets, simulation, camera denied and background reset", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("测试环境无摄像头权限", "NotAllowedError");
    };
  });
  await page.goto("/docs/");
  await page.getByRole("button", { name: "模拟跌倒" }).click();
  await expect(page.locator("#alarm")).toHaveText("● 报警中");
  await page.getByRole("button", { name: "模拟取消" }).click();
  await expect(page.locator("#alarm")).toHaveText("● 无报警");
  await page.getByRole("button", { name: "模拟开灯" }).click();
  await expect(page.locator("#lamp")).toHaveClass("lamp on");
  await page.getByRole("button", { name: "模拟关灯" }).click();
  await expect(page.locator("#lamp")).toHaveClass("lamp");
  await expect(page.locator("#events")).toContainText("模拟操作 / 非 AI");
  await page.getByRole("button", { name: "启动摄像头" }).click();
  await expect(page.locator("#error")).toContainText("NotAllowedError");
  await expect(page.locator("#cameraStatus")).toHaveText("摄像头不可用");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#progress")).toHaveJSProperty("value", 0);
});
test("backend acknowledgment and simulation isolation", async ({ page }) => {
  await page.route("http://care.test/**", (route) => {
    const state = { alert: true, light: false, revision: 1, input_mode: "pc" };
    return route.fulfill({
      json: route.request().url().endsWith("/health")
        ? { status: "ok", input_mode: "pc" }
        : state,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("/docs/");
  await page.locator("#backendUrl").fill("http://care.test");
  await page.locator("#token").fill("test-token-at-least-16");
  await page.getByRole("button", { name: "连接后端", exact: true }).click();
  await expect(page.locator("#alarm")).toHaveText("● 报警中");
  await expect(page.getByRole("button", { name: "模拟取消" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "启动摄像头" })).toBeDisabled();
});
