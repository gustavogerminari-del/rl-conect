import { test, expect } from '@playwright/test';

const menuItems = [
  'Visão Geral',
  'Vagas & Processos (ATS)',
  'Headhunter Executive',
  'IA & Triagem CV',
  'Agenda & Entrevistas',
  'Gestão DP & Ponto',
  'Painel Master Admin',
  'Construtor Master IA',
  'Portal de Vagas Público',
  'Auditoria & RLS Logs',
  'Configurações Empresa',
];

test('todas as telas principais abrem sem página branca ou erro de renderização', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByText('RL CONNECT', { exact: true }).first()).toBeVisible();

  for (const label of menuItems) {
    await page.getByRole('button', { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).click();
    await page.waitForTimeout(250);

    const main = page.locator('main');
    await expect(main).toBeVisible();
    const text = (await main.innerText()).trim();
    expect(text.length, `${label} não pode renderizar vazio`).toBeGreaterThan(20);
    await expect(page.getByText('Esta tela encontrou um erro, mas o sistema continua protegido.')).toHaveCount(0);
  }

  expect(pageErrors, `Erros JavaScript encontrados: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('portal público de empresa abre sem tela branca', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/vagas/emp_1');
  await expect(page.locator('body')).not.toHaveText('');
  expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(50);
  expect(pageErrors).toEqual([]);
});
