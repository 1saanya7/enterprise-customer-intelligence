import { z } from "zod";

export const userSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  email: z.string(),
  tenant_id: z.string(),
  organization: z.string(),
  role: z.string(),
  role_label: z.string(),
  department: z.string(),
  job_title: z.string(),
  active: z.boolean(),
  capabilities: z.array(z.string()),
});
export type User = z.infer<typeof userSchema>;
export const sessionSchema = z.object({
  user: userSchema,
  csrf_token: z.string(),
});
export const workspaceSchema = z.object({
  organization: z.string(),
  name: z.string(),
  environment: z.string(),
  dataset: z.string(),
  data_label: z.string(),
  currency: z.literal("INR"),
  regions: z.array(z.string()),
  periods: z.array(z.object({ value: z.string(), label: z.string() })),
  cloud_enabled: z.boolean(),
  provider: z.string(),
});
export const productSchema = z.object({
  product_id: z.string(),
  product: z.string(),
  category: z.string(),
  previous_revenue: z.number(),
  current_revenue: z.number(),
  units: z.number(),
  change_pct: z.number().nullable(),
});
export const analyticsSchema = z.object({
  currency: z.literal("INR"),
  data_classification: z.string(),
  complete: z.boolean(),
  period_start: z.string(),
  period_end: z.string(),
  baseline_start: z.string(),
  region: z.string(),
  revenue: z.number(),
  previous_revenue: z.number(),
  change_pct: z.number().nullable(),
  declining_products: z.number(),
  units: z.number(),
  products: z.array(productSchema),
  trends: z.array(z.object({ month: z.string(), revenue: z.number() })),
  regions: z.array(z.object({ region: z.string(), revenue: z.number() })),
  complaints: z
    .array(z.object({ category: z.string(), count: z.number() }))
    .nullable(),
});
export type Analytics = z.infer<typeof analyticsSchema>;
export const stepSchema = z.object({
  name: z.string(),
  status: z.enum(["complete", "running", "failed", "blocked", "skipped"]),
  detail: z.string(),
  duration_ms: z.number(),
});
export type Step = z.infer<typeof stepSchema>;
export const investigationSchema = z.object({
  id: z.string(),
  status: z.enum(["complete", "insufficient_evidence"]),
  currency: z.literal("INR"),
  question: z.string(),
  period: z.string(),
  region: z.string(),
  summary: z.string(),
  recommendations: z.array(z.string()),
  created_at: z.string(),
  duration_ms: z.number(),
  products: z.array(
    z.object({
      product_id: z.string(),
      product: z.string(),
      previous_revenue: z.number(),
      current_revenue: z.number(),
      change_pct: z.number(),
      warranty: z.string(),
      complaints: z.array(
        z.object({ category: z.string(), count: z.number() }),
      ),
      evidence_ids: z.array(z.string()),
    }),
  ),
  evidence: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      title: z.string(),
      excerpt: z.string(),
      source: z.string(),
    }),
  ),
  trace: z.array(stepSchema),
});
export type Investigation = z.infer<typeof investigationSchema>;
export const historySchema = z.array(
  z.object({
    id: z.string(),
    question: z.string(),
    created_at: z.string(),
    status: z.string(),
    duration_ms: z.number(),
    region: z.string(),
  }),
);
export const runsSchema = z.array(
  z.object({
    id: z.string(),
    user_id: z.string().optional(),
    user_name: z.string().nullable().optional(),
    status: z.string(),
    started_at: z.string(),
    duration_ms: z.number().nullable(),
    result_id: z.string().nullable(),
    error: z.string().nullable(),
  }),
);
export const agentsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    provider: z.string(),
    model: z.string().nullable(),
    status: z.string(),
    tools: z.array(z.string()),
    runs: z.number(),
    average_ms: z.number().nullable(),
    last_execution: z.string().nullable(),
    cost_inr: z.number(),
    scope: z.string(),
  }),
);
export const operationsSchema = z.object({
  window: z.string(),
  execution_count: z.number(),
  success_rate: z.number().nullable(),
  failed_count: z.number(),
  active_users: z.number(),
  api_requests: z.number(),
  api_error_rate: z.number().nullable(),
  p95_ms: z.number().nullable(),
  model_tokens: z.number(),
  ai_cost_inr: z.number(),
  infrastructure_cost_inr: z.number().nullable(),
  cloud_status: z.string(),
  runs: runsSchema,
  latency: z.array(
    z.object({
      route: z.string(),
      requests: z.number(),
      average_ms: z.number(),
    }),
  ),
});
export const auditSchema = z.array(
  z.object({
    id: z.number(),
    created_at: z.string(),
    name: z.string().nullable(),
    user_id: z.string(),
    action: z.string(),
    outcome: z.string(),
    resource_id: z.string(),
  }),
);
export const usersSchema = z.object({
  users: z.array(userSchema),
  roles: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      capabilities: z.array(z.string()),
    }),
  ),
});
export const streamSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("accepted"), id: z.string() }),
  z.object({ type: z.literal("started"), id: z.string(), message: z.string() }),
  stepSchema.extend({ type: z.literal("step") }),
  z.object({ type: z.literal("result"), result: investigationSchema }),
  z.object({ type: z.literal("error"), id: z.string(), message: z.string() }),
]);
export type StreamEvent = z.infer<typeof streamSchema>;
export type InvestigationInput = {
  question: string;
  decline_threshold: number;
  as_of: string;
  region: string;
};
