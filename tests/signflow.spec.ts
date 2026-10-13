import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
async function login(page: import("@playwright/test").Page) {
  const credentials = JSON.parse(
    await readFile(join(tmpdir(), "signflow-e2e-credentials.json"), "utf8"),
  );
  await page.goto("/login");
  await page.getByLabel("Login").fill(credentials.login);
  await page.getByLabel("Senha", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
}
test("funcionário cria, cliente assina e funcionário confere e recupera o PDF", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Clientes", exact: true }).click();
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  await page
    .getByLabel("Nome ou razão social")
    .fill("Cliente do teste de fluxo");
  await page.getByLabel("CPF/CNPJ").fill("52998224725");
  await page.getByLabel("Código interno").fill("E2E-01");
  await page.getByLabel("WhatsApp", { exact: true }).fill("5511999999999");
  await page.getByRole("button", { name: "Salvar cliente" }).click();
  await expect(
    page.getByText("Cliente do teste de fluxo", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Modelos", exact: true }).click();
  await page.getByRole("link", { name: "Criar modelo", exact: true }).click();
  await page.getByLabel("Nome do modelo").fill("Autorização E2E");
  const pdf = await PDFDocument.create();
  const p = pdf.addPage([595, 842]);
  p.drawText("Autorizacao de manutencao", { x: 40, y: 780 });
  pdf.addPage([595, 842]);
  await page.getByLabel("PDF original").setInputFiles({
    name: "autorizacao.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await expect(
    page.getByRole("button", { name: "Assinatura", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Assinatura", exact: true }).click();
  await page.getByRole("button", { name: "Texto", exact: true }).click();
  await page.getByLabel("Rótulo", { exact: true }).fill("Descrição informada");
  await page.getByLabel("Posição Y (%)").fill("35");
  await page.getByRole("button", { name: "Publicar versão" }).click();
  await expect(
    page.getByRole("heading", { name: "Autorização E2E" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Documentos", exact: true }).click();
  await page
    .getByRole("link", { name: "Nova solicitação", exact: true })
    .click();
  await page
    .getByLabel("Modelo publicado")
    .selectOption({ label: "Autorização E2E · v1" });
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption({ label: "Cliente do teste de fluxo · E2E-01" });
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByLabel("Nome do signatário esperado")
    .fill("Cliente do teste de fluxo");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Autorização do chamado E2E");
  await page.getByLabel("Número do chamado").fill("CH-123");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator(".pdf-page")).toHaveCount(2);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar e gerar link" }).click();
  await expect(
    page.getByRole("button", { name: "Copiar link", exact: true }),
  ).toBeVisible();
  const link = await page.locator(".link-box").innerText();
  const requestId = page.url().split("/").pop()!;
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copiar link", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  const wa = await page
    .getByRole("link", { name: "Enviar pelo WhatsApp" })
    .getAttribute("href");
  expect(wa).toContain("wa.me/5511999999999");
  expect(wa).toContain(encodeURIComponent(link));
  const publicContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const customer = await publicContext.newPage();
  await customer.goto(link);
  await expect(
    customer.getByRole("heading", { name: "Autorização do chamado E2E" }),
  ).toBeVisible();
  await expect(customer.locator(".pdf-page")).toHaveCount(2);
  await customer
    .getByLabel("Nome completo declarado")
    .fill("Cliente do teste de fluxo");
  await customer
    .getByLabel("Descrição informada *")
    .fill("Autorizo a manutenção");
  const box = await customer.locator("canvas.signature-canvas").boundingBox();
  if (!box) throw new Error("Canvas não visível");
  await customer.locator("canvas.signature-canvas").scrollIntoViewIfNeeded();
  const b = (await customer.locator("canvas.signature-canvas").boundingBox())!;
  await customer.mouse.move(b.x + 30, b.y + 70);
  await customer.mouse.down();
  for (let i = 0; i < 90; i++)
    await customer.mouse.move(
      b.x + 30 + i * 2,
      b.y + 70 + Math.sin(i / 6) * 18,
    );
  await customer.mouse.up();
  await customer.getByRole("button", { name: "Revisar documento" }).click();
  await expect(
    customer.getByRole("heading", { name: "Revise o documento preenchido" }),
  ).toBeVisible();
  await expect(
    customer.getByRole("button", { name: "Confirmar assinatura" }),
  ).toBeDisabled();
  await customer.getByRole("checkbox").check();
  await customer.getByRole("button", { name: "Confirmar assinatura" }).click();
  await expect(
    customer.getByRole("heading", { name: "Documento assinado", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  const final = await customer.request.get(
    `/api/public/sign/${link.split("/").pop()}/signed`,
  );
  expect(final.status()).toBe(200);
  expect((await PDFDocument.load(await final.body())).getPageCount()).toBe(3);
  await page.reload();
  await page.getByRole("button", { name: "Conferência", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dados informados" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dados conferem" }).click();
  await expect(
    page.locator(".page-head").getByText("Conferido", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Evidências", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Baixar pacote de evidências" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Documento", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Baixar assinado" }),
  ).toBeVisible();
  await page.goto(`/documentos/${requestId}`);
  await expect(
    page.getByRole("heading", { name: "Autorização do chamado E2E" }),
  ).toBeVisible();
  await publicContext.close();
});
test("portal público não lista clientes e bloqueia envio sem origem/CSRF", async ({
  request,
}) => {
  const r = await request.get("/api/clients");
  expect(r.status()).toBe(401);
  const change = await request.post("/api/clients", {
    data: { name: "Invasão" },
  });
  expect(change.status()).toBe(403);
});
test("verificação pública expõe somente informações mínimas e tema funciona no celular", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/verificar");
  await page.getByLabel("Identificador da solicitação").fill(randomUUID());
  await page.getByRole("button", { name: "Verificar", exact: true }).click();
  await expect(
    page.getByText("Não há documento final registrado para este identificador"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: join(tmpdir(), "signflow-verification-mobile.png"),
    fullPage: true,
  });
});
test("editor normaliza arraste e redimensionamento em documento multipágina", async ({
  page,
}) => {
  await login(page);
  await page.goto("/modelos/novo");
  await page.getByLabel("Nome do modelo").fill("Editor multipágina");
  const pdf = await PDFDocument.create();
  pdf.addPage();
  pdf.addPage();
  await page.getByLabel("PDF original").setInputFiles({
    name: "editor.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await page.getByRole("button", { name: "Assinatura", exact: true }).click();
  const f = page.locator(".pdf-field").first();
  await expect(f).toBeVisible();
  const before = await page.getByLabel("Posição X (%)").inputValue();
  const box = (await f.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 45, box.y + 35, { steps: 8 });
  await page.mouse.up();
  expect(await page.getByLabel("Posição X (%)").inputValue()).not.toBe(before);
  const size = await page.getByLabel("Largura (%)").inputValue();
  await f.locator(".resize").scrollIntoViewIfNeeded();
  const r = (await f.locator(".resize").boundingBox())!;
  await page.mouse.move(r.x + 4, r.y + 4);
  await page.mouse.down();
  await page.mouse.move(r.x + 24, r.y + 14, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByLabel("Largura (%)")).not.toHaveValue(size);
  await page
    .getByRole("combobox", { name: "Página", exact: true })
    .selectOption("1");
  await page.getByRole("button", { name: "Texto", exact: true }).click();
  expect(await page.locator(".pdf-field").count()).toBe(1);
  await page.screenshot({
    path: join(tmpdir(), "signflow-editor.png"),
    fullPage: true,
  });
});

test("administrador cadastra auditor e API bloqueia escrita desse perfil", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Funcionários", exact: true }).click();
  await page.getByRole("button", { name: "Cadastrar funcionário" }).click();
  const password = "Test-" + randomUUID();
  await page.getByLabel("Nome", { exact: true }).fill("Auditor de teste");
  await page.getByLabel("Login").fill("auditor-e2e");
  await page.getByLabel("Senha inicial").fill(password);
  await page
    .getByRole("combobox", { name: "Perfil", exact: true })
    .selectOption("auditor");
  await page.getByRole("button", { name: "Salvar acesso" }).click();
  await expect(page.getByText("auditor-e2e", { exact: true })).toBeVisible();
  const ctx = await browser.newContext(),
    auditor = await ctx.newPage();
  await auditor.goto("/login");
  await auditor.getByLabel("Login").fill("auditor-e2e");
  await auditor.getByLabel("Senha", { exact: true }).fill(password);
  await auditor.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    auditor.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await expect(
    auditor.getByRole("link", { name: "Nova solicitação", exact: true }),
  ).toHaveCount(0);
  await auditor.getByRole("link", { name: "Auditoria", exact: true }).click();
  await auditor.getByRole("button", { name: "Verificar integridade" }).click();
  await expect(auditor.getByText(/Cadeia íntegra:/)).toBeVisible();
  const status = await auditor.evaluate(async () => {
    const csrf = document.cookie
      .split("; ")
      .find((c) => c.startsWith("sf_csrf="))!
      .split("=")[1];
    const r = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: JSON.stringify({ name: "Bloqueado" }),
    });
    return r.status;
  });
  expect(status).toBe(403);
  await ctx.close();
});

test("PDF avulso gera solicitação cancelável e não aparece como modelo reutilizável", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/documentos/novo");
  await page.getByRole("button", { name: "PDF avulso", exact: true }).click();
  await page.getByLabel("Nome do modelo").fill("Avulso E2E");
  const pdf = await PDFDocument.create();
  pdf.addPage();
  await page.getByLabel("PDF original").setInputFiles({
    name: "avulso.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await page.getByRole("button", { name: "Assinatura", exact: true }).click();
  await page.getByRole("button", { name: "Publicar versão" }).click();
  await expect(
    page.getByText(
      "Documento configurado e versão congelada para esta solicitação.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Cliente", exact: true })
    .selectOption({ label: "Cliente do teste de fluxo · E2E-01" });
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page
    .getByLabel("Título", { exact: true })
    .fill("Autorização avulsa E2E");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator(".pdf-page")).toHaveCount(1);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar e gerar link" }).click();
  await expect(
    page.getByRole("button", { name: "Copiar link", exact: true }),
  ).toBeVisible();
  const link = await page.locator(".link-box").innerText();
  await page
    .getByRole("button", { name: "Cancelar solicitação", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.locator(".page-head").getByText("Cancelado", { exact: true }),
  ).toBeVisible();
  const ctx = await browser.newContext(),
    customer = await ctx.newPage();
  await customer.goto(link);
  await expect(
    customer.getByText("Link revogado", { exact: true }),
  ).toBeVisible();
  await ctx.close();
  await page.goto("/modelos");
  await expect(page.getByText("Avulso E2E", { exact: true })).toHaveCount(0);
});

test("cadastro com nome, login e senha de 9 caracteres permite entrar sem e-mail", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Criar cadastro", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Crie sua conta" }),
  ).toBeVisible();
  const loginName = "signup-" + randomUUID().slice(0, 8);
  await page.getByLabel("Nome", { exact: true }).fill("Funcionário cadastrado");
  await page.getByLabel("Login", { exact: true }).fill(loginName);
  await page.getByLabel("Senha", { exact: true }).fill("12345678");
  expect(
    await page
      .getByLabel("Senha", { exact: true })
      .evaluate((input: HTMLInputElement) => input.validity.tooShort),
  ).toBe(true);
  await page.getByLabel("Senha", { exact: true }).fill("123456789");
  await page
    .getByRole("button", { name: "Criar cadastro", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cadastro concluído" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Ir para o login" }).click();
  await page.getByLabel("Login", { exact: true }).fill(loginName);
  await page.getByLabel("Senha", { exact: true }).fill("123456789");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Funcionários", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("banner")
      .getByText("Funcionário cadastrado", { exact: true }),
  ).toBeVisible();
});

test("administrador edita configurações e funcionário recebe explicação de somente leitura", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  const company = page.getByLabel("Nome da empresa", { exact: true });
  await expect(company).toBeEnabled();
  await company.fill("Empresa de teste configurada");
  await page
    .getByRole("button", { name: "Salvar configurações", exact: true })
    .click();
  await expect(
    page.getByText("Configurações salvas", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(company).toHaveValue("Empresa de teste configurada");
  const ctx = await browser.newContext(),
    employee = await ctx.newPage();
  const username = "settings-" + randomUUID().slice(0, 8);
  await employee.goto("/cadastro");
  await employee
    .getByLabel("Nome", { exact: true })
    .fill("Funcionário de configurações");
  await employee.getByLabel("Login", { exact: true }).fill(username);
  await employee.getByLabel("Senha", { exact: true }).fill("123456789");
  await employee
    .getByRole("button", { name: "Criar cadastro", exact: true })
    .click();
  await employee.getByRole("link", { name: "Ir para o login" }).click();
  await employee.getByLabel("Login", { exact: true }).fill(username);
  await employee.getByLabel("Senha", { exact: true }).fill("123456789");
  await employee.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    employee.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await employee
    .getByRole("link", { name: "Configurações", exact: true })
    .click();
  await expect(
    employee.getByLabel("Nome da empresa", { exact: true }),
  ).toBeDisabled();
  await expect(
    employee.getByText(/Apenas administradores podem editar/),
  ).toBeVisible();
  await expect(
    employee.getByRole("button", { name: "Salvar configurações", exact: true }),
  ).toHaveCount(0);
  const status = await employee.evaluate(async () => {
    const csrf = document.cookie
      .split("; ")
      .find((c) => c.startsWith("sf_csrf="))!
      .split("=")[1];
    return (
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: "{}",
      })
    ).status;
  });
  expect(status).toBe(403);
  await ctx.close();
});
