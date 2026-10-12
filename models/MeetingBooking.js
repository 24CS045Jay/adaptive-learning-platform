import { createSupabaseModel } from "../db/supabase-model.js";

export const MeetingBooking = createSupabaseModel("meeting_bookings");
export default MeetingBooking;
