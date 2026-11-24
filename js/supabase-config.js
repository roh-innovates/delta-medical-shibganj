/* =====================================================================
 * Delta Medical Center — Shared Supabase Configuration
 * Uses @supabase/supabase-js@2 loaded via CDN before this script.
 * ===================================================================== */
(function () {
  "use strict";

  var SUPABASE_URL = "https://zslaypyrgstkfljplcsp.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_hg0RWNXQE5yIp-GPuDV6kw_zsY6OWoH";

  window.SUPABASE_CONFIG = {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    table: "appointments"
  };

  if (window.supabase && typeof window.supabase.createClient === "function") {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error("Supabase JS SDK (@supabase/supabase-js@2) failed to load from CDN.");
    window.supabaseClient = null;
  }
})();
