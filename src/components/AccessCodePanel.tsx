import { BookKey, Delete, ShieldCheck, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { enterWithAccessCode } from '../lib/quickAccess'
import { Notice } from './ui'

const errorMessages: Record<string, string> = {
  invalid_code_format: 'Escribe los seis números de la clave.',
  invalid_access_code: 'Esa clave no coincide. Inténtalo de nuevo.',
  rate_limited: 'Hubo varios intentos. Espera unos minutos y vuelve a probar.',
  anonymous_access_unavailable: 'No fue posible crear el acceso privado en este dispositivo.',
  service_unavailable: 'El espacio privado no está disponible en este momento.',
}

export function AccessCodePanel() {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => inputRef.current?.focus(), [])

  const enter = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (code.length !== 6) {
      setError(errorMessages.invalid_code_format)
      return
    }
    setBusy(true)
    try {
      await enterWithAccessCode(code)
      const next = new URLSearchParams(location.search).get('next')
      navigate(next?.startsWith('/historia/') ? next : '/historia/conversacion', { replace: true })
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : 'access_failed'
      setCode('')
      setError(errorMessages[reason] ?? 'No fue posible abrir el espacio. Vuelve a intentarlo.')
      window.setTimeout(() => inputRef.current?.focus(), 0)
    } finally {
      setBusy(false)
    }
  }

  const append = (digit: string) => {
    setError('')
    setCode((current) => `${current}${digit}`.slice(0, 6))
  }

  return (
    <main className="secret-access-page">
      <Link className="quick-exit" to="/">
        <X /> Salida rápida
      </Link>
      <section className="secret-access-card">
        <div className="secret-access-mark" aria-hidden="true">
          <BookKey />
        </div>
        <p className="private-eyebrow">ENTRE PÁGINAS</p>
        <h1>Nuestra Historia</h1>
        <p className="secret-access-intro">
          Escribe la clave de seis números. No necesitas correo ni contraseña.
        </p>
        <form onSubmit={enter} className="access-code-form">
          <label htmlFor="access-code">Clave privada</label>
          <input
            ref={inputRef}
            id="access-code"
            className="access-code-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="off"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-describedby="access-code-help"
          />
          <div className="access-code-dots" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <span className={index < code.length ? 'filled' : ''} key={index} />
            ))}
          </div>
          <small id="access-code-help">Los números se agrupan de dos en dos.</small>
          <div className="numeric-keypad" aria-label="Teclado numérico">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button type="button" key={digit} onClick={() => append(digit)}>
                {digit}
              </button>
            ))}
            <span />
            <button type="button" onClick={() => append('0')}>
              0
            </button>
            <button
              type="button"
              aria-label="Borrar último número"
              onClick={() => setCode((current) => current.slice(0, -1))}
            >
              <Delete />
            </button>
          </div>
          {error && <Notice kind="error">{error}</Notice>}
          <button className="secret-enter-button" disabled={busy || code.length !== 6}>
            {busy ? 'Abriendo el capítulo…' : 'Entrar entre páginas'}
          </button>
        </form>
        <small className="secret-access-security">
          <ShieldCheck /> Mensajes cifrados y visibles solo dentro de este espacio
        </small>
      </section>
    </main>
  )
}
