import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hehyoqnfdsdrhutkjomn.supabase.co';
const supabaseKey = 'sb_publishable_fE4VZysLI6ghz1X0XuFE_Q_rAF2paHY';

export const supabase = createClient(supabaseUrl, supabaseKey);
