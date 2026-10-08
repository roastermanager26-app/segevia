import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { db } from "../lib/supabase";
import { Badge, Button, Card, Field, Icon, inputClass } from "../components/ui";

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || "/dashboard";

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSignupSuccess(null);
    setLoading(true);

    try {
      const client = db();
      if (isSignUp) {
        const { data: signUpData, error: signUpError } = await client.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (signUpError) throw signUpError;

        if (!signUpData.session) {
          setSignupSuccess(
            `¡Cuenta creada! Hemos enviado un correo de confirmación de SEGEVIA a ${email}. Revisa tu bandeja de entrada para verificar tu cuenta e ingresar al dashboard.`
          );
          return;
        }
      } else {
        const { error: signInError } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setSignupSuccess(null);
    setLoading(true);
    try {
      const { error: signInError } = await db().auth.signInWithPassword({
        email: "demo@segevia.local",
        password: "segevia-demo-2026",
      });
      if (signInError) throw signInError;
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} (Asegúrate de haber ejecutado el seed en Supabase)`
          : "Error al ingresar con usuario demo",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-space-md">
      <Card className="max-w-md w-full flex flex-col gap-space-lg">
        <div className="flex flex-col items-center text-center gap-space-xs">
          <img src="/logo.png" alt="SEGEVIA" className="h-12 object-contain mb-1" />
          <p className="text-body-sm text-on-surface-variant">Gestión comercial impulsada por IA</p>
        </div>

        <div className="flex items-center justify-center">
          <Badge tone="human" icon="verified_user">
            Modo Supervisión: Humano en control
          </Badge>
        </div>

        {signupSuccess && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-space-sm text-body-sm text-emerald-800 flex items-start gap-2">
            <Icon name="check_circle" className="text-lg shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-semibold">Revisa tu correo</p>
              <p className="pt-0.5 text-emerald-700">{signupSuccess}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-error-container p-space-sm text-body-sm text-on-error-container flex items-center gap-2">
            <Icon name="error" className="text-lg shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
          {isSignUp && (
            <Field label="Nombre y apellido" hint="Obligatorio">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Mariano Rossi"
                className={inputClass}
              />
            </Field>
          )}

          <Field label="Correo electrónico">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              className={inputClass}
            />
          </Field>

          <Field label="Contraseña">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputClass}
            />
          </Field>

          <Button type="submit" loading={loading} className="w-full mt-2">
            {isSignUp ? "Crear cuenta" : "Iniciar sesión"}
          </Button>
        </form>

        <div className="flex flex-col gap-space-sm pt-space-xs border-t border-hairline">
          <Button
            variant="secondary"
            icon="bolt"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full"
          >
            Acceso Rápido con Demo Local
          </Button>

          <div className="flex flex-col sm:flex-row items-center justify-between text-body-sm text-on-surface-variant gap-2 pt-2">
            <Link to="/" className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1">
              <Icon name="arrow_back" className="text-base" /> Volver al sitio
            </Link>
            {isSignUp ? (
              <span>
                ¿Ya tienes cuenta?{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-primary font-semibold hover:underline"
                >
                  Inicia sesión
                </button>
              </span>
            ) : (
              <span>
                ¿No tienes cuenta?{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="text-primary font-semibold hover:underline"
                >
                  Registrarse
                </button>
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
