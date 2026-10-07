import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthProvider";

export function Landing() {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const { session } = useAuth();

  return (
    <div className="bg-surface text-on-surface font-sans min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-20 w-full px-margin-mobile md:px-margin flex items-center justify-between">
          <div className="flex items-center gap-space-lg">
            <Link to="/" className="flex items-center gap-space-sm">
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                <span className="icon text-[22px]">shield</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline text-headline-sm text-on-surface tracking-tight leading-none font-bold">
                  SEGEVIA
                </span>
                <span className="text-label-sm text-[10px] text-on-surface-variant uppercase tracking-widest">
                  Sales IA Enterprise
                </span>
              </div>
            </Link>
            <nav className="hidden lg:flex items-center gap-space-lg ml-space-md">
              <a href="#capacidades" className="text-label-md text-on-surface-variant hover:text-on-surface transition-colors">
                Características
              </a>
              <a href="#ventajas" className="text-label-md text-on-surface-variant hover:text-on-surface transition-colors">
                Ventajas
              </a>
              <a href="#operaciones" className="text-label-md text-on-surface-variant hover:text-on-surface transition-colors">
                Casos de Uso
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-space-sm">
            {session ? (
              <Link
                to="/dashboard"
                className="px-space-md py-space-sm rounded-lg bg-primary text-on-primary text-label-md hover:bg-primary-container transition-colors shadow-sm font-semibold flex items-center gap-1.5"
              >
                <span className="icon text-base">dashboard</span>
                Ir al Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-space-md py-space-sm rounded-lg text-label-md text-on-surface hover:bg-surface-container-high transition-colors font-semibold"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  to="/login"
                  className="px-space-md py-space-sm rounded-lg bg-primary text-on-primary text-label-md hover:bg-primary-container transition-colors shadow-sm font-semibold flex items-center gap-1"
                >
                  <span className="icon text-base">bolt</span>
                  Acceder a la App
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="w-full pt-20 flex-1">
        {/* HERO SECTION */}
        <section className="relative w-full px-margin-mobile md:px-margin py-space-lg lg:py-space-xl overflow-hidden">
          <div className="relative w-full rounded-3xl min-h-[600px] lg:min-h-[680px] flex items-center bg-inverse-surface overflow-hidden shadow-xl">
            <img
              alt="Equipo empresarial trabajando en oficina corporativa moderna"
              className="absolute inset-0 w-full h-full object-cover object-center opacity-40"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDTDzQAw0VaeVodWTmcrFWSu3fYELz6kr0GZdd5NFHTyq4hTBYcy7d5SWo3KVzMEnjTKzFpJjHKZatnEA8LlVUdrUCdJx-MwtVtd_RD5HzyPJua6N86m7lu7GsdFw_FZHQVi8gXu3P4Kv_TJ8vcLVgZiyKmW2bbyKnc9qrDTG4xn1cPkqs2bYwcjKiY_yVpazhqsizfkYEj_2Unn3oe2fpFeLXRSaGWcKDwrdWxJYs"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b1021]/95 via-[#0f1738]/85 to-[#0b142f]/60 pointer-events-none z-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1021]/90 via-transparent to-[#0b1021]/40 pointer-events-none z-0" />

            <div className="relative z-10 w-full max-w-5xl px-space-md sm:px-space-lg lg:px-space-xl py-space-xl flex flex-col items-start gap-space-lg">
              <div className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container-lowest/10 backdrop-blur-md shadow-sm border border-white/10">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                <span className="text-label-sm text-secondary-fixed tracking-wide uppercase font-semibold">
                  ✦ Nueva Generación de IA Comercial B2B · Human-in-the-Loop
                </span>
              </div>

              <h1 className="font-headline text-headline-xl text-inverse-on-surface max-w-3xl leading-[1.12] tracking-tight font-bold">
                Acelera tus ventas B2B con Inteligencia Artificial Supervisada
              </h1>

              <p className="text-body-lg text-surface-container-high max-w-2xl font-normal leading-relaxed">
                SEGEVIA unifica tu Inbox omnicanal (<span className="text-secondary-fixed font-medium">WhatsApp e Instagram</span>), automatiza la prospección, califica leads con rigor RAG y genera contenido comercial de alta conversión sin riesgo de alucinación.
              </p>

              <div className="flex flex-wrap items-center gap-space-md pt-space-xs w-full sm:w-auto">
                <Link
                  to={session ? "/dashboard" : "/login"}
                  className="w-full sm:w-auto px-space-lg py-space-md rounded-xl bg-primary text-on-primary text-label-md font-semibold hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-space-xs"
                >
                  <span className="icon text-[20px]">{session ? "dashboard" : "bolt"}</span>
                  {session ? "Ir al Dashboard" : "Comenzar Prueba Gratuita"}
                </Link>
                <button
                  type="button"
                  onClick={() => setDemoModalOpen(true)}
                  className="w-full sm:w-auto px-space-lg py-space-md rounded-xl bg-surface-container-lowest/10 backdrop-blur-md text-inverse-on-surface text-label-md font-medium hover:bg-surface-container-lowest/20 transition-all flex items-center justify-center gap-space-xs border border-white/10"
                >
                  <span className="icon text-secondary-fixed text-[20px]">play_circle</span>
                  Ver Demo Interactiva en Video
                </button>
              </div>

              <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-space-md pt-space-lg mt-space-sm bg-surface-container-lowest/5 backdrop-blur-sm rounded-2xl p-space-md border border-white/10">
                <div className="flex flex-col">
                  <div className="flex items-center gap-space-xs">
                    <span className="icon text-secondary-fixed text-[18px]">verified</span>
                    <span className="font-headline text-headline-lg text-inverse-on-surface font-bold">98.2%</span>
                  </div>
                  <span className="text-body-sm text-surface-container-high">Precisión verificada en respuestas</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-space-xs">
                    <span className="icon text-secondary-fixed text-[18px]">trending_up</span>
                    <span className="font-headline text-headline-lg text-inverse-on-surface font-bold">+3.4x</span>
                  </div>
                  <span className="text-body-sm text-surface-container-high">Velocidad en pipeline y cierre</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-space-xs">
                    <span className="icon text-secondary-fixed text-[18px]">security</span>
                    <span className="font-headline text-headline-lg text-inverse-on-surface font-bold">0%</span>
                  </div>
                  <span className="text-body-sm text-surface-container-high">Alucinaciones: RAG Vectorial auditado</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ECOSISTEMA CERTIFICADO */}
        <section className="w-full px-margin-mobile md:px-margin py-space-md">
          <div className="w-full bg-surface-container-low rounded-2xl p-space-lg flex flex-col md:flex-row items-center justify-between gap-space-md shadow-sm">
            <div className="flex items-center gap-space-sm shrink-0">
              <span className="icon text-primary text-[24px]">hub</span>
              <div className="flex flex-col">
                <span className="text-label-md text-on-surface font-bold uppercase tracking-wider">Ecosistema Certificado</span>
                <span className="text-body-sm text-on-surface-variant">Conectores nativos y modelos auditados</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-space-xs justify-start md:justify-end">
              <span className="px-space-md py-space-xs rounded-full bg-surface-container-lowest text-on-surface tabular text-body-sm shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />GPT-4o
              </span>
              <span className="px-space-md py-space-xs rounded-full bg-surface-container-lowest text-on-surface tabular text-body-sm shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-secondary" />Claude 3.5 Sonnet
              </span>
              <span className="px-space-md py-space-xs rounded-full bg-surface-container-lowest text-on-surface tabular text-body-sm shadow-sm flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-tertiary" />Gemini 2.5 Flash
              </span>
              <span className="px-space-md py-space-xs rounded-full bg-surface-container-lowest text-on-surface text-body-sm shadow-sm flex items-center gap-1.5">
                <span className="icon text-[16px] text-secondary">chat</span>WhatsApp API
              </span>
              <span className="px-space-md py-space-xs rounded-full bg-surface-container-lowest text-on-surface text-body-sm shadow-sm flex items-center gap-1.5">
                <span className="icon text-[16px] text-primary">photo_camera</span>Instagram Direct
              </span>
              <span className="px-space-md py-space-xs rounded-full bg-surface-container-lowest text-on-surface text-body-sm shadow-sm flex items-center gap-1.5">
                <span className="icon text-[16px] text-tertiary">search</span>Tavily Search
              </span>
            </div>
          </div>
        </section>

        {/* CAPACIDADES DEL SISTEMA (Bento Grid) */}
        <section className="w-full px-margin-mobile md:px-margin py-space-xl" id="capacidades">
          <div className="max-w-4xl mx-auto text-center flex flex-col items-center gap-space-xs mb-space-xl">
            <span className="text-label-sm text-primary uppercase font-bold tracking-widest bg-primary-fixed px-space-md py-1 rounded-full">
              Capacidades del Sistema
            </span>
            <h2 className="font-headline text-headline-xl text-on-surface font-bold tracking-tight">
              Orquestación comercial continua de grado corporativo
            </h2>
            <p className="text-body-lg text-on-surface-variant max-w-2xl">
              Diseñado específicamente para eliminar cuellos de botella en equipos de ventas B2B que reciben cientos de mensajes y solicitudes al día.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            {/* Card 1 */}
            <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-hairline flex flex-col justify-between">
              <div className="flex flex-col gap-space-sm mb-space-lg">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                    <span className="icon text-[28px]">mark_chat_unread</span>
                  </div>
                  <span className="px-space-sm py-space-xs rounded-full bg-surface-container-high text-primary text-label-sm font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-secondary" />Omnicanal Activo
                  </span>
                </div>
                <h3 className="font-headline text-headline-lg text-on-surface font-semibold pt-space-xs">
                  Inbox Omnicanal Supervisado (WhatsApp, Instagram, Web)
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  Calificación algorítmica de leads en tiempo real con score de intención (0 a 100), ficha CRM contextual en panel lateral y copiloto IA de redacción asistida con memoria conversacional profunda.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-hairline flex flex-col justify-between">
              <div className="flex flex-col gap-space-sm mb-space-lg">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-secondary">
                    <span className="icon text-[28px]">library_books</span>
                  </div>
                  <span className="px-space-sm py-space-xs rounded-full bg-secondary-fixed text-on-secondary-fixed text-label-sm font-semibold">
                    RAG 100% Citable
                  </span>
                </div>
                <h3 className="font-headline text-headline-lg text-on-surface font-semibold pt-space-xs">
                  Knowledge Base Vectorial & RAG Estricto
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  Ingesta inmediata de catálogos técnicos, tarifas vigentes y FAQs. Cada respuesta de la IA cuenta con trazabilidad exacta a la cláusula original.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-hairline flex flex-col justify-between">
              <div className="flex flex-col gap-space-sm mb-space-lg">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-tertiary">
                    <span className="icon text-[28px]">campaign</span>
                  </div>
                  <span className="px-space-sm py-space-xs rounded-full bg-surface-container-high text-tertiary text-label-sm font-semibold">
                    B2B Studio
                  </span>
                </div>
                <h3 className="font-headline text-headline-lg text-on-surface font-semibold pt-space-xs">
                  Content Studio Multicanal
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  Generación automatizada de piezas de prospección para LinkedIn e Instagram. Monitoreo constante de tendencias industriales y verificación de voz de marca institucional previo a la aprobación.
                </p>
              </div>
            </div>

            {/* Card 4 */}
            <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-hairline flex flex-col justify-between">
              <div className="flex flex-col gap-space-sm mb-space-lg">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                    <span className="icon text-[28px]">verified_user</span>
                  </div>
                  <span className="px-space-sm py-space-xs rounded-full bg-surface-container-high text-primary text-label-sm font-semibold">
                    Human-in-the-Loop Total
                  </span>
                </div>
                <h3 className="font-headline text-headline-lg text-on-surface font-semibold pt-space-xs">
                  Guardarraíles & Supervisión Humana
                </h3>
                <p className="text-body-md text-on-surface-variant">
                  Gobernanza activa. Si un cliente solicita descuentos no autorizados o condiciones críticas, el sistema activa alertas inmediatas y cede el mando al asesor humano sin interrupción.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* METRICAS ROI */}
        <section className="w-full px-margin-mobile md:px-margin py-space-xl bg-surface-container-low" id="ventajas">
          <div className="max-w-6xl mx-auto flex flex-col gap-space-xl">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
              <div className="flex flex-col gap-space-xs max-w-2xl">
                <span className="text-label-sm text-secondary uppercase font-bold tracking-widest">
                  Retorno de Inversión Demostrable
                </span>
                <h2 className="font-headline text-headline-xl text-on-surface font-bold tracking-tight">
                  Métricas que impactan directamente el balance comercial
                </h2>
              </div>
              <p className="text-body-md text-on-surface-variant max-w-sm">
                Probado en empresas B2B en sectores industrial, logístico y de servicios profesionales.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
              <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-hairline flex flex-col justify-between">
                <div className="flex flex-col gap-space-xs">
                  <span className="icon text-primary text-[32px]">timer</span>
                  <span className="font-headline text-headline-xl text-primary font-bold tracking-tight mt-space-sm">14s</span>
                  <span className="font-headline text-headline-sm text-on-surface font-semibold">Tiempo Medio de Respuesta</span>
                  <p className="text-body-sm text-on-surface-variant pt-1">
                    Reducción radical frente al promedio industrial. Atiende al prospecto en el instante de máxima intención.
                  </p>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-hairline flex flex-col justify-between">
                <div className="flex flex-col gap-space-xs">
                  <span className="icon text-secondary text-[32px]">price_check</span>
                  <span className="font-headline text-headline-xl text-secondary font-bold tracking-tight mt-space-sm">+34%</span>
                  <span className="font-headline text-headline-sm text-on-surface font-semibold">Tasa de Conversión a Cierre</span>
                  <p className="text-body-sm text-on-surface-variant pt-1">
                    Mayor volumen de leads calificados que pasan a cotización formal en tu CRM sin fricción administrativa.
                  </p>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-hairline flex flex-col justify-between">
                <div className="flex flex-col gap-space-xs">
                  <span className="icon text-tertiary text-[32px]">encrypted</span>
                  <span className="font-headline text-headline-xl text-tertiary font-bold tracking-tight mt-space-sm">100%</span>
                  <span className="font-headline text-headline-sm text-on-surface font-semibold">Soberanía de Datos</span>
                  <p className="text-body-sm text-on-surface-variant pt-1">
                    Los datos confidenciales nunca se usan para reentrenar modelos públicos. Cifrado AES-256 en reposo y tránsito.
                  </p>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-space-lg rounded-2xl shadow-sm border border-hairline flex flex-col justify-between">
                <div className="flex flex-col gap-space-xs">
                  <span className="icon text-on-surface text-[32px]">flash_on</span>
                  <span className="font-headline text-headline-xl text-on-surface font-bold tracking-tight mt-space-sm">1 Clic</span>
                  <span className="font-headline text-headline-sm text-on-surface font-semibold">Onboarding sin Fricción</span>
                  <p className="text-body-sm text-on-surface-variant pt-1">
                    Conexión inmediata con WhatsApp Business API, CRM empresarial y carpetas operativas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CONVERSION CTA */}
        <section className="w-full px-margin-mobile md:px-margin py-space-xl">
          <div className="w-full max-w-6xl mx-auto rounded-3xl bg-primary text-on-primary p-space-xl lg:p-16 relative overflow-hidden shadow-xl flex flex-col items-center text-center gap-space-lg">
            <div className="relative z-10 flex flex-col items-center gap-space-sm max-w-3xl">
              <span className="text-label-sm text-on-primary-container uppercase font-bold tracking-widest bg-on-primary-fixed/20 px-space-md py-1 rounded-full">
                Implementación Rápida
              </span>
              <h2 className="font-headline text-headline-xl text-on-primary font-bold tracking-tight">
                Transforma tu equipo comercial con IA rigurosa y verificable hoy mismo
              </h2>
              <p className="text-body-lg text-on-primary-container max-w-2xl font-normal">
                Comienza a operar tus agentes supervisados y descubre el potencial de conversión en tus propios canales.
              </p>
            </div>
            <div className="relative z-10 flex flex-wrap items-center justify-center gap-space-md pt-space-xs">
              <Link
                to={session ? "/dashboard" : "/login"}
                className="px-space-xl py-space-md rounded-xl bg-surface-container-lowest text-primary text-label-md font-bold hover:bg-surface-container transition-all shadow-md flex items-center gap-space-xs"
              >
                <span className="icon text-[20px]">{session ? "dashboard" : "bolt"}</span>
                {session ? "Ir al Dashboard" : "Acceder a SEGEVIA"}
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="w-full bg-surface-container-low text-on-surface-variant py-space-xl border-t border-hairline">
        <div className="w-full px-margin-mobile md:px-margin flex flex-col sm:flex-row items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-on-primary">
              <span className="icon text-[18px]">shield</span>
            </div>
            <span className="font-headline text-headline-sm text-on-surface tracking-tight font-bold">SEGEVIA</span>
          </div>
          <p className="text-label-sm text-on-surface-variant">
            © 2026 SEGEVIA Technologies. Gestión comercial impulsada por IA.
          </p>
        </div>
      </footer>

      {/* DEMO MODAL */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/70 backdrop-blur-sm flex items-center justify-center p-space-md">
          <div className="w-full max-w-2xl bg-surface-container-lowest rounded-2xl shadow-xl overflow-hidden flex flex-col p-space-lg gap-space-md">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-headline-sm font-bold text-on-surface">
                Demostración de SEGEVIA
              </h3>
              <button
                type="button"
                onClick={() => setDemoModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container flex items-center justify-center"
              >
                <span className="icon">close</span>
              </button>
            </div>
            <p className="text-body-md text-on-surface-variant">
              SEGEVIA integra un pipeline comercial guiado por humanos. Explora las secciones de Content Studio, Knowledge Base e Inbox iniciando sesión en la aplicación.
            </p>
            <div className="flex justify-end gap-space-sm pt-space-xs">
              <button
                type="button"
                onClick={() => setDemoModalOpen(false)}
                className="px-space-md py-space-sm rounded-lg text-label-md text-on-surface hover:bg-surface-container"
              >
                Cerrar
              </button>
              <Link
                to={session ? "/dashboard" : "/login"}
                className="px-space-lg py-space-sm rounded-lg bg-primary text-on-primary text-label-md font-semibold"
              >
                {session ? "Ir al Dashboard" : "Ir a Iniciar Sesión"}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
