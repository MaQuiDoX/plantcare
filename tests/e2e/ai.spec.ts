import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email = "ai@example.test") {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico", { exact: true }).first().fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("mi jardín tiene hojas");
  await page.getByRole("button", { name: "Ingresar a mi jardín" }).click();
  await expect(page).toHaveURL(/\/plants$/);
}
test("IA sin claves muestra configuración y permite revisar y confirmar resultados privados guardados", async ({ page, browser }) => {
  await login(page);
  await page.getByRole("link", { name: "Identificar por foto" }).click();
  await expect(page.getByRole("heading", { name: "La IA todavía no está configurada" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Analizar foto", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Ver mi historial de análisis" }).click();
  await page.getByRole("link", { name: "Identificación de especie", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Monstera deliciosa", exact: true })).toBeVisible();
  await expect(page.getByText("Comprobar humedad antes de regar.", { exact: true })).toBeVisible();
  const analysisUrl = page.url();
  await page.screenshot({ path: "test-results/phase4-identification-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/phase4-identification-mobile.png", fullPage: true });
  const privateContext = await browser.newContext();
  const stranger = await privateContext.newPage();
  await login(stranger, "other@example.test");
  await stranger.goto(analysisUrl);
  await expect(stranger.getByRole("heading", { name: "Por acá todavía no crece nada." })).toBeVisible();
  await privateContext.close();
  await page.getByLabel("Nombre para tu nueva planta").fill("Monstera de Luz");
  await page.getByRole("button", { name: "Crear planta con esta especie" }).click();
  await expect(page.getByRole("heading", { name: "Monstera de Luz", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cuidados de Monstera deliciosa" })).toBeVisible();
  await page.goto(analysisUrl);
  await expect(page.getByText("Ya confirmaste una especie de este análisis.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear planta con esta especie" })).toHaveCount(0);
});
test("diagnóstico presenta hipótesis y comprobaciones sin modificar la ficha", async ({ page }) => {
  await login(page);
  await page.goto("/plants/analyses/c7157311-ace0-4a59-9200-000000000031");
  await expect(page.getByRole("heading", { name: "Qué podría estar pasando" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Posible exceso de agua" })).toBeVisible();
  await expect(page.getByText("Aparecieron hojas amarillas.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirmar|Crear planta/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Volver a Poto de Luz" }).click();
  await expect(page.getByText("Especie sin identificar", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Revisar salud", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Revisar su salud" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "La IA todavía no está configurada" })).toBeVisible();
});
