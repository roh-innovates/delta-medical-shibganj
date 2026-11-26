/* =====================================================================
 * Delta Medical Center & Mother and Child Hospital — Waiting Room TV Board
 * - Reuses public.doctors via shared window.supabaseClient
 * - Instant Supabase Realtime updates (<1s) + 30s self-healing fallback poll
 * - Soft synthesized Web Audio API hospital announcement chime on +1 Next
 * - Dark / Light theme toggle, Fullscreen toggle, Screen Wake Lock
 * ===================================================================== */
(function () {
  "use strict";

  var THEME_KEY = "dmc-tv-theme";
  var SOUND_KEY = "dmc-tv-sound";

  var doctors = [];
  var lastKnownSerials = {};
  var isInitialLoad = true;
  var recentlyFlashedIds = {};
  var spotlightTimer = null;
  var realtimeChannel = null;
  var realtimeDebounce = null;
  var wakeLockSentinel = null;
  var lastRenderedDate = "";

  // Sound state
  var soundEnabled = true;
  var audioCtx = null;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toBanglaDigits(val) {
    var map = { "0": "০", "1": "১", "2": "২", "3": "৩", "4": "৪", "5": "৫", "6": "৬", "7": "৭", "8": "৮", "9": "৯" };
    return String(val == null ? "" : val).replace(/[0-9]/g, function (d) { return map[d] || d; });
  }

  function todayLocalIso() {
    return new Date().toLocaleDateString("en-CA");
  }

  function formatSerialCode(serialNo) {
    var n = parseInt(serialNo, 10);
    if (isNaN(n) || n <= 0) return "";
    return "SL-" + String(n).padStart(2, "0");
  }

  function isRunningToday(doc, today) {
    return (
      doc &&
      String(doc.queue_updated_date || "").slice(0, 10) === today &&
      Number(doc.current_serial || 0) > 0
    );
  }

  /* ------------ Soft Hospital Chime (Web Audio API, Zero External Files) ------------ */
  function ensureAudioContext() {
    if (audioCtx) return audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      audioCtx = new Ctx();
    } catch (e) {
      audioCtx = null;
    }
    return audioCtx;
  }

  function updateSoundUI() {
    var icon = $("tvSoundIcon");
    var label = $("tvSoundLabel");
    var hintBar = $("tvAudioHintBar");
    var needsUnlock = soundEnabled && (!audioCtx || audioCtx.state === "suspended");

    if (icon) icon.textContent = soundEnabled ? "🔊" : "🔇";
    if (label) {
      if (!soundEnabled) label.textContent = "শব্দ বন্ধ";
      else if (needsUnlock) label.textContent = "শব্দ চালু করুন";
      else label.textContent = "শব্দ চালু";
    }
    if (hintBar) {
      hintBar.classList.toggle("hidden", !needsUnlock);
    }
  }

  function unlockAudio(playTestChime) {
    var ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended" && typeof ctx.resume === "function") {
      ctx.resume()
        .then(function () {
          updateSoundUI();
          if (playTestChime && soundEnabled) playHospitalChime();
        })
        .catch(function () {
          updateSoundUI();
        });
    } else {
      updateSoundUI();
      if (playTestChime && soundEnabled) playHospitalChime();
    }
  }

  function playHospitalChime() {
    if (!soundEnabled) return;
    var ctx = ensureAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      updateSoundUI();
      return;
    }

    try {
      var now = ctx.currentTime + 0.02;
      // Gentle warm 3-note hospital chime: C5 -> E5 -> G5
      var notes = [
        { freq: 523.25, start: 0.0,  dur: 0.55, vol: 0.16 },
        { freq: 659.25, start: 0.18, dur: 0.60, vol: 0.16 },
        { freq: 783.99, start: 0.36, dur: 0.85, vol: 0.18 }
      ];

      notes.forEach(function (n) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(n.freq, now + n.start);

        gain.gain.setValueAtTime(0.0001, now + n.start);
        gain.gain.linearRampToValueAtTime(n.vol, now + n.start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.04);
      });
    } catch (e) {
      /* ignore audio playback errors */
    }
  }

  /* ------------ Theme (Dark / Light) & Fullscreen & Wake Lock ------------ */
  function applyTheme(theme) {
    var mode = theme === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", mode);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "light" ? "#f1f5f9" : "#061322");
    var icon = $("tvThemeIcon");
    if (icon) icon.textContent = mode === "light" ? "🌙" : "☀️";
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch (e) { /* ignore */ }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  function toggleFullscreen() {
    var docEl = document.documentElement;
    if (!document.fullscreenElement) {
      var req = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
      if (req) {
        try { req.call(docEl); } catch (e) { /* ignore */ }
      }
    } else {
      var exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) {
        try { exit.call(document); } catch (e) { /* ignore */ }
      }
    }
  }

  function updateFullscreenIcon() {
    var icon = $("tvFsIcon");
    if (icon) icon.textContent = document.fullscreenElement ? "🗗" : "⛶";
  }

  function requestWakeLock() {
    if (!("wakeLock" in navigator) || !navigator.wakeLock || typeof navigator.wakeLock.request !== "function") {
      return;
    }
    navigator.wakeLock
      .request("screen")
      .then(function (sentinel) {
        wakeLockSentinel = sentinel;
      })
      .catch(function () { /* wake lock optional */ });
  }

  /* ------------ Live Bangla Clock & Midnight Rollover ------------ */
  function updateClock() {
    var now = new Date();
    var clockEl = $("tvClock");
    var dateEl = $("tvDate");

    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString("bn-BD", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString("bn-BD", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }

    // Automatically refresh board if calendar date rolls past midnight
    var today = todayLocalIso();
    if (lastRenderedDate && lastRenderedDate !== today) {
      lastKnownSerials = {};
      isInitialLoad = true;
      renderBoard();
    }
  }

  /* ------------ Spotlight Callout Banner ------------ */
  function showSpotlight(doc, serialNum) {
    var wrap = $("tvSpotlightWrap");
    var docEl = $("tvSpotlightDoctor");
    var metaEl = $("tvSpotlightMeta");
    var slEl = $("tvSpotlightSerial");
    if (!wrap || !doc) return;

    var slCode = formatSerialCode(serialNum) || "SL-01";
    var nameBn = doc.name_bn || doc.name_en || "—";
    var metaParts = [];
    if (doc.specialty_bn || doc.specialty_en) metaParts.push(doc.specialty_bn || doc.specialty_en);
    if (doc.room_no) metaParts.push("কক্ষ নং: " + doc.room_no);

    if (docEl) docEl.textContent = nameBn;
    if (metaEl) metaEl.textContent = metaParts.join("  ·  ") || "ডেলটা মেডিকেল সেন্টার";
    if (slEl) slEl.textContent = slCode;

    // Restart slide animation smoothly on rapid successive +1 taps
    wrap.classList.add("hidden");
    void wrap.offsetWidth;
    wrap.classList.remove("hidden");

    if (spotlightTimer) clearTimeout(spotlightTimer);
    spotlightTimer = setTimeout(function () {
      wrap.classList.add("hidden");
      spotlightTimer = null;
    }, 8500);
  }

  /* ------------ Adaptive TV Grid Sizing & Board Renderer ------------ */
  function getRunningGridSpec(count) {
    if (count === 1) {
      return {
        gridClass: "grid gap-6 grid-cols-1 max-w-4xl mx-auto w-full",
        cardPad: "p-7 sm:p-10",
        nameCls: "text-2xl sm:text-4xl lg:text-5xl",
        specCls: "text-base sm:text-xl",
        slCls: "text-7xl sm:text-8xl lg:text-9xl",
        slPad: "px-8 py-6 sm:py-8"
      };
    }
    if (count === 2) {
      return {
        gridClass: "grid gap-5 sm:gap-6 grid-cols-1 md:grid-cols-2",
        cardPad: "p-6 sm:p-8",
        nameCls: "text-2xl sm:text-3xl lg:text-4xl",
        specCls: "text-sm sm:text-lg",
        slCls: "text-6xl sm:text-7xl xl:text-8xl",
        slPad: "px-6 py-5 sm:py-6"
      };
    }
    if (count <= 4) {
      return {
        gridClass: "grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2",
        cardPad: "p-5 sm:p-7",
        nameCls: "text-xl sm:text-2xl lg:text-3xl",
        specCls: "text-sm sm:text-base",
        slCls: "text-5xl sm:text-6xl xl:text-7xl",
        slPad: "px-5 py-4 sm:py-5"
      };
    }
    if (count <= 6) {
      return {
        gridClass: "grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
        cardPad: "p-5 sm:p-6",
        nameCls: "text-xl sm:text-2xl",
        specCls: "text-xs sm:text-sm",
        slCls: "text-5xl xl:text-6xl",
        slPad: "px-4 py-4"
      };
    }
    return {
      gridClass: "grid gap-3.5 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
      cardPad: "p-4 sm:p-5",
      nameCls: "text-lg sm:text-xl",
      specCls: "text-xs sm:text-sm",
      slCls: "text-4xl xl:text-5xl",
      slPad: "px-4 py-3.5"
    };
  }

  function renderBoard() {
    var today = todayLocalIso();
    lastRenderedDate = today;

    var loadingEl = $("tvLoading");
    var runningSection = $("tvRunningSection");
    var runningGrid = $("tvRunningGrid");
    var idleHero = $("tvIdleHero");
    var standbySection = $("tvStandbySection");
    var standbyGrid = $("tvStandbyGrid");
    var standbyHeading = $("tvStandbyHeading");
    var liveSummary = $("tvLiveSummary");
    var syncStamp = $("tvSyncStamp");

    if (loadingEl) loadingEl.classList.add("hidden");

    var runningDocs = [];
    var standbyDocs = [];
    doctors.forEach(function (doc) {
      if (isRunningToday(doc, today)) runningDocs.push(doc);
      else standbyDocs.push(doc);
    });

    if (liveSummary) {
      liveSummary.textContent = runningDocs.length > 0
        ? toBanglaDigits(runningDocs.length) + "টি চেম্বার চালু"
        : "সব চেম্বার অপেক্ষমাণ";
    }

    if (syncStamp) {
      syncStamp.textContent =
        "সর্বশেষ আপডেট: " +
        new Date().toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit", second: "2-digit" });
    }

    // 1. Running Chambers
    if (runningDocs.length > 0) {
      if (idleHero) idleHero.classList.add("hidden");
      if (runningSection) runningSection.classList.remove("hidden");

      var spec = getRunningGridSpec(runningDocs.length);
      if (runningGrid) {
        runningGrid.className = spec.gridClass;
        runningGrid.innerHTML = runningDocs.map(function (doc) {
          var idStr = String(doc.id);
          var isFlashing = !!recentlyFlashedIds[idStr];
          var slCode = formatSerialCode(doc.current_serial);
          var nameBn = doc.name_bn || doc.name_en || "—";
          var nameEn = doc.name_en && doc.name_en !== doc.name_bn ? doc.name_en : "";
          var specialty = doc.specialty_bn || doc.specialty_en || "";
          var roomNo = String(doc.room_no || "").trim();

          return (
            '<article class="tv-card rounded-2xl sm:rounded-3xl ' + spec.cardPad +
              (isFlashing ? " tv-card-flash" : "") + ' flex flex-col justify-between gap-4 min-w-0">' +
              '<div class="flex items-center justify-between gap-2 flex-wrap">' +
                '<span class="tv-accent-pill inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs sm:text-sm font-extrabold">' +
                  '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>' +
                  "<span>চলমান সিরিয়াল</span>" +
                "</span>" +
                (roomNo
                  ? '<span class="tv-room-badge inline-flex items-center rounded-xl px-3 py-1 text-xs sm:text-sm lg:text-base font-extrabold whitespace-nowrap">' +
                      "কক্ষ নং: " + escapeHtml(roomNo) +
                    "</span>"
                  : "") +
              "</div>" +

              '<div class="min-w-0">' +
                '<h3 class="font-bold leading-snug ' + spec.nameCls + ' break-words">' +
                  escapeHtml(nameBn) +
                "</h3>" +
                (nameEn
                  ? '<p class="tv-muted font-num text-xs sm:text-sm font-semibold mt-0.5 truncate">' + escapeHtml(nameEn) + "</p>"
                  : "") +
                (specialty
                  ? '<p class="tv-muted font-semibold mt-1 ' + spec.specCls + ' truncate">' + escapeHtml(specialty) + "</p>"
                  : "") +
              "</div>" +

              '<div class="tv-sl-box rounded-2xl ' + spec.slPad + ' flex items-center justify-between gap-3">' +
                '<div class="leading-tight">' +
                  '<p class="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-emerald-200/90">NOW SERVING</p>' +
                  '<p class="text-xs sm:text-sm font-semibold text-emerald-100 mt-0.5">বর্তমান সিরিয়াল</p>' +
                "</div>" +
                '<p class="font-num font-black tracking-tight leading-none ' + spec.slCls + (isFlashing ? " tv-sl-pop" : "") + '">' +
                  escapeHtml(slCode) +
                "</p>" +
              "</div>" +
            "</article>"
          );
        }).join("");
      }
    } else {
      if (runningSection) runningSection.classList.add("hidden");
      if (idleHero) idleHero.classList.remove("hidden");
    }

    // 2. Standby Chambers (Compact below running cards, or full list when idle)
    if (standbyDocs.length > 0 && standbySection && standbyGrid) {
      standbySection.classList.remove("hidden");
      if (standbyHeading) {
        standbyHeading.textContent = runningDocs.length > 0
          ? "অপেক্ষমাণ চেম্বার (" + toBanglaDigits(standbyDocs.length) + " জন ডাক্তার — চেম্বার শুরু হয়নি)"
          : "আজকের বিশেষজ্ঞ চেম্বার তালিকা (" + toBanglaDigits(standbyDocs.length) + " জন)";
      }

      standbyGrid.innerHTML = standbyDocs.map(function (doc) {
        var nameBn = doc.name_bn || doc.name_en || "—";
        var specText = doc.specialty_bn || doc.specialty_en || "";
        var roomNo = String(doc.room_no || "").trim();
        var hours = String(doc.visiting_hours || "").trim();

        return (
          '<div class="tv-card-standby rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-3 min-w-0">' +
            '<div class="min-w-0 flex-1">' +
              '<p class="font-bold text-sm sm:text-base leading-snug truncate">' + escapeHtml(nameBn) + "</p>" +
              '<p class="tv-muted text-xs truncate mt-0.5">' +
                escapeHtml(specText) +
                (hours ? " · " + escapeHtml(hours) : "") +
              "</p>" +
            "</div>" +
            '<div class="flex flex-col items-end gap-1 shrink-0">' +
              (roomNo
                ? '<span class="tv-room-badge rounded-lg px-2 py-0.5 text-[11px] font-bold whitespace-nowrap">' + escapeHtml(roomNo) + "</span>"
                : "") +
              '<span class="tv-muted text-[11px] font-semibold whitespace-nowrap">চেম্বার শুরু হয়নি</span>' +
            "</div>" +
          "</div>"
        );
      }).join("");
    } else if (standbySection) {
      standbySection.classList.add("hidden");
    }
  }

  /* ------------ Fetch Active Doctors & Detect +1 Next Increments ------------ */
  function setConnectionStatus(state) {
    var badge = $("tvConnectionBadge");
    if (!badge) return;
    if (state === "connected") {
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span><span>Realtime Live</span>';
    } else if (state === "syncing") {
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span><span>Syncing…</span>';
    } else {
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-400"></span><span>Reconnecting…</span>';
    }
  }

  function processIncomingDoctors(rows) {
    var today = todayLocalIso();
    var newlyAdvancedDoc = null;
    var newlyAdvancedSerial = 0;
    var nextKnown = {};

    rows.forEach(function (doc) {
      var key = String(doc.id);
      var serialNow = isRunningToday(doc, today) ? Number(doc.current_serial || 0) : 0;
      nextKnown[key] = serialNow;

      if (!isInitialLoad) {
        var prev = lastKnownSerials[key] || 0;
        if (serialNow > prev) {
          newlyAdvancedDoc = doc;
          newlyAdvancedSerial = serialNow;
          recentlyFlashedIds[key] = true;
          (function (flashKey) {
            setTimeout(function () {
              delete recentlyFlashedIds[flashKey];
              renderBoard();
            }, 3400);
          })(key);
        }
      }
    });

    doctors = rows;
    lastKnownSerials = nextKnown;
    isInitialLoad = false;

    renderBoard();

    if (newlyAdvancedDoc && newlyAdvancedSerial > 0) {
      playHospitalChime();
      showSpotlight(newlyAdvancedDoc, newlyAdvancedSerial);
    }
  }

  function fetchActiveDoctors() {
    var errBox = $("tvError");
    var errMsg = $("tvErrorMsg");

    if (!window.supabaseClient) {
      if (errBox) errBox.classList.remove("hidden");
      if (errMsg) errMsg.textContent = "Supabase client লোড হয়নি — ইন্টারনেট সংযোগ পরীক্ষা করুন।";
      return Promise.resolve();
    }

    return window.supabaseClient
      .from("doctors")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("id", { ascending: true })
      .then(function (res) {
        if (res.error) {
          if (errBox) errBox.classList.remove("hidden");
          if (errMsg) errMsg.textContent = "ডাটাবেজ ত্রুটি: " + res.error.message;
          setConnectionStatus("error");
          return;
        }
        if (errBox) errBox.classList.add("hidden");
        var rows = Array.isArray(res.data) ? res.data : [];
        processIncomingDoctors(rows);
      })
      .catch(function () {
        if (errBox) errBox.classList.remove("hidden");
        setConnectionStatus("error");
      });
  }

  function startRealtime() {
    if (!window.supabaseClient || realtimeChannel || typeof window.supabaseClient.channel !== "function") {
      return;
    }
    setConnectionStatus("syncing");
    try {
      realtimeChannel = window.supabaseClient
        .channel("tv-waiting-room-board")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "doctors" },
          function () {
            if (realtimeDebounce) clearTimeout(realtimeDebounce);
            realtimeDebounce = setTimeout(function () {
              realtimeDebounce = null;
              fetchActiveDoctors();
            }, 180);
          }
        )
        .subscribe(function (status) {
          if (status === "SUBSCRIBED") setConnectionStatus("connected");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnectionStatus("error");
        });
    } catch (e) {
      setConnectionStatus("error");
    }
  }

  /* ------------ Boot ------------ */
  function init() {
    // Restore theme & sound preference
    var savedTheme = "dark";
    try {
      savedTheme = localStorage.getItem(THEME_KEY) || "dark";
      var savedSound = localStorage.getItem(SOUND_KEY);
      if (savedSound === "off") soundEnabled = false;
    } catch (e) { /* ignore */ }
    applyTheme(savedTheme);

    var hostEl = $("tvSiteHost");
    if (hostEl && window.location && window.location.host) {
      hostEl.textContent = window.location.host;
    }

    // Wire buttons
    var soundBtn = $("tvSoundBtn");
    if (soundBtn) {
      soundBtn.addEventListener("click", function () {
        if (soundEnabled && (!audioCtx || audioCtx.state === "suspended")) {
          // First click unlocks audio & plays a pleasant confirmation chime
          unlockAudio(true);
          return;
        }
        soundEnabled = !soundEnabled;
        try {
          localStorage.setItem(SOUND_KEY, soundEnabled ? "on" : "off");
        } catch (e) { /* ignore */ }
        if (soundEnabled) unlockAudio(true);
        else updateSoundUI();
      });
    }

    var hintBar = $("tvAudioHintBar");
    if (hintBar) {
      hintBar.addEventListener("click", function () {
        soundEnabled = true;
        unlockAudio(true);
      });
    }

    // Auto-unlock Web Audio on first user interaction anywhere outside dedicated sound controls
    document.addEventListener("pointerdown", function (e) {
      if (e.target && e.target.closest && e.target.closest("#tvSoundBtn, #tvAudioHintBar")) return;
      if (soundEnabled && (!audioCtx || audioCtx.state === "suspended")) {
        unlockAudio(false);
      }
    }, { passive: true });

    var themeBtn = $("tvThemeBtn");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

    var fsBtn = $("tvFullscreenBtn");
    if (fsBtn) fsBtn.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", updateFullscreenIcon);

    // Expose helpers on window for standard script compatibility
    window.tvToggleTheme = toggleTheme;
    window.tvToggleFullscreen = toggleFullscreen;
    window.tvPlayChime = playHospitalChime;

    // Start clock, audio UI, Wake Lock, initial load & Realtime
    updateClock();
    setInterval(updateClock, 1000);
    updateSoundUI();
    requestWakeLock();

    fetchActiveDoctors();
    startRealtime();

    // Self-healing 30s backup sync + reconnect on network/tab recovery
    setInterval(fetchActiveDoctors, 30000);
    window.addEventListener("online", fetchActiveDoctors);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        fetchActiveDoctors();
        requestWakeLock();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
