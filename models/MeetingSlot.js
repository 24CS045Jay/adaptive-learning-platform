import { createSupabaseModel } from "../db/supabase-model.js";

export const MeetingSlot = createSupabaseModel("meeting_slots");
export default MeetingSlot;
