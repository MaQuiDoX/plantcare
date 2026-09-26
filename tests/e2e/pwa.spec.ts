import {test,expect} from "@playwright/test";
test("avisos privados, preferencias e instalación sin envíos externos",async({page,browser})=>{
  await page.goto("/login");await page.getByLabel("Correo electrónico",{exact:true}).first().fill("notify@example.test");await page.getByLabel("Contraseña",{exact:true}).fill("mi jardín tiene hojas");await page.getByRole("button",{name:"Ingresar a mi jardín"}).click();await expect(page).toHaveURL(/\/plants$/);
  await page.getByRole("link",{name:"Avisos e instalación",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Cuidados de primavera",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Activar o reconectar este dispositivo",exact:true})).toBeDisabled();
  await page.getByLabel("Revisiones de riego",{exact:true}).selectOption("off");await page.getByLabel("Hora preferida de riego",{exact:true}).fill("10:30");await page.getByRole("button",{name:"Guardar preferencias",exact:true}).click();await expect(page.getByRole("status")).toContainText("Preferencias guardadas");
  await page.reload();await expect(page.getByLabel("Revisiones de riego",{exact:true})).toHaveValue("off");await expect(page.getByLabel("Hora preferida de riego",{exact:true})).toHaveValue("10:30");
  await page.getByRole("button",{name:"Marcar como leído",exact:true}).click();await expect(page.getByText("LEÍDO",{exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:"test-results/phase6-notifications-mobile.png",fullPage:true});
  const context=await browser.newContext();const stranger=await context.newPage();await stranger.goto("/login");await stranger.getByLabel("Correo electrónico",{exact:true}).first().fill("other@example.test");await stranger.getByLabel("Contraseña",{exact:true}).fill("mi jardín tiene hojas");await stranger.getByRole("button",{name:"Ingresar a mi jardín"}).click();await expect(stranger).toHaveURL(/\/plants$/);await stranger.goto("/plants/notifications");await expect(stranger.getByRole("heading",{name:"Cuidados de primavera",exact:true})).toHaveCount(0);await context.close();
});
test("manifest, iconos y pantalla offline sin cachear datos privados",async({page,context,request})=>{
  const manifest=await (await request.get("/manifest.webmanifest")).json();expect(manifest).toMatchObject({name:"PlantCare · Tu pequeño mundo verde",display:"standalone",start_url:"/plants"});
  for(const icon of manifest.icons)expect((await request.get(icon.src)).status()).toBe(200);
  expect((await request.get("/api/jobs/notifications")).status()).toBe(401);
  expect(await (await request.get("/api/jobs/notifications",{headers:{Authorization:"Bearer local-e2e-only-secret-longer-than-32-characters"}})).json()).toEqual({enabled:false});
  await page.goto("/login");await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const cachePaths=await page.evaluate(async()=>{const result:string[]=[];for(const name of await caches.keys()){const cache=await caches.open(name);for(const req of await cache.keys())result.push(new URL(req.url).pathname);}return result;});
  expect(cachePaths).toContain("/offline.html");expect(cachePaths.every(path=>path==="/offline.html"||path.startsWith("/icons/"))).toBe(true);
  await context.setOffline(true);await page.goto("/plants?offline-test=1");await expect(page.getByRole("heading",{name:"Tu jardín te espera",exact:true})).toBeVisible();await expect(page.getByText("Los datos privados no se guardan",{exact:false})).toBeVisible();
  await context.setOffline(false);await page.getByRole("link",{name:"Volver a intentar",exact:true}).click();await expect(page).toHaveURL(/\/login$/);
});
