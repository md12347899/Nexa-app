import { createClient } from "@supabase/supabase-js";

// مفاتيح مشروع نِكسا على Supabase
const SUPABASE_URL = "https://ipgsmcihydhxuqwvvjbe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_h9_zOxVSuJKl5VU5EYi-Aw_cSUPC7Pq";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
