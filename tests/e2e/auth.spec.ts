import { expect, test } from "@playwright/test";

test("protege el dashboard y rechaza credenciales inválidas", async ({ page }) => {
  await page.goto("/plants");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Correo electrónico", { exact: true }).first().fill("ana@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("contraseña incorrecta");
  await page.getByRole("button", { name: "Ingresar a mi jardín" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("no son correctos");
});

test("registro, confirmación, sesión persistente y cierre", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Tu nombre").fill("Lucía");
  await page.getByLabel("Correo electrónico").fill("lucia@example.test");
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("mi jardín tiene flores");
  await page.getByLabel("Repetí la contraseña").fill("mi jardín tiene flores");
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page.getByRole("status")).toContainText("Revisá tu correo");
  await page.goto("/auth/confirm?type=signup&token_hash=lucia%40example.test");
  await expect(page).toHaveURL(/\/plants$/);
  await expect(page.getByText("Hola, Lucía.", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Todo empieza con una primera planta" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mis Plantas." })).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard-empty.png", fullPage: true, caret: "initial" });
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/plants");
  await expect(page).toHaveURL(/\/login$/);
});

test("catálogo, búsqueda y diseño móvil", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico", { exact: true }).first().fill("ana@example.test");
  await page.getByLabel("Contraseña", { exact: true }).fill("mi jardín tiene hojas");
  await page.getByRole("button", { name: "Ingresar a mi jardín" }).click();
  await expect(page.getByRole("heading", { name: "Monstera del living" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lavanda del balcón" })).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard-desktop.png", fullPage: true, caret: "initial" });
  await page.getByRole("searchbox", { name: "Buscar plantas por nombre" }).fill("Monstera");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lavanda del balcón" })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/dashboard-mobile.png", fullPage: true, caret: "initial" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("recuperación y token inválido sin redirección externa", async ({ page }) => {
  await page.goto("/auth/confirm?type=signup&token_hash=invalid&next=https://evil.example");
  await expect(page).toHaveURL(/\/auth\/error$/);
  await page.goto("/forgot-password");
  await page.getByLabel("Correo electrónico").fill("ana@example.test");
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("status")).toContainText("Si el correo corresponde");
  await page.goto("/auth/confirm?type=recovery&token_hash=ana%40example.test");
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("otra frase para mi jardín");
  await page.getByLabel("Repetí la contraseña").fill("otra frase para mi jardín");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("status")).toContainText("Tu contraseña se actualizó");
});

test("login accesible en móvil y sin desbordamiento", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Qué bueno verte." })).toBeVisible();
  await page.getByLabel("Contraseña", { exact: true }).fill("mi contraseña");
  await page.getByRole("button", { name: "Mostrar contraseña" }).click();
  await expect(page.getByLabel("Contraseña", { exact: true })).toHaveAttribute("type", "text");
  await page.screenshot({ path: "test-results/login-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/login-desktop.png", fullPage: true });
});
