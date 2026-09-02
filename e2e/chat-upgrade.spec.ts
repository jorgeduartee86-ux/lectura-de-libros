import { expect, test, type Page } from '@playwright/test'
import { createSharedVault, encryptContent } from '../src/lib/crypto'
import type { EncryptedRow } from '../src/types'
const relationshipId = '37f6e71b-3147-4c03-9e7b-5aebac40589a',
  userId = 'b21e3060-d8e6-44b7-b3a3-67b4d69b4cf2',
  otherId = 'aa6bc1a8-0c75-42ce-a390-fd09f70bb250'
async function prepare(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const { masterKey } = await createSharedVault('123456', relationshipId)
  const id = crypto.randomUUID(),
    logicalTimestamp = new Date().toISOString()
  const encrypted = await encryptContent(
    masterKey,
    { text: 'Hoy vi algo que me recordó a ti.' },
    {
      relationshipId,
      messageId: id,
      senderId: otherId,
      version: 1,
      logicalTimestamp,
      contentType: 'message',
    },
  )
  const messages: EncryptedRow[] = [
    {
      id,
      relationship_id: relationshipId,
      sender_id: otherId,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      crypto_version: 1,
      content_type: 'message',
      logical_timestamp: logicalTimestamp,
      created_at: logicalTimestamp,
    },
  ]
  const read = new Set<string>(),
    reactions: Record<string, unknown>[] = [],
    stars: { message_id: string; user_id: string }[] = []
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    is_anonymous: true,
    app_metadata: { provider: 'anonymous' },
    user_metadata: {},
    created_at: logicalTimestamp,
  }
  const token = [
    { alg: 'HS256', typ: 'JWT' },
    { sub: userId, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 },
    'test-signature',
  ]
    .map((x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url'))
    .join('.')
  await page.routeWebSocket(/.*/, (ws) => ws.close())
  await page.route('**/*.supabase.co/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname,
      method = request.method()
    const body = method === 'GET' || method === 'HEAD' ? {} : (request.postDataJSON() ?? {})
    let response: unknown = []
    if (path.endsWith('/auth/v1/signup') || path.endsWith('/auth/v1/token'))
      response = {
        access_token: token,
        refresh_token: 'test-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user,
      }
    else if (path.endsWith('/auth/v1/user')) response = user
    else if (path.endsWith('/functions/v1/quick-access'))
      response = { relationshipId, memberLabel: 'Prueba local' }
    else if (path.endsWith('/functions/v1/send-push')) response = { sent: 0 }
    else if (path.endsWith('/functions/v1/chat-delete-message')) {
      const row = messages.find((m) => m.id === body.id)
      if (row) {
        row.deleted_at = new Date().toISOString()
        row.ciphertext = '0'.repeat(32)
      }
      response = { deleted: true }
    } else if (path.endsWith('/functions/v1/r2-create-upload-url')) {
      await route.fulfill({ status: 400, json: { error: 'not_configured' } })
      return
    } else if (path.endsWith('/rest/v1/messages')) {
      if (method === 'POST') {
        const batch = Array.isArray(body) ? body : [body]
        for (const row of batch) if (!messages.some((m) => m.id === row.id)) messages.push(row)
      }
      if (method === 'PATCH') {
        const row = messages.find((m) => url.searchParams.get('id') === `eq.${m.id}`)
        if (row) Object.assign(row, body)
      }
      response = method === 'GET' ? [...messages].reverse() : []
    } else if (path.endsWith('/rest/v1/rpc/chat_unread'))
      response = messages
        .filter((m) => m.sender_id !== userId && !read.has(m.id) && !m.deleted_at)
        .map((m) => ({ message_id: m.id, created_at: m.created_at }))
    else if (path.endsWith('/rest/v1/message_receipts')) {
      if (method === 'POST' && body.status === 'read') read.add(body.message_id)
      response = []
    } else if (path.endsWith('/rest/v1/message_reactions')) {
      if (method === 'POST') {
        const old = reactions.findIndex(
          (r) => r.message_id === body.message_id && r.sender_id === body.sender_id,
        )
        if (old >= 0) reactions.splice(old, 1)
        reactions.push(body)
      }
      response = url.searchParams.has('message_id')
        ? (reactions.find((r) => url.searchParams.get('message_id') === `eq.${r.message_id}`) ?? null)
        : reactions
    } else if (path.endsWith('/rest/v1/starred_messages')) {
      if (method === 'POST') stars.push(body)
      response = stars
    } else if (path.endsWith('/rest/v1/relationship_members')) response = { relationship_id: relationshipId }
    else if (
      path.endsWith('/rest/v1/user_notification_settings') ||
      path.endsWith('/rest/v1/pinned_messages')
    )
      response = null
    else if (!path.includes('/rest/v1/')) {
      await route.abort()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
      headers: {
        'Content-Range': `0-${Math.max(0, (Array.isArray(response) ? response.length : 1) - 1)}/${Array.isArray(response) ? response.length : 1}`,
      },
    })
  })
  await page.goto('/acceso')
  for (const digit of '123456') await page.getByRole('button', { name: digit, exact: true }).click()
  await page.getByRole('button', { name: 'Entrar entre páginas' }).click()
  await expect(page.getByRole('heading', { name: 'Entre páginas', exact: true })).toBeVisible()
  await expect(page.getByText('Hoy vi algo que me recordó a ti.', { exact: true })).toBeVisible()
  const addIncoming = async () => {
    const nextId = crypto.randomUUID(),
      timestamp = new Date().toISOString()
    const envelope = await encryptContent(
      masterKey,
      { text: 'Nueva página mientras miras ajustes' },
      {
        relationshipId,
        messageId: nextId,
        senderId: otherId,
        version: 1,
        logicalTimestamp: timestamp,
        contentType: 'message',
      },
    )
    messages.push({
      id: nextId,
      relationship_id: relationshipId,
      sender_id: otherId,
      iv: envelope.iv,
      ciphertext: envelope.ciphertext,
      crypto_version: 1,
      content_type: 'message',
      logical_timestamp: timestamp,
      created_at: timestamp,
    })
    return nextId
  }
  return { messages, read, addIncoming }
}
test('chat móvil: lectura real, texto offline, reintento y cifrado', async ({ page, context }, testInfo) => {
  const state = await prepare(page)
  await expect.poll(() => state.read.size).toBe(1)
  await context.setOffline(true)
  await page
    .getByRole('textbox', { name: 'Escribe un mensaje' })
    .fill('Borrador offline que no debe perderse')
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click()
  await expect(page.getByText('Borrador offline que no debe perderse', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Pendiente de enviar')).toBeVisible()
  await context.setOffline(false)
  await expect.poll(() => state.messages.length).toBe(2)
  expect(JSON.stringify(state.messages)).not.toContain('Borrador offline')
  await page.screenshot({ path: testInfo.outputPath('chat-upgrade.png'), fullPage: true })
})
test('acciones, stickers originales y menú de herramientas', async ({ page }, testInfo) => {
  await prepare(page)
  await page.getByRole('button', { name: 'Acciones del mensaje', exact: true }).first().click()
  await page.getByRole('button', { name: 'Responder', exact: true }).click()
  await expect(page.locator('.reply-draft')).toContainText('Hoy vi algo')
  await page.getByRole('textbox', { name: 'Escribe un mensaje' }).fill('Yo también pensé en ti')
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click()
  await expect(page.getByText('Yo también pensé en ti', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Stickers', exact: true }).click()
  await page.getByRole('button', { name: 'Enviar sticker: Te amo', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Te amo', exact: true })).toBeVisible()
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Abrir menú', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Herramientas de Nuestra Historia' })).toContainText(
    'Almacenamiento',
  )
  await expect(page.getByRole('navigation', { name: 'Herramientas de Nuestra Historia' })).toContainText(
    'Ruleta romántica',
  )
  await page.screenshot({ path: testInfo.outputPath('tools-upgrade.png'), fullPage: true })
})
test('no marca leído al entrar en otra pantalla y conserva el borrador cifrado', async ({
  page,
}, testInfo) => {
  const state = await prepare(page)
  await expect.poll(() => state.read.size).toBe(1)
  await page.getByRole('textbox', { name: 'Escribe un mensaje' }).fill('Texto privado sin enviar')
  await page.locator('.chat-header').getByRole('link', { name: 'Notificaciones', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Avisos a tu manera' })).toBeVisible()
  const unseen = await state.addIncoming()
  await expect(page).toHaveTitle('(1) Lectura de libros', { timeout: 20000 })
  expect(state.read.has(unseen)).toBe(false)
  await page.goto('/historia/conversacion')
  // Full reload locks the vault, but not the encrypted draft.
  await expect(page.getByRole('heading', { name: 'Nuestra Historia', exact: true })).toBeVisible()
  for (const digit of '123456') await page.getByRole('button', { name: digit, exact: true }).click()
  await page.getByRole('button', { name: 'Entrar entre páginas' }).click()
  await expect(page.getByRole('textbox', { name: 'Escribe un mensaje' })).toHaveValue(
    'Texto privado sin enviar',
  )
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  expect(overflow).toBe(false)
  await page.screenshot({ path: testInfo.outputPath('draft-restored.png'), fullPage: true })
})

test('tema oscuro, contraste principal y frase compartida', async ({ page }, testInfo) => {
  await prepare(page)
  await page.locator('.chat-header').getByRole('link', { name: 'Notificaciones', exact: true }).click()
  await page.getByLabel('Apariencia', { exact: true }).selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.goBack()
  await page.getByRole('button', { name: 'Editar nuestra frase compartida' }).click()
  await page.getByRole('textbox', { name: 'Frase compartida' }).fill('Siempre tenemos una página más')
  await page.getByRole('button', { name: 'Guardar para los dos' }).click()
  await expect(page.getByRole('button', { name: 'Editar nuestra frase compartida' })).toContainText(
    'Siempre tenemos una página más',
  )
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--pantone-2597').trim().toLowerCase(),
    ),
  ).toBe('#5c068c')
  await page.screenshot({ path: testInfo.outputPath('chat-dark.png'), fullPage: true })
})
