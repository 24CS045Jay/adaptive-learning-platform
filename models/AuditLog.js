import { createSupabaseModel } from "../db/supabase-model.js";
export const AuditLog = createSupabaseModel("audit_logs");
