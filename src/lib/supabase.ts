import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tmwbujflrgjoivgncbxs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtd2J1amZscmdqb2l2Z25jYnhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MDI2NzksImV4cCI6MjA5MTM3ODY3OX0.avwFL-S9CKhHZD1jQPk0Cu5ECkrzL7LpbL_r6_J9esU';

export const supabase = createClient(supabaseUrl, supabaseKey);
