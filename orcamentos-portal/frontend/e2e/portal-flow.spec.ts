import { expect, test, type Page } from '@playwright/test'

const ADMIN = { email: 'admin@portal.local', password: 'Admin@123456' }
const CLIENT = { email: 'cliente@demo.local', password: 'Admin@123456' }

test.describe.configure({ mode: 'serial' })

let requestPath = ''

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: /Entrar/i }).click()
  await expect(page).toHaveURL(/\/dashboard/)
}

async function resetSession(page: Page) {
  await page.goto('/login')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

test('cliente avança todos os passos e cria solicitação', async ({ page }) => {
  await resetSession(page)
  await login(page, CLIENT.email, CLIENT.password)

  await page.goto('/requests/new')
  await expect(page.getByText(/Dados do solicitante/i)).toBeVisible()

  await page.locator('input[name="requesterName"]').fill('Cliente E2E')
  await page.locator('input[name="requesterEmail"]').fill('cliente.e2e@teste.local')
  await page.locator('input[name="requesterPhone"]').fill('11999990000')
  await page.getByRole('button', { name: /Pr.ximo/i }).click()

  await expect(page.getByText(/Dados do cliente final/i)).toBeVisible()
  await page.locator('input[name="finalClientName"]').fill('Cliente Final E2E')
  await page.locator('input[name="finalClientCompany"]').fill('Empresa E2E')
  await page.locator('input[name="finalClientContact"]').fill('Contato E2E')
  await page.locator('input[name="finalClientPhone"]').fill('11888887777')
  await page.getByRole('button', { name: /Pr.ximo/i }).click()

  await expect(page.getByText(/Dados da localidade/i)).toBeVisible()
  await page.locator('input[name="zipCode"]').fill('01001-000')
  await page.locator('input[name="street"]').fill('Praça da Sé')
  await page.locator('input[name="streetNumber"]').fill('100')
  await page.locator('input[name="neighborhood"]').fill('Sé')
  await page.locator('input[name="city"]').fill('São Paulo')
  await page.locator('input[name="state"]').fill('SP')
  await page.locator('input[name="latitude"]').fill('-23.5505')
  await page.locator('input[name="longitude"]').fill('-46.6333')
  await page.getByRole('button', { name: /Pr.ximo/i }).click()

  await expect(page.getByText(/Dados do servi/i)).toBeVisible()
  await page.locator('button').filter({ hasText: /Ativa/i }).first().click()
  await page.locator('textarea[name="description"]').fill('Solicitação E2E para validar fluxo completo.')
  await page.getByRole('button', { name: /Enviar solicita/i }).click()

  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]+/)
  requestPath = new URL(page.url()).pathname
  await expect(page.getByText(/Dados da solicita/i)).toBeVisible()
  await expect(page.getByText(/Cliente Final E2E/i)).toBeVisible()
})

test('admin assume, monta orçamento com tabela e envia ao cliente', async ({ page }) => {
  expect(requestPath, 'requestPath precisa vir do teste de criação').toBeTruthy()

  await resetSession(page)
  await login(page, ADMIN.email, ADMIN.password)

  await page.goto(requestPath)
  await expect(page.getByText(/Dados da solicita/i)).toBeVisible()

  const assignButton = page.getByRole('button', { name: /Assumir solicita/i })
  if (await assignButton.isVisible().catch(() => false)) {
    await assignButton.click()
  }

  await expect(page.getByRole('button', { name: /Iniciar or/i })).toBeVisible()
  await page.getByRole('button', { name: /Iniciar or/i }).click()

  await expect(page.getByText(/Montagem de Or/i)).toBeVisible()
  await expect(page.locator('.card-header').filter({ hasText: /Tabela de pre/i })).toBeVisible()
  await expect(page.getByText(/Instala/i).first()).toBeVisible()

  await page.getByTitle(/Adicionar ao or/i).first().click({ force: true })
  await expect(page.getByText(/Instala/i).last()).toBeVisible()

  await page.getByRole('button', { name: /Enviar ao cliente/i }).click()
  await expect(page.getByText(/Enviar orçamento ao cliente/i)).toBeVisible()
  await page.getByRole('button', { name: /Confirmar envio/i }).click()

  await expect(page.getByText(/Orçamento enviado ao cliente/i)).toBeVisible()
})

test('cliente vê detalhes do orçamento na mesma página e aprova', async ({ page }) => {
  expect(requestPath, 'requestPath precisa vir do teste de criação').toBeTruthy()

  await resetSession(page)
  await login(page, CLIENT.email, CLIENT.password)

  await page.goto(requestPath)
  await expect(page.locator('table').filter({ hasText: /Instalação Starlink Mini/i })).toBeVisible()
  await expect(page.getByText(/Instalação Starlink Mini/i)).toBeVisible()
  await expect(page.getByText(/600,00/i).first()).toBeVisible()

  await page.getByRole('button', { name: /Aprovar/i }).click()
  await expect(page.getByText(/Aprovar orçamento/i)).toBeVisible()
  await page.getByRole('button', { name: /Confirmar/i }).click()

  await expect(page.getByText(/Aprovado/i)).toBeVisible()
})

test('admin vê tabela operacional com itens para Sencinet', async ({ page }) => {
  await resetSession(page)
  await login(page, ADMIN.email, ADMIN.password)

  await page.goto('/price-tables')
  await expect(page.getByText(/Selecione o cliente/i)).toBeVisible()

  await page.locator('select').first().selectOption({ label: 'Sencinet' })
  await expect(page.getByText(/Tabela de Preços Operacional 2026/i).first()).toBeVisible()
  await expect(page.getByText(/Instalação Starlink Mini/i)).toBeVisible()
  await expect(page.getByText(/36 itens ativos/i)).toBeVisible()
})
