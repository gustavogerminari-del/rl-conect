import { test, expect, type Page } from '@playwright/test';

const empresaAdminItems = [
  'Visão Geral',
  'Vagas & Processos (ATS)',
  'Headhunter Executive',
  'IA & Triagem CV',
  'Agenda & Entrevistas',
  'Gestão DP & Ponto',
  'Portal de Vagas Público',
  'Auditoria & RLS Logs',
  'Configurações Empresa',
];

const masterOnlyItems = ['Painel Master Admin', 'Construtor Master IA'];

function button(page: Page, label: string) {
  return page.getByRole('button', { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
}

async function assertScreensOpen(page: Page, labels: string[]) {
  for (const label of labels) {
    await button(page, label).click();
    await page.waitForTimeout(150);
    const main = page.locator('main');
    await expect(main).toBeVisible();
    expect((await main.innerText()).trim().length, `${label} não pode renderizar vazio`).toBeGreaterThan(20);
    await expect(page.getByText('Esta tela encontrou um erro, mas o sistema continua protegido.')).toHaveCount(0);
  }
}

async function setLocalAccess(page: Page, userId: string, empresaId: string) {
  await page.addInitScript(({ userId, empresaId }) => {
    localStorage.setItem('rl_connect_v2_currentUserId', JSON.stringify(userId));
    localStorage.setItem('rl_connect_v2_activeEmpresaId', JSON.stringify(empresaId));
  }, { userId, empresaId });
}

test('acesso empresa abre módulos permitidos sem tela branca e não expõe Master', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await setLocalAccess(page, 'usr_admin_1', 'emp_1');
  await page.goto('/');

  await expect(page.getByText('RL CONNECT', { exact: true }).first()).toBeVisible();
  for (const label of masterOnlyItems) await expect(button(page, label)).toHaveCount(0);
  await assertScreensOpen(page, empresaAdminItems);
  expect(pageErrors, `Erros JavaScript: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('acesso headhunter fica isolado e segue sem DP/Master', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await setLocalAccess(page, 'usr_head_2', 'emp_2');
  await page.goto('/');

  await expect(button(page, 'Headhunter Executive')).toBeVisible();
  await expect(button(page, 'IA & Triagem CV')).toBeVisible();
  await expect(button(page, 'Agenda & Entrevistas')).toBeVisible();
  await expect(button(page, 'Gestão DP & Ponto')).toHaveCount(0);
  await expect(button(page, 'Painel Master Admin')).toHaveCount(0);
  await expect(button(page, 'Construtor Master IA')).toHaveCount(0);
  await expect(button(page, 'Vagas & Processos (ATS)')).toHaveCount(0);

  await assertScreensOpen(page, ['Headhunter Executive', 'IA & Triagem CV', 'Agenda & Entrevistas', 'Portal de Vagas Público']);
  expect(pageErrors, `Erros JavaScript: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('acesso Master abre Painel Master e Construtor sem tela branca', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await setLocalAccess(page, 'usr_master', 'emp_1');
  await page.goto('/');

  for (const label of masterOnlyItems) await expect(button(page, label)).toBeVisible();
  await assertScreensOpen(page, [...empresaAdminItems, ...masterOnlyItems]);
  expect(pageErrors, `Erros JavaScript: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('portal público de empresa abre sem tela branca', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/vagas/emp_1');
  expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(50);
  expect(pageErrors).toEqual([]);
});
