import { expect, test } from '@playwright/test'

test('la biblioteca pública permite añadir y consultar un libro', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Buenos días/i })).toBeVisible()
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
  await expect(manifest.json()).resolves.toMatchObject({ display: 'standalone', name: 'Lectura de libros' })
})

test('las rutas desconocidas ofrecen una salida accesible', async ({ page }) => {
  await page.goto('/pagina-inexistente')
  await expect(page.getByRole('heading', { name: /no está en el índice/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Volver al inicio/i })).toBeVisible()
})
