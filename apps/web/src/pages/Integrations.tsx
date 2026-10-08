import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { useActiveTenant } from "../tenant/TenantProvider";
import { isDemoTenant } from "../lib/demo";
import { Badge, Button, Card, Icon } from "../components/ui";

interface BaseIntegration {
  provider: string;
  name: string;
  category: "LLM" | "Canal" | "Búsqueda e Imagen" | "CRM" | "Telefonía";
  description: string;
  defaultDemoStatus: "connected" | "disconnected";
}

const BASE_INTEGRATIONS: BaseIntegration[] = [
  {
    provider: "openrouter",
    name: "OpenRouter Gateway",
    category: "LLM",
    description: "Gateway multimodelo unificado (Claude 3.5 Sonnet, GPT-4o, Gemini 2.5).",
    defaultDemoStatus: "connected",
  },
  {
    provider: "google",
    name: "Google Gemini 2.5 Flash",
    category: "LLM",
    description: "Modelo directo de ultra baja latencia para RAG y respuestas rápidas.",
    defaultDemoStatus: "connected",
  },
  {
    provider: "tavily",
    name: "Tavily Search API",
    category: "Búsqueda e Imagen",
    description: "Búsqueda y rastreo de tendencias del sector en tiempo real para Content Studio.",
    defaultDemoStatus: "connected",
  },
  {
    provider: "fal",
    name: "Fal.ai (Flux Pro)",
    category: "Búsqueda e Imagen",
    description: "Motor de síntesis visual hiperrealista para publicaciones de LinkedIn e Instagram.",
    defaultDemoStatus: "connected",
  },
  {
    provider: "meta",
    name: "WhatsApp Cloud API & Instagram",
    category: "Canal",
    description: "Conexión a Meta Business Manager para conversaciones automáticas y publicaciones.",
    defaultDemoStatus: "disconnected",
  },
  {
    provider: "linkedin",
    name: "LinkedIn API",
    category: "Canal",
    description: "Publicación directa y métricas de alcance en perfiles de empresa o personales.",
    defaultDemoStatus: "disconnected",
  },
  {
    provider: "crm",
    name: "CRM Propietario / Hubspot",
    category: "CRM",
    description: "Sincronización bidireccional de leads, estados BANT y notas de interacciones.",
    defaultDemoStatus: "disconnected",
  },
  {
    provider: "vapi",
    name: "Vapi / Retell (Telefonía IA)",
    category: "Telefonía",
    description: "Infraestructura para llamadas entrantes y campañas de calificación por voz.",
    defaultDemoStatus: "disconnected",
  },
];

export function Integrations() {
  const { session } = useAuth();
  const { tenant } = useActiveTenant();
  const queryClient = useQueryClient();
  const isDemo = isDemoTenant(tenant, session?.user?.email);

  const [savingProvider, setSavingProvider] = useState<string | null>(null);

  // Leer estado real de integraciones en Supabase
  const { data: dbIntegrations = [], isLoading } = useQuery({
    queryKey: ["tenant", tenant.id, "integrations"],
    queryFn: async () => {
      const { data, error } = await db()
        .from("integrations")
        .select("*")
        .eq("tenant_id", tenant.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mutación para conectar / desconectar en Supabase
  const toggleMutation = useMutation({
    mutationFn: async ({
      provider,
      name,
      currentStatus,
    }: {
      provider: string;
      name: string;
      currentStatus: string;
    }) => {
      setSavingProvider(provider);
      const newStatus = currentStatus === "connected" ? "disconnected" : "connected";

      const { error } = await db()
        .from("integrations")
        .upsert(
          {
            tenant_id: tenant.id,
            provider,
            display_name: name,
            status: newStatus,
            last_synced_at: newStatus === "connected" ? new Date().toISOString() : null,
          },
          { onConflict: "tenant_id,provider,external_account_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", tenant.id, "integrations"] });
      setSavingProvider(null);
    },
    onError: (err) => {
      alert("Error al actualizar integración: " + (err instanceof Error ? err.message : "Desconocido"));
      setSavingProvider(null);
    },
  });

  return (
    <div className="flex flex-col gap-space-lg pb-12">
      {isDemo && (
        <div className="flex items-center justify-between p-3.5 px-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-body-sm">
          <div className="flex items-center gap-2.5">
            <Icon name="info" className="text-amber-600 text-lg shrink-0" />
            <span>
              <strong>Modo Demostración:</strong> Mostrando configuración de integraciones precargadas de prueba.
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-xs font-semibold text-secondary bg-secondary-fixed/40 px-2 py-0.5 rounded-full uppercase">
              Release 0 · Conectores de Ecosistema
            </span>
          </div>
          <h1 className="font-headline text-headline-lg font-bold text-on-surface">Integraciones</h1>
          <p className="text-body-md text-on-surface-variant">
            Conecta canales de mensajería, pasarelas de LLM y herramientas de datos para tu organización {tenant.name}.
          </p>
        </div>

        <Badge tone="human" icon="shield">
          Cifrado Vault Seguro
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
        {BASE_INTEGRATIONS.map((item) => {
          const dbRecord = dbIntegrations.find((r) => r.provider === item.provider);
          const isConnected = isDemo
            ? item.defaultDemoStatus === "connected"
            : dbRecord
            ? dbRecord.status === "connected"
            : false;

          const isPending = savingProvider === item.provider;

          return (
            <Card key={item.provider} className="flex flex-col justify-between gap-space-md">
              <div className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <span className="text-label-sm font-semibold uppercase text-outline">
                    {item.category}
                  </span>
                  {isConnected ? (
                    <Badge tone="verified" icon="check_circle">
                      Conectado
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Desconectado</Badge>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="font-headline text-headline-sm font-bold text-on-surface">
                    {item.name}
                  </h3>
                  <p className="text-body-sm text-on-surface-variant">{item.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-space-xs border-t border-hairline">
                <span className="text-body-sm text-outline">
                  {isConnected ? "Sincronización activa" : "Sin credencial asociada"}
                </span>

                <Button
                  variant={isConnected ? "secondary" : "primary"}
                  loading={isPending}
                  onClick={() => {
                    toggleMutation.mutate({
                      provider: item.provider,
                      name: item.name,
                      currentStatus: isConnected ? "connected" : "disconnected",
                    });
                  }}
                >
                  {isConnected ? "Desconectar" : "Conectar"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
