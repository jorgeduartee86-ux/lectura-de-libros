import { expect, test } from '@playwright/test'

test('la biblioteca pública permite añadir y consultar un libro', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /(Buenos días|Buenas tardes|Buenas noches)/i }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Biblioteca', exact: true }).first().click()
  await page.getByRole('button', { name: /Añadir libro/i }).click()
  await page.getByLabel('Título').fill('La tregua')
  await page.getByLabel('Autor', { exact: true }).fill('Mario Benedetti')
  await page.getByLabel('Género', { exact: true }).fill('Novela')
  await page.getByRole('combobox').first().selectOption('reading')
  await page.getByRole('button', { name: /Añadir a mi biblioteca/i }).click()
  await expect(page.getByRole('heading', { name: 'La tregua' })).toBeVisible()
})

test('la aplicación expone un manifiesto PWA instalable', async ({ request }) => {
  const page = await request.get('/')
  expect(page.ok()).toBeTruthy()
  const html = await page.text()
  const manifestPath = html.match(/rel="manifest" href="([^"]+)"/)?.[1]
  expect(manifestPath).toBeTruthy()
  const manifest = await request.get(manifestPath!)
  expect(manifest.ok()).toBeTruthy()
  const data = await manifest.json()
  expect(data).toMatchObject({ display: 'standalone', name: 'Lectura de libros' })
  expect(data.start_url).toBeTruthy()
  expect(data.scope).toBeTruthy()
  expect(data.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192' }),
      expect.objectContaining({ sizes: '512x512' }),
      expect.objectContaining({ purpose: 'maskable' }),
    ]),
  )
  const worker = await request.get('/sw.js')
  expect(worker.ok()).toBeTruthy()
})

test('el acceso privado usa únicamente una clave numérica de seis cifras', async ({ page }, testInfo) => {
  await page.goto('/acceso')
  await expect(page.getByRole('heading', { name: 'Nuestra Historia' })).toBeVisible()
  await expect(page.getByText('No necesitas correo ni contraseña.')).toBeVisible()
  await expect(page.locator('input[type="email"]')).toHaveCount(0)
  await expect(page.locator('.access-code-dots span')).toHaveCount(6)
  for (const digit of ['1', '2', '3', '4', '5', '6'])
    await page.getByRole('button', { name: digit, exact: true }).click()
  await expect(page.getByRole('button', { name: 'Entrar entre páginas' })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('access-mobile.png'), fullPage: true })
})

test('las rutas desconocidas ofrecen una salida accesible', async ({ page }) => {
  await page.goto('/pagina-inexistente')
  await expect(page.getByRole('heading', { name: /no está en el índice/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Volver al inicio/i })).toBeVisible()
})
