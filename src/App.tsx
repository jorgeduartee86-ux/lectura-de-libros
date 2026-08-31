import { lazy, Suspense, useEffect } from 'react'
import type { ComponentType } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { PublicShell } from './components/PublicShell'
import { PageLoader } from './components/ui'
import { flushOutbox } from './lib/privateRepository'
import { supabase } from './lib/supabase'
import {
  AcceptInvitationPage as AcceptInvitation,
  AuthPage as Auth,
  AuthorsPage as Authors,
  BookDetailPage as Detail,
  HomePage as Home,
  InstallPage as Install,
  LibraryPage as Library,
  LinkAccountPage as LinkAccount,
  NotFoundPage as NotFound,
  OfflinePage as Offline,
  PrivacyPage as Privacy,
  QuotesPage as Quotes,
  SearchPage as Search,
} from './pages/PublicPages'
import { useAppStore } from './store/app'
import './App.css'

const privatePage = <T extends keyof typeof import('./pages/PrivatePages')>(name: T) =>
  lazy(() => import('./pages/PrivatePages').then((module) => ({ default: module[name] as ComponentType })))
const Unlock = privatePage('UnlockPage')
const PrivateLayout = privatePage('PrivateShell')
const StoryHome = privatePage('StoryHomePage')
const Conversation = privatePage('ConversationPage')
const Signals = privatePage('SignalsPage')
const SamePage = privatePage('SamePagePage')
const Letters = privatePage('LettersPage')
const Question = privatePage('DailyQuestionPage')
const SharedBook = privatePage('SharedBookPage')
const Roulette = privatePage('RoulettePage')
const VirtualDate = privatePage('VirtualDatePage')
const Memories = privatePage('MemoriesPage')
const Universe = privatePage('UniversePage')
const Gifts = privatePage('GiftsPage')
const PrivateSettings = privatePage('SettingsPage')

function Bootstrap() {
  const initialize = useAppStore((state) => state.initialize)
  const setOnline = useAppStore((state) => state.setOnline)
  const setSession = useAppStore((state) => state.setSession)
  const loaded = useAppStore((state) => state.loaded)

  useEffect(() => {
    void initialize()
    const online = () => {
      setOnline(true)
      void flushOutbox()
    }
    const offline = () => setOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)

    let active = true
    const client = supabase
    if (client) {
      void client.auth.getSession().then(async ({ data }) => {
        const user = data.session?.user
        if (!active || !user) return
        const { data: membership } = await client
          .from('relationship_members')
          .select('relationship_id')
          .eq('user_id', user.id)
          .maybeSingle()
        if (active)
          setSession({
            userId: user.id,
            email: user.email ?? '',
            relationshipId: membership?.relationship_id ?? null,
          })
      })
      const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) setSession(null)
      })
      return () => {
        active = false
        listener.subscription.unsubscribe()
        window.removeEventListener('online', online)
        window.removeEventListener('offline', offline)
      }
    }
    return () => {
      active = false
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [initialize, setOnline, setSession])

  if (!loaded) return <PageLoader />
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route index element={<Home />} />
        <Route path="biblioteca" element={<Library />} />
        <Route path="libro/:id" element={<Detail />} />
        <Route path="citas" element={<Quotes />} />
        <Route path="autores" element={<Authors />} />
        <Route path="buscar" element={<Search />} />
        <Route path="instalar" element={<Install />} />
        <Route path="acceso" element={<Auth />} />
        <Route path="vincular" element={<LinkAccount />} />
        <Route path="aceptar-invitacion/:token" element={<AcceptInvitation />} />
        <Route path="privacidad" element={<Privacy />} />
        <Route path="offline" element={<Offline />} />
      </Route>
      <Route path="desbloquear" element={<Unlock />} />
      <Route path="historia" element={<PrivateLayout />}>
        <Route index element={<StoryHome />} />
        <Route path="conversacion" element={<Conversation />} />
        <Route path="capitulo" element={<Conversation />} />
        <Route path="marcapaginas" element={<Signals />} />
        <Route path="misma-pagina" element={<SamePage />} />
        <Route path="cartas" element={<Letters />} />
        <Route path="pregunta" element={<Question />} />
        <Route path="nuestro-libro" element={<SharedBook />} />
        <Route path="ruleta" element={<Roulette />} />
        <Route path="cita" element={<VirtualDate />} />
        <Route path="recuerdos" element={<Memories />} />
        <Route path="universo" element={<Universe />} />
        <Route path="regalos" element={<Gifts />} />
        <Route path="configuracion" element={<PrivateSettings />} />
        <Route path="notificaciones" element={<PrivateSettings />} />
        <Route path="privacidad" element={<PrivateSettings />} />
        <Route path="dispositivos" element={<PrivateSettings />} />
        <Route path="seguridad" element={<PrivateSettings />} />
        <Route path="desvincular" element={<PrivateSettings />} />
        <Route path="eliminar-cuenta" element={<PrivateSettings />} />
        <Route path="estados" element={<PrivateSettings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function App() {
  const base = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '')
  return (
    <BrowserRouter basename={base}>
      <Suspense fallback={<PageLoader />}>
        <Bootstrap />
      </Suspense>
    </BrowserRouter>
  )
}

export default App
