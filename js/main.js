/* =====================================================================
 * Delta Medical Center & Mother and Child Hospital — Main UI Script
 * - Renders Doctor Chamber Directory with specialty, day & text filters
 * - Handles Bangla / English switch, poster lightbox, mobile navigation
 * - Validates Serial Request Form and opens pre-filled WhatsApp message
 *   to 01724-363838 (https://wa.me/8801724363838)
 * ===================================================================== */
(function () {
  "use strict";

  var WA_NUMBER = "8801724363838";
  var JS_DAY_TO_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var todayKey = JS_DAY_TO_KEY[new Date().getDay()];

  var state = {
    search: "",
    specialty: "all",
    day: "all"
  };

  var DEPARTMENTS = [
    { id: "dept:mch",   key: "svc.mch.title", enName: "Mother & Child Care",     defaultDoc: "Duty Doctor" },
    { id: "dept:gynae", key: "svc.gynae.title", enName: "Gynecology & Obstetrics", defaultDoc: "Duty Doctor" },
    { id: "dept:peds",  key: "svc.peds.title",  enName: "Pediatrics",              defaultDoc: "Duty Doctor" },
    { id: "dept:usg",   key: "svc.usg.title",   enName: "4D Ultrasonography",      defaultDoc: "Diagnostic Unit" },
    { id: "dept:xray",  key: "svc.xray.title",  enName: "Digital X-Ray",           defaultDoc: "Diagnostic Unit" },
    { id: "dept:lab",   key: "svc.lab.title",   enName: "Pathology Lab",           defaultDoc: "Diagnostic Unit" },
    { id: "dept:em",    key: "svc.em.title",    enName: "24/7 Emergency",          defaultDoc: "Duty Doctor" }
  ];

  var LAST_PHONE_KEY = "dmc-last-phone";
  var lastFormResult = null;
  var isSubmitting = false;
  var activeSerialTab = "book";
  var lastLookupState = null;
  var isLookingUp = false;
  var publicRealtimeChannel = null;
  var realtimeDebounceTimer = null;

  // Live doctor list (starts with fallback hardcoded list, replaced on load if Supabase `doctors` has rows)
  var activeDoctors = Array.isArray(window.DOCTORS) ? window.DOCTORS.slice() : [];
  var activeSpecialties = Object.assign({}, window.SPECIALTIES || {});

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

  function todayIso() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  /* ------------ Supabase `doctors` Mapping & Helpers ------------ */
  function parseVisitingDays(rawDays) {
    var text = Array.isArray(rawDays) ? rawDays.join(", ") : String(rawDays || "").trim();
    var lower = text.toLowerCase();

    if (!text) {
      return { daily: false, days: [], rawLabel: "" };
    }

    if (
      /প্রতিদিন|সপ্তাহে\s*[৭7]\s*দিন|daily|every\s*day|everyday|all\s*days|7\s*days/i.test(text)
    ) {
      return { daily: true, days: ["sat", "sun", "mon", "tue", "wed", "thu", "fri"], rawLabel: text };
    }

    var dayPatterns = [
      { key: "sat", re: /শনি|\bsat(?:urday)?\b/i },
      { key: "sun", re: /রবি|\bsun(?:day)?\b/i },
      { key: "mon", re: /সোম|\bmon(?:day)?\b/i },
      { key: "tue", re: /মঙ্গল|\btue(?:s|sday)?\b/i },
      { key: "wed", re: /বুধ|\bwed(?:nesday)?\b/i },
      { key: "thu", re: /বৃহস্পতি|\bthu(?:r|rs|rsday)?\b/i },
      { key: "fri", re: /শুক্র|\bfri(?:day)?\b/i }
    ];

    var matched = [];
    dayPatterns.forEach(function (p) {
      if (p.re.test(text) || p.re.test(lower)) matched.push(p.key);
    });

    return { daily: false, days: matched, rawLabel: text };
  }

  function resolveSpecialtyKeys(specBn, specEn, registry) {
    var bn = String(specBn || "").trim();
    var en = String(specEn || "").trim();
    var combined = (bn + " " + en).toLowerCase();
    var baseSpecs = window.SPECIALTIES || {};
    var keys = [];

    var matchers = [
      { key: "gynae",      re: /গাইনি|গাইনী|প্রসূতি|স্ত্রী|gynae|gyne|obstet/i },
      { key: "pedsurgery", re: /শিশু\s*সার্জারি|pediatric\s*surg/i },
      { key: "pediatrics", re: /শিশু|নবজাতক|pediatric|neonat|child|newborn/i },
      { key: "cardiology", re: /হৃদ|কার্ডিও|cardio|heart/i },
      { key: "neuro",      re: /নিউরো|ব্রেইন|নার্ভ|স্ট্রোক|neuro|brain|spine/i },
      { key: "skin",       re: /চর্ম|যৌন|skin|dermat|vd\b/i },
      { key: "ortho",      re: /অর্থো|হাড়|ট্রমা|ortho|trauma/i },
      { key: "eye",        re: /চক্ষু|eye|ophthal/i },
      { key: "dental",     re: /দন্ত|দাঁত|মুখ|ডেন্টাল|ডেন্টিস্ট্রি|ওরাল|ম্যাক্সিলো|dental|dentist|oral|maxillo/i },
      { key: "surgery",    re: /সার্জারি|সার্জারী|সার্জন|surgery|surgeon/i },
      { key: "medicine",   re: /মেডিসিন|medicine/i }
    ];

    matchers.forEach(function (m) {
      if (m.re.test(combined)) {
        if (
          m.key === "surgery" &&
          (keys.indexOf("pedsurgery") !== -1 || keys.indexOf("dental") !== -1) &&
          !/জেনারেল|general/i.test(combined)
        ) {
          return;
        }
        keys.push(m.key);
        if (baseSpecs[m.key]) {
          registry[m.key] = baseSpecs[m.key];
        }
      }
    });

    if (!keys.length && (en || bn)) {
      var slug = "spec-" + (en || bn).toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, "-").replace(/^-|-$/g, "");
      if (!slug || slug === "spec-") slug = "spec-general";
      keys.push(slug);
      registry[slug] = { bn: bn || en, en: en || bn };
    }

    return keys;
  }

  function normalizeDoctorMatchKey(name) {
    var str = String(name || "");
    if (typeof str.normalize === "function") str = str.normalize("NFC");
    return str
      .trim()
      .toLowerCase()
      .replace(/^ডা[.:ঃ]?\s*/, "ডা.")
      .replace(/মো[.:ঃ]\s*/g, "মোঃ ")
      .replace(/^dr\.?\s*/i, "dr.")
      .replace(/\s+/g, " ");
  }

  function findHardcodedPosterMatch(nameBn, nameEn) {
    var fallback = window.DOCTORS || [];
    var enKey = normalizeDoctorMatchKey(nameEn);
    var bnKey = normalizeDoctorMatchKey(nameBn);
    return fallback.find(function (d) {
      return (
        (enKey && d.name && d.name.en && normalizeDoctorMatchKey(d.name.en) === enKey) ||
        (bnKey && d.name && d.name.bn && normalizeDoctorMatchKey(d.name.bn) === bnKey)
      );
    }) || null;
  }

  function mapSupabaseDoctors(rows) {
    var nextSpecs = {};
    var mapped = rows.map(function (row) {
      var specBn = String(row.specialty_bn || "").trim();
      var specEn = String(row.specialty_en || "").trim();
      var specKeys = resolveSpecialtyKeys(specBn, specEn, nextSpecs);
      var parsedDays = parseVisitingDays(row.visiting_days);
      var hoursText = String(row.visiting_hours || "").trim();
      var uploadedPhoto = String(row.photo_url || "").trim();
      var posterMatch = findHardcodedPosterMatch(row.name_bn, row.name_en);

      return {
        id: String(row.id),
        name: {
          bn: String(row.name_bn || row.name_en || "").trim(),
          en: String(row.name_en || row.name_bn || "").trim()
        },
        focus: {
          bn: specBn || specEn,
          en: specEn || specBn
        },
        specialtyLabel: {
          bn: specBn || specEn,
          en: specEn || specBn
        },
        degrees: {
          bn: String(row.qualifications || "").trim(),
          en: String(row.qualifications || "").trim()
        },
        designation: { bn: "", en: "" },
        specialties: specKeys,
        schedule: [
          {
            daily: parsedDays.daily,
            days: parsedDays.days,
            rawDayLabel: parsedDays.rawLabel,
            bn: hoursText,
            en: hoursText
          }
        ],
        room_no: String(row.room_no || "").trim(),
        current_serial: row.current_serial != null ? Number(row.current_serial) : 0,
        queue_updated_date: row.queue_updated_date ? String(row.queue_updated_date).slice(0, 10) : "",
        poster: uploadedPhoto || (posterMatch ? posterMatch.poster : ""),
        isUploadedPhoto: !!uploadedPhoto,
        face: uploadedPhoto ? { x: 50, y: 25 } : (posterMatch ? posterMatch.face : null),
        fromSupabase: true
      };
    });

    return { doctors: mapped, specialties: nextSpecs };
  }

  function formatSerialCode(serialNo) {
    var n = parseInt(serialNo, 10);
    if (isNaN(n) || n <= 0) return "";
    return "SL-" + String(n).padStart(2, "0");
  }

  function todayLocalIso() {
    return new Date().toLocaleDateString("en-CA");
  }

  function isDoctorQueueRunningToday(doc) {
    return doc && doc.queue_updated_date === todayLocalIso() && (Number(doc.current_serial) || 0) > 0;
  }

  var queueTeaserShown = false;
  var queueTeaserTimer = null;

  function hideQueueTeaser() {
    var teaser = $("liveQueueTeaser");
    if (teaser) teaser.classList.add("hidden");
    if (queueTeaserTimer) {
      clearTimeout(queueTeaserTimer);
      queueTeaserTimer = null;
    }
  }

  function scheduleQueueTeaser(hasLive) {
    if (queueTeaserShown) return;
    var teaser = $("liveQueueTeaser");
    var teaserText = $("liveQueueTeaserText");
    var popover = $("liveQueuePopover");
    if (!teaser || !teaserText) return;
    if (popover && !popover.classList.contains("hidden")) return;

    queueTeaserShown = true;
    teaserText.textContent = I18N.t(hasLive ? "queue.teaserLive" : "queue.teaserIdle");
    setTimeout(function () {
      if (popover && !popover.classList.contains("hidden")) return;
      teaser.classList.remove("hidden");
      queueTeaserTimer = setTimeout(hideQueueTeaser, 5500);
    }, 1400);
  }

  function setQueuePopoverOpen(open) {
    var popover = $("liveQueuePopover");
    var fab = $("liveQueueFab");
    if (!popover || !fab) return;
    if (open) hideQueueTeaser();
    popover.classList.toggle("hidden", !open);
    fab.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function renderLiveQueueTicker() {
    var section = $("liveQueueSection");
    var grid = $("liveQueueGrid");
    var timeEl = $("liveQueueTime");
    var popoverList = $("liveQueuePopoverList");
    var fabDot = $("liveQueueFabDot");
    var fabLabel = $("liveQueueFabLabel");
    var widget = $("liveQueueWidget");

    var lang = I18N.lang;

    if (!activeDoctors.length) {
      if (section) section.classList.add("hidden");
      if (widget) widget.classList.add("hidden");
      if (grid) grid.innerHTML = "";
      if (popoverList) popoverList.innerHTML = "";
      return;
    }

    if (widget) widget.classList.remove("hidden");

    // Separate currently running chambers vs standby chambers (preserving display_order)
    var runningDocs = [];
    var standbyDocs = [];
    activeDoctors.forEach(function (doc) {
      if (isDoctorQueueRunningToday(doc)) runningDocs.push(doc);
      else standbyDocs.push(doc);
    });
    var orderedAll = runningDocs.concat(standbyDocs);

    if (timeEl) {
      timeEl.textContent =
        "· " + new Date().toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-US", {
          hour: "numeric",
          minute: "2-digit"
        });
    }

    // 1. Slim top bar: shown ONLY when >= 1 chamber is actively running right now
    if (section && grid) {
      if (runningDocs.length > 0) {
        section.classList.remove("hidden");
        grid.innerHTML = runningDocs.map(function (doc) {
          var docName = doc.name[lang] || doc.name.bn || doc.name.en;
          var slCode = formatSerialCode(doc.current_serial);
          return (
            '<button type="button" data-book-doc="' + escapeHtml(doc.id) + '" ' +
                    'class="inline-flex items-center gap-2.5 rounded-full bg-white hover:bg-emerald-50/80 border border-emerald-200/80 hover:border-emerald-300 pl-3.5 pr-2.5 py-1.5 text-xs sm:text-sm transition shrink-0 cursor-pointer whitespace-nowrap shadow-[0_1px_2px_rgba(16,185,129,0.08)]">' +
              '<span class="font-semibold text-slate-800">' + escapeHtml(docName) + "</span>" +
              '<span class="rounded-full bg-emerald-600 text-white font-bold px-2.5 py-0.5 text-xs tracking-wide">' +
                escapeHtml(slCode) +
              "</span>" +
            "</button>"
          );
        }).join("");
      } else {
        section.classList.add("hidden");
        grid.innerHTML = "";
      }
    }

    // 2. Floating live-green corner pill
    var fabBtn = $("liveQueueFab");
    var teaserText = $("liveQueueTeaserText");
    if (teaserText) {
      teaserText.textContent = I18N.t(runningDocs.length > 0 ? "queue.teaserLive" : "queue.teaserIdle");
    }
    if (fabDot && fabLabel) {
      if (runningDocs.length > 0) {
        fabDot.innerHTML =
          '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-90"></span>' +
          '<span class="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-emerald-400"></span>';
        if (fabBtn) {
          fabBtn.classList.add("live-fab--live");
        }
        if (runningDocs.length === 1) {
          fabLabel.innerHTML =
            '<span class="text-white">চলমান</span> <span class="rounded-full bg-emerald-400 text-emerald-950 font-extrabold px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] leading-none">' +
            escapeHtml(formatSerialCode(runningDocs[0].current_serial)) +
            "</span>";
        } else {
          fabLabel.innerHTML =
            '<span class="text-white">' + escapeHtml(I18N.t("queue.fabIdle")) + "</span> " +
            '<span class="rounded-full bg-emerald-400 text-emerald-950 font-extrabold px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] leading-none">' +
            escapeHtml(I18N.num(runningDocs.length)) +
            "</span>";
        }
      } else {
        fabDot.innerHTML =
          '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>' +
          '<span class="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-emerald-400"></span>';
        if (fabBtn) {
          fabBtn.classList.remove("live-fab--live");
        }
        fabLabel.textContent = I18N.t("queue.fabIdle");
      }
    }
    scheduleQueueTeaser(runningDocs.length > 0);

    // 3. Slide-up popover drawer list (all active doctors, running first)
    if (popoverList) {
      popoverList.innerHTML = orderedAll.map(function (doc) {
        var docName = doc.name[lang] || doc.name.bn || doc.name.en;
        var specText = (doc.specialtyLabel && (doc.specialtyLabel[lang] || doc.specialtyLabel.bn || doc.specialtyLabel.en))
          || (doc.focus && (doc.focus[lang] || doc.focus.bn)) || "";
        var isRunning = isDoctorQueueRunningToday(doc);
        var slCode = formatSerialCode(doc.current_serial);

        var badgeHtml = isRunning
          ? '<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap">' +
              '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>' +
              "<span>চলমান সিরিয়াল: " + escapeHtml(slCode) + "</span>" +
            "</span>"
          : '<span class="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">' +
              "চেম্বার শুরু হয়নি" +
            "</span>";

        return (
          '<div class="rounded-xl bg-white border ' + (isRunning ? "border-emerald-200 shadow-sm" : "border-slate-200/80") + ' p-3 flex items-center justify-between gap-2.5">' +
            '<div class="min-w-0 flex-1">' +
              '<p class="font-bold text-slate-900 text-xs sm:text-sm leading-snug truncate">' + escapeHtml(docName) + "</p>" +
              '<p class="text-[11px] text-slate-500 truncate mt-0.5">' +
                escapeHtml(specText) + (doc.room_no ? " · " + escapeHtml(doc.room_no) : "") +
              "</p>" +
            "</div>" +
            '<div class="flex flex-col items-end gap-1 shrink-0">' +
              badgeHtml +
              '<button type="button" data-book-doc="' + escapeHtml(doc.id) + '" class="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer">' +
                escapeHtml(I18N.t("doc.serial")) + " →" +
              "</button>" +
            "</div>" +
          "</div>"
        );
      }).join("");
    }
  }

  function refreshLiveQueueSilently() {
    if (!window.supabaseClient) return;

    window.supabaseClient
      .from("doctors")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("id", { ascending: true })
      .then(function (res) {
        if (res.error || !Array.isArray(res.data) || !res.data.length) return;
        var mapped = mapSupabaseDoctors(res.data);
        activeDoctors = mapped.doctors;
        renderLiveQueueTicker();
        renderDoctors();
        if (lastLookupState && lastLookupState.type === "results") {
          renderLookupResults();
        }
      })
      .catch(function () { /* silent background poll */ });
  }

  function startPublicLiveQueueRealtime() {
    if (!window.supabaseClient || publicRealtimeChannel || typeof window.supabaseClient.channel !== "function") {
      return;
    }
    try {
      publicRealtimeChannel = window.supabaseClient
        .channel("public-live-queue")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "doctors" },
          function () {
            if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer);
            realtimeDebounceTimer = setTimeout(function () {
              realtimeDebounceTimer = null;
              refreshLiveQueueSilently();
            }, 250);
          }
        )
        .subscribe();
    } catch (e) {
      /* Fallback polling stays active if Realtime is unavailable */
    }
  }

  function applyDoctorDirectoryUpdate(nextDoctors, nextSpecs) {
    activeDoctors = nextDoctors;
    activeSpecialties = nextSpecs && Object.keys(nextSpecs).length
      ? nextSpecs
      : Object.assign({}, window.SPECIALTIES || {});

    if (state.specialty !== "all" && !activeSpecialties[state.specialty]) {
      state.specialty = "all";
    }

    updateLocalizedStatsAndLinks();
    renderSpecialtyControls();
    renderLiveQueueTicker();
    renderDoctors();
    renderFormTargetOptions();
    updateDayHint();
  }

  function loadActiveDoctorsFromSupabase() {
    if (!window.supabaseClient) return;

    window.supabaseClient
      .from("doctors")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("id", { ascending: true })
      .then(function (res) {
        if (res.error) {
          // Keep hardcoded fallback silently if table isn't ready or offline
          return;
        }
        var rows = Array.isArray(res.data) ? res.data : [];
        if (rows.length > 0) {
          var mapped = mapSupabaseDoctors(rows);
          applyDoctorDirectoryUpdate(mapped.doctors, mapped.specialties);
          return;
        }

        // If 0 active rows returned, check whether the `doctors` table itself is empty.
        // Keep hardcoded fallback ONLY if the `doctors` table is currently empty.
        return window.supabaseClient
          .from("doctors")
          .select("id", { count: "exact", head: true })
          .then(function (countRes) {
            if (!countRes.error && typeof countRes.count === "number" && countRes.count > 0) {
              applyDoctorDirectoryUpdate([], window.SPECIALTIES || {});
            }
          });
      })
      .catch(function () {
        /* Fallback to window.DOCTORS on network error */
      });
  }

  function doctorVisitsOnDay(doc, dayKey) {
    if (dayKey === "all") return true;
    return (doc.schedule || []).some(function (slot) {
      if (slot.daily) return true;
      return Array.isArray(slot.days) && slot.days.indexOf(dayKey) !== -1;
    });
  }

  function formatScheduleLines(doc, lang) {
    var labels = window.DAY_LABELS || {};
    return (doc.schedule || []).map(function (slot) {
      var dayPart = "";
      if (slot.daily) {
        dayPart = labels.daily ? labels.daily[lang] : (lang === "bn" ? "প্রতিদিন" : "Daily");
      } else if (Array.isArray(slot.days) && slot.days.length) {
        dayPart = slot.days.map(function (d) {
          return labels[d] ? labels[d][lang] : d;
        }).join(", ");
      } else if (slot.rawDayLabel) {
        dayPart = slot.rawDayLabel;
      }
      var timePart = slot[lang] || slot.bn || slot.en || "";
      return { dayPart: dayPart, timePart: timePart, isDaily: !!slot.daily };
    });
  }

  /* ------------ Render Specialty Filter & More Chips ------------ */
  function renderSpecialtyControls() {
    var lang = I18N.lang;
    var specs = activeSpecialties;
    var select = $("specFilter");
    if (select) {
      var current = state.specialty;
      var html = '<option value="all">' + escapeHtml(I18N.t("doc.allSpecialties")) + "</option>";
      Object.keys(specs).forEach(function (key) {
        var sel = key === current ? " selected" : "";
        html += '<option value="' + escapeHtml(key) + '"' + sel + ">" + escapeHtml(specs[key][lang] || specs[key].en || specs[key].bn) + "</option>";
      });
      select.innerHTML = html;
    }

    var more = $("moreSpecs");
    if (more) {
      more.innerHTML = Object.keys(specs).map(function (key) {
        return (
          '<a href="#doctors" data-filter-spec="' + escapeHtml(key) + '" ' +
          'class="chip">' + escapeHtml(specs[key][lang] || specs[key].en || specs[key].bn) + " →</a>"
        );
      }).join("");
    }
  }

  /* ------------ Render Visiting Day Filter Chips ------------ */
  function renderDayChips() {
    var wrap = $("dayChips");
    if (!wrap) return;
    var lang = I18N.lang;
    var days = window.DAYS || [];
    var labels = window.DAY_LABELS || {};

    var items = [{ key: "all", label: I18N.t("doc.allDays"), isToday: false }];
    days.forEach(function (d) {
      items.push({
        key: d,
        label: labels[d] ? labels[d][lang] : d,
        isToday: d === todayKey
      });
    });

    wrap.innerHTML = items.map(function (item) {
      var active = state.day === item.key;
      var todayBadge = item.isToday
        ? '<span class="chip-today">' + escapeHtml(I18N.t("doc.today")) + "</span>"
        : "";
      return (
        '<button type="button" role="radio" aria-checked="' + (active ? "true" : "false") + '" ' +
        'data-day-chip="' + escapeHtml(item.key) + '" ' +
        'class="chip' + (active ? " is-active" : "") + '">' +
        "<span>" + escapeHtml(item.label) + "</span>" +
        todayBadge +
        "</button>"
      );
    }).join("");
  }

  /* ------------ Filter & Render Doctor Cards ------------ */
  function filterDoctors() {
    var docs = activeDoctors;
    var specs = activeSpecialties;
    var q = state.search.trim().toLowerCase();

    return docs.filter(function (doc) {
      if (state.specialty !== "all") {
        if (!Array.isArray(doc.specialties) || doc.specialties.indexOf(state.specialty) === -1) {
          return false;
        }
      }
      if (!doctorVisitsOnDay(doc, state.day)) {
        return false;
      }
      if (q) {
        var specText = (doc.specialties || []).map(function (s) {
          return specs[s] ? (specs[s].bn || "") + " " + (specs[s].en || "") : "";
        }).join(" ");
        var haystack = [
          doc.name.bn, doc.name.en,
          doc.focus.bn, doc.focus.en,
          doc.degrees.bn, doc.degrees.en,
          doc.designation.bn, doc.designation.en,
          doc.room_no || "",
          specText
        ].join(" ").toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderDoctors() {
    var grid = $("docGrid");
    var empty = $("docEmpty");
    var countEl = $("docCount");
    if (!grid) return;

    var lang = I18N.lang;
    var specs = activeSpecialties;
    var list = filterDoctors();

    if (countEl) {
      countEl.textContent = I18N.t("doc.count", { n: I18N.num(list.length) });
    }

    if (!list.length) {
      grid.innerHTML = "";
      grid.classList.add("hidden");
      if (empty) empty.classList.remove("hidden");
      return;
    }

    grid.classList.remove("hidden");
    if (empty) empty.classList.add("hidden");

    grid.innerHTML = list.map(function (doc) {
      var name = doc.name[lang] || doc.name.bn || doc.name.en;
      var focus = doc.focus[lang] || doc.focus.bn || doc.focus.en;
      var degrees = doc.degrees[lang] || doc.degrees.bn || doc.degrees.en;
      var desig = (doc.designation && (doc.designation[lang] || doc.designation.bn)) || "";
      var faceX = (doc.face && doc.face.x) || 75;
      var faceY = (doc.face && doc.face.y) || 30;
      var hasPoster = !!doc.poster;

      var badgesHtml = "";
      if (doc.specialtyLabel && (doc.specialtyLabel[lang] || doc.specialtyLabel.bn || doc.specialtyLabel.en)) {
        badgesHtml = '<span class="doc-badge">' + escapeHtml(doc.specialtyLabel[lang] || doc.specialtyLabel.bn || doc.specialtyLabel.en) + "</span>";
      } else {
        badgesHtml = (doc.specialties || []).map(function (sp) {
          var label = specs[sp] ? (specs[sp][lang] || specs[sp].en || specs[sp].bn) : sp;
          return '<span class="doc-badge">' + escapeHtml(label) + "</span>";
        }).join(" ");
      }

      var avatarCls = doc.isUploadedPhoto
        ? "doc-avatar doc-avatar--uploaded group relative"
        : "doc-avatar group relative";
      var avatarHtml = hasPoster
        ? '<button type="button" data-poster-doc="' + escapeHtml(doc.id) + '" class="' + avatarCls + '" title="' + escapeHtml(I18N.t("doc.poster")) + '">' +
            '<img src="' + escapeHtml(doc.poster) + '" loading="lazy" decoding="async" ' +
              'style="object-position:' + faceX + "% " + faceY + '%" ' +
              'alt="' + escapeHtml(I18N.t("doc.photoAlt", { name: name })) + '" />' +
          "</button>"
        : '<div class="doc-avatar grid place-items-center text-brand-600" aria-hidden="true">' +
            '<svg class="icon w-8 h-8"><use href="#i-steth"/></svg>' +
          "</div>";

      var schedLines = formatScheduleLines(doc, lang).map(function (line) {
        var pillClass = line.isDaily
          ? "bg-emerald-100 text-emerald-800"
          : "bg-brand-100 text-brand-800";
        return (
          '<div class="flex flex-wrap items-center justify-between gap-1.5">' +
            (line.dayPart
              ? '<span class="inline-block text-xs font-bold px-2 py-0.5 rounded-md ' + pillClass + '">' +
                  escapeHtml(line.dayPart) +
                "</span>"
              : "") +
            '<span class="font-semibold text-slate-700 text-xs sm:text-sm">' +
              escapeHtml(line.timePart) +
            "</span>" +
          "</div>"
        );
      }).join('<div class="my-1 border-t border-slate-200/70"></div>');

      var roomHtml = doc.room_no
        ? '<p class="mt-2 pt-2 border-t border-slate-200/70 text-xs font-semibold text-slate-600 flex items-center gap-1.5">' +
            '<svg class="icon w-3.5 h-3.5 text-brand-600"><use href="#i-pin"/></svg>' +
            '<span>' + escapeHtml(I18N.t("doc.room")) + ": " + escapeHtml(doc.room_no) + "</span>" +
          "</p>"
        : "";

      var liveDocPill = isDoctorQueueRunningToday(doc)
        ? '<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap">' +
            '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>' +
            "<span>চলমান সিরিয়াল: " + escapeHtml(formatSerialCode(doc.current_serial)) + "</span>" +
          "</span>"
        : "";

      return (
        '<article class="doc-card">' +
          '<div class="p-5">' +
            '<div class="flex items-start gap-3.5">' +
              avatarHtml +
              '<div class="min-w-0 flex-1">' +
                '<div class="flex flex-wrap gap-1.5">' + badgesHtml + liveDocPill + "</div>" +
                '<h3 class="mt-1.5 text-[1.2rem] sm:text-xl font-bold text-brand-950 leading-snug">' + escapeHtml(name) + "</h3>" +
                (!doc.fromSupabase && focus ? '<p class="text-xs font-semibold text-delta-600 mt-0.5">' + escapeHtml(focus) + "</p>" : "") +
              "</div>" +
            "</div>" +

            (degrees ? '<p class="mt-3 text-sm font-medium text-slate-700 leading-relaxed">' + escapeHtml(degrees) + "</p>" : "") +
            (desig ? '<p class="mt-1 text-xs text-slate-500 leading-relaxed">' + escapeHtml(desig) + "</p>" : "") +

            '<div class="doc-sched mt-4">' +
              '<p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">' +
                '<svg class="icon w-3.5 h-3.5 text-brand-600"><use href="#i-clock"/></svg>' +
                '<span>' + escapeHtml(I18N.t("doc.schedule")) + "</span>" +
              "</p>" +
              schedLines +
              roomHtml +
            "</div>" +
          "</div>" +

          '<div class="px-5 pb-5 pt-2 flex items-center gap-2 border-t border-slate-100">' +
            '<button type="button" data-book-doc="' + escapeHtml(doc.id) + '" class="btn btn-brand flex-1 justify-center text-sm py-2.5">' +
              '<svg class="icon w-4 h-4"><use href="#i-cal"/></svg>' +
              "<span>" + escapeHtml(I18N.t("doc.serial")) + "</span>" +
            "</button>" +
            '<a href="tel:+8801724363838" class="btn btn-outline text-sm py-2.5 px-3" aria-label="' + escapeHtml(I18N.t("doc.call") + " " + name) + '">' +
              '<svg class="icon w-4 h-4 text-delta-600"><use href="#i-phone"/></svg>' +
              "<span>" + escapeHtml(I18N.t("doc.call")) + "</span>" +
            "</a>" +
            (hasPoster
              ? '<button type="button" data-poster-doc="' + escapeHtml(doc.id) + '" class="btn btn-outline text-sm py-2.5 px-3" title="' + escapeHtml(I18N.t("doc.poster")) + '" aria-label="' + escapeHtml(I18N.t("doc.poster") + " - " + name) + '">' +
                  '<svg class="icon w-4 h-4 text-brand-600"><use href="#i-img"/></svg>' +
                "</button>"
              : "") +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  /* ------------ Populate Serial Form Dropdown ------------ */
  function renderFormTargetOptions() {
    var select = $("fTarget");
    if (!select) return;
    var lang = I18N.lang;
    var prev = select.value;
    var docs = activeDoctors;
    var specs = activeSpecialties;

    var html = '<option value="">' + escapeHtml(I18N.t("form.choose")) + "</option>";

    if (docs.length) {
      html += '<optgroup label="' + escapeHtml(I18N.t("form.groupDoctors")) + '">';
      docs.forEach(function (doc) {
        var spNames = "";
        if (doc.specialtyLabel && (doc.specialtyLabel[lang] || doc.specialtyLabel.bn || doc.specialtyLabel.en)) {
          spNames = doc.specialtyLabel[lang] || doc.specialtyLabel.bn || doc.specialtyLabel.en;
        } else {
          spNames = (doc.specialties || []).map(function (s) {
            return specs[s] ? (specs[s][lang] || specs[s].en || specs[s].bn) : s;
          }).join(", ");
        }
        var label = (doc.name[lang] || doc.name.bn || doc.name.en) + (spNames ? " — " + spNames : "");
        var val = "doc:" + doc.id;
        html += '<option value="' + escapeHtml(val) + '">' + escapeHtml(label) + "</option>";
      });
      html += "</optgroup>";
    }

    html += '<optgroup label="' + escapeHtml(I18N.t("form.groupDepts")) + '">';
    DEPARTMENTS.forEach(function (d) {
      html += '<option value="' + escapeHtml(d.id) + '">' + escapeHtml(I18N.t(d.key)) + "</option>";
    });
    html += "</optgroup>";

    select.innerHTML = html;
    if (prev) select.value = prev;
  }

  /* ------------ Update Day Hint in Serial Form ------------ */
  function updateDayHint() {
    var hint = $("dayHint");
    var dateInput = $("fDate");
    var targetSelect = $("fTarget");
    if (!hint || !dateInput || !targetSelect) return;

    var lang = I18N.lang;
    var val = dateInput.value;
    if (!val) {
      hint.textContent = "";
      hint.className = "mt-2 text-sm";
      return;
    }

    var parts = val.split("-");
    var dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    if (isNaN(dt.getTime())) {
      hint.textContent = "";
      return;
    }

    var dayKey = JS_DAY_TO_KEY[dt.getDay()];
    var dayLabels = window.DAY_LABELS || {};
    var dayName = dayLabels[dayKey] ? dayLabels[dayKey][lang] : dayKey;

    var target = targetSelect.value || "";
    if (target.indexOf("doc:") === 0) {
      var docId = target.slice(4);
      var doc = activeDoctors.find(function (d) { return String(d.id) === String(docId); });
      if (doc && !doctorVisitsOnDay(doc, dayKey)) {
        var visitDays = [];
        (doc.schedule || []).forEach(function (slot) {
          if (Array.isArray(slot.days) && slot.days.length) {
            slot.days.forEach(function (d) {
              var lbl = dayLabels[d] ? dayLabels[d][lang] : d;
              if (visitDays.indexOf(lbl) === -1) visitDays.push(lbl);
            });
          } else if (slot.rawDayLabel) {
            visitDays.push(slot.rawDayLabel);
          }
        });
        if (visitDays.length) {
          hint.className = "mt-2 text-xs sm:text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2";
          hint.textContent = I18N.t("form.warnDay", {
            doctor: doc.name[lang] || doc.name.bn || doc.name.en,
            days: visitDays.join(", ")
          });
          return;
        }
      }
    }

    hint.className = "mt-1.5 text-xs font-medium text-slate-500";
    hint.textContent = I18N.t("form.dayIs", { day: dayName });
  }

  /* ------------ Update Localized Numbers & Quick WA Links ------------ */
  function updateLocalizedStatsAndLinks() {
    var docsCount = activeDoctors.length;
    var statDocs = $("statDoctors");
    if (statDocs) statDocs.textContent = I18N.num(docsCount) + "+";

    var statEm = $("statEm");
    var badge247 = $("badge247");
    var label247 = I18N.lang === "bn" ? "২৪/৭" : "24/7";
    if (statEm) statEm.textContent = label247;
    if (badge247) badge247.textContent = label247;

    var statUsg = $("statUsg");
    if (statUsg) statUsg.textContent = I18N.lang === "bn" ? "৪ডি" : "4D";

    document.querySelectorAll(".step-num[data-num]").forEach(function (el) {
      el.textContent = I18N.num(el.getAttribute("data-num"));
    });

    var yearEl = $("year");
    if (yearEl) yearEl.textContent = I18N.num(new Date().getFullYear());

    var quickUrl = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(I18N.t("wa.quick"));
    document.querySelectorAll("[data-wa-quick]").forEach(function (a) {
      a.setAttribute("href", quickUrl);
    });
  }

  /* ------------ Poster Lightbox ------------ */
  function openPoster(docId) {
    var doc = activeDoctors.find(function (d) { return String(d.id) === String(docId); });
    var dlg = $("posterDialog");
    var img = $("posterImg");
    var title = $("posterTitle");
    if (!doc || !doc.poster || !dlg || !img) return;

    var name = doc.name[I18N.lang] || doc.name.bn || doc.name.en;
    img.src = doc.poster;
    img.alt = name;
    if (title) title.textContent = name;

    if (typeof dlg.showModal === "function") {
      dlg.showModal();
    } else {
      window.open(doc.poster, "_blank", "noopener");
    }
  }

  /* ------------ Serial Card Tab Switcher (Book vs Check My Serial) ------------ */
  function switchSerialCardTab(tabName) {
    activeSerialTab = tabName === "lookup" ? "lookup" : "book";
    var isBook = activeSerialTab === "book";

    var bookTab = $("serialTabBook");
    var lookupTab = $("serialTabLookup");
    var bookForm = $("serialForm");
    var lookupPanel = $("serialLookupPanel");

    var activeCls = "rounded-xl px-2.5 sm:px-4 py-3 text-sm sm:text-base font-bold transition-all bg-sky-100 text-brand-900 border-2 border-sky-400 shadow-sm cursor-pointer text-center inline-flex items-center justify-center gap-1.5 leading-snug";
    var idleCls = "rounded-xl px-2.5 sm:px-4 py-3 text-sm sm:text-base font-semibold transition-all bg-white text-slate-600 border-2 border-slate-200/80 hover:bg-sky-50 hover:text-brand-800 hover:border-sky-200 cursor-pointer text-center inline-flex items-center justify-center gap-1.5 leading-snug";

    if (bookTab) {
      bookTab.setAttribute("aria-selected", isBook ? "true" : "false");
      bookTab.className = isBook ? activeCls : idleCls;
    }
    if (lookupTab) {
      lookupTab.setAttribute("aria-selected", isBook ? "false" : "true");
      lookupTab.className = isBook ? idleCls : activeCls;
    }
    if (bookForm) bookForm.classList.toggle("hidden", !isBook);
    if (lookupPanel) lookupPanel.classList.toggle("hidden", isBook);

    if (!isBook) {
      var lookupPhone = $("lookupPhone");
      if (lookupPhone && !lookupPhone.value) {
        try {
          var saved = localStorage.getItem(LAST_PHONE_KEY);
          if (saved) lookupPhone.value = saved;
        } catch (e) { /* ignore storage errors */ }
      }
    }
  }

  window.switchSerialCardTab = switchSerialCardTab;

  /* ------------ Select Target & Scroll to Serial Form ------------ */
  function selectSerialTarget(targetValue) {
    switchSerialCardTab("book");
    var select = $("fTarget");
    if (select) {
      select.value = targetValue;
      updateDayHint();
    }
    var section = $("serial");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
    setTimeout(function () {
      var nameInput = $("fName");
      if (nameInput) nameInput.focus({ preventScroll: true });
    }, 450);
  }

  /* ------------ Serial Form Validation, Supabase Insert & WhatsApp ------------ */
  function normalizeBdPhone(raw) {
    var ascii = I18N.toAscii(raw || "").replace(/[\s\-().]/g, "");
    if (ascii.indexOf("+880") === 0) ascii = "0" + ascii.slice(4);
    else if (ascii.indexOf("880") === 0) ascii = "0" + ascii.slice(3);
    return ascii;
  }

  function setFieldError(inputEl, errEl, hasError) {
    if (!inputEl || !errEl) return;
    inputEl.classList.toggle("is-invalid", hasError);
    if (hasError) errEl.removeAttribute("hidden");
    else errEl.setAttribute("hidden", "");
  }

  function resolveBookingTarget(targetVal) {
    var specs = activeSpecialties;
    if (targetVal.indexOf("doc:") === 0) {
      var docId = targetVal.slice(4);
      var doc = activeDoctors.find(function (d) { return String(d.id) === String(docId); });
      if (doc) {
        var primarySpecKey = (doc.specialties && doc.specialties[0]) || "medicine";
        var deptEn = (doc.specialtyLabel && (doc.specialtyLabel.en || doc.specialtyLabel.bn))
          || (specs[primarySpecKey] ? (specs[primarySpecKey].en || specs[primarySpecKey].bn) : "Outpatient Consultation");
        return {
          doctor_name: doc.name.en || doc.name.bn,
          department: deptEn,
          labelFor: function (lang) {
            var spList = (doc.specialtyLabel && (doc.specialtyLabel[lang] || doc.specialtyLabel.bn || doc.specialtyLabel.en))
              || (doc.specialties || []).map(function (s) {
                return specs[s] ? (specs[s][lang] || specs[s].en || specs[s].bn) : s;
              }).join(", ");
            return (doc.name[lang] || doc.name.bn || doc.name.en) + (spList ? " — " + spList : "");
          }
        };
      }
    }

    var deptObj = DEPARTMENTS.find(function (d) { return d.id === targetVal; });
    if (deptObj) {
      return {
        doctor_name: deptObj.defaultDoc,
        department: deptObj.enName,
        labelFor: function () {
          return I18N.t(deptObj.key);
        }
      };
    }

    return {
      doctor_name: "Duty Doctor",
      department: targetVal,
      labelFor: function () { return targetVal; }
    };
  }

  function formatBookingDateDisplay(dateVal) {
    var parts = dateVal.split("-");
    var dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    var dayKey = JS_DAY_TO_KEY[dt.getDay()];
    var dayName = (window.DAY_LABELS && window.DAY_LABELS[dayKey])
      ? window.DAY_LABELS[dayKey][I18N.lang]
      : "";
    return I18N.num(dateVal) + (dayName ? " (" + dayName + ")" : "");
  }

  function buildWhatsAppUrl(booking) {
    var targetText = booking.resolved.labelFor(I18N.lang);
    var dateDisplay = formatBookingDateDisplay(booking.dateVal);
    var lines = [
      I18N.t("wa.greet"),
      I18N.t("wa.intro"),
      "",
      "• " + I18N.t("wa.name") + ": " + booking.name,
      "• " + I18N.t("wa.phone") + ": " + booking.phone,
      "• " + I18N.t("wa.target") + ": " + targetText,
      "• " + I18N.t("wa.date") + ": " + dateDisplay,
      "",
      I18N.t("wa.end")
    ];
    return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(lines.join("\n"));
  }

  function validateAndExtractBooking() {
    var nameInput = $("fName");
    var phoneInput = $("fPhone");
    var targetSelect = $("fTarget");
    var dateInput = $("fDate");

    var name = (nameInput.value || "").trim();
    var phone = normalizeBdPhone(phoneInput.value);
    var targetVal = targetSelect.value || "";
    var dateVal = dateInput.value || "";

    var errName = name.length < 2;
    var errPhone = !/^01[3-9]\d{8}$/.test(phone);
    var errTarget = !targetVal;
    var errDate = !dateVal || dateVal < todayIso();

    setFieldError(nameInput, $("eName"), errName);
    setFieldError(phoneInput, $("ePhone"), errPhone);
    setFieldError(targetSelect, $("eTarget"), errTarget);
    setFieldError(dateInput, $("eDate"), errDate);

    if (errName || errPhone || errTarget || errDate) {
      var firstInvalid = [
        errName && nameInput,
        errPhone && phoneInput,
        errTarget && targetSelect,
        errDate && dateInput
      ].find(Boolean);
      if (firstInvalid) firstInvalid.focus();
      return null;
    }

    var resolved = resolveBookingTarget(targetVal);
    return {
      name: name,
      phone: phone,
      targetVal: targetVal,
      dateVal: dateVal,
      doctor_name: resolved.doctor_name,
      department: resolved.department,
      resolved: resolved
    };
  }

  function renderFormStatus() {
    var statusEl = $("formStatus");
    if (!statusEl) return;
    if (!lastFormResult) {
      statusEl.innerHTML = "";
      statusEl.className = "hidden";
      return;
    }

    var booking = lastFormResult.booking;
    var waUrl = buildWhatsAppUrl(booking);
    var summaryText = I18N.t("form.successSummary", {
      target: booking.resolved.labelFor(I18N.lang),
      date: formatBookingDateDisplay(booking.dateVal)
    });

    if (lastFormResult.type === "success" || lastFormResult.type === "duplicate") {
      var isDup = lastFormResult.type === "duplicate";
      var serialBadgeHtml = booking.serial_code
        ? '<span class="inline-block rounded-lg bg-brand-700 text-white text-xs font-extrabold px-2.5 py-0.5 mr-2">' + escapeHtml(booking.serial_code) + "</span>"
        : "";
      statusEl.className = isDup
        ? "rounded-2xl border border-brand-200 bg-brand-50/90 p-4 text-brand-950 shadow-sm"
        : "rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-950 shadow-sm";
      var iconWrapCls = isDup
        ? "w-8 h-8 rounded-full bg-brand-600 text-white grid place-items-center shrink-0 mt-0.5"
        : "w-8 h-8 rounded-full bg-emerald-600 text-white grid place-items-center shrink-0 mt-0.5";
      var iconId = isDup ? "#i-info" : "#i-check";
      var titleText = isDup ? I18N.t("form.duplicateTitle") : I18N.t("form.successTitle");
      var bodyText = isDup
        ? I18N.t("form.duplicateBody", { name: booking.name, serial: booking.serial_code || "SL-01" })
        : I18N.t("form.successBody", { name: booking.name });
      var titleCls = isDup ? "font-bold text-brand-900 text-base" : "font-bold text-emerald-900 text-base";
      var bodyCls = isDup ? "mt-1 text-sm text-brand-800 leading-relaxed" : "mt-1 text-sm text-emerald-800 leading-relaxed";
      var chipCls = isDup
        ? "mt-2 inline-block text-xs font-semibold bg-white/80 border border-brand-200 text-brand-900 rounded-lg px-2.5 py-1"
        : "mt-2 inline-block text-xs font-semibold bg-white/80 border border-emerald-200 text-emerald-900 rounded-lg px-2.5 py-1";

      statusEl.innerHTML =
        '<div class="flex items-start gap-3">' +
          '<span class="' + iconWrapCls + '">' +
            '<svg class="icon w-4 h-4"><use href="' + iconId + '"/></svg>' +
          "</span>" +
          '<div class="min-w-0 flex-1">' +
            '<p class="' + titleCls + '">' + serialBadgeHtml + escapeHtml(titleText) + "</p>" +
            '<p class="' + bodyCls + '">' +
              escapeHtml(bodyText) +
            "</p>" +
            '<p class="' + chipCls + '">' +
              escapeHtml(summaryText) +
            "</p>" +
            '<div class="mt-3.5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">' +
              (booking.serial_code
                ? '<button type="button" data-open-slip class="btn btn-brand justify-center text-sm py-2.5">' +
                    "<span>🎟️ " + escapeHtml(I18N.t("form.viewSlip")) + "</span>" +
                  "</button>"
                : "") +
              (booking.status !== "Confirmed" && booking.status !== "Completed"
                ? '<a href="' + escapeHtml(buildSerialSlipWhatsAppUrl(booking)) + '" target="_blank" rel="noopener" class="btn btn-wa justify-center text-sm py-2.5 flex-1">' +
                    '<svg class="icon w-4 h-4"><use href="#i-wa"/></svg>' +
                    "<span>📲 WhatsApp-এ স্লিপ পাঠান</span>" +
                  "</a>"
                : "") +
              '<button type="button" data-reset-serial class="btn btn-outline justify-center text-xs sm:text-sm py-2.5">' +
                escapeHtml(I18N.t("form.bookAnother")) +
              "</button>" +
            "</div>" +
          "</div>" +
        "</div>";
    } else {
      statusEl.className = "rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm";
      statusEl.innerHTML =
        '<div class="flex items-start gap-3">' +
          '<span class="w-8 h-8 rounded-full bg-amber-500 text-white grid place-items-center shrink-0 mt-0.5">' +
            '<svg class="icon w-4 h-4"><use href="#i-info"/></svg>' +
          "</span>" +
          '<div class="min-w-0 flex-1">' +
            '<p class="font-bold text-amber-900 text-base">' + escapeHtml(I18N.t("form.dbErrorTitle")) + "</p>" +
            '<p class="mt-1 text-sm text-amber-800 leading-relaxed">' +
              escapeHtml(I18N.t("form.dbErrorBody", { reason: lastFormResult.reason || "Network error" })) +
            "</p>" +
            '<div class="mt-3 flex flex-wrap gap-2">' +
              '<a href="' + escapeHtml(waUrl) + '" target="_blank" rel="noopener" class="btn btn-wa justify-center text-sm py-2.5 flex-1">' +
                '<svg class="icon w-4 h-4"><use href="#i-wa"/></svg>' +
                "<span>" + escapeHtml(I18N.t("form.waDirect")) + "</span>" +
              "</a>" +
            "</div>" +
          "</div>" +
        "</div>";
    }
  }

  function setSubmittingState(busy) {
    isSubmitting = busy;
    var submitBtn = $("serialSubmitBtn");
    var submitText = $("serialSubmitText");
    var waBtn = $("serialWaBtn");
    if (submitBtn) submitBtn.disabled = busy;
    if (waBtn) waBtn.disabled = busy;
    if (submitText) {
      submitText.textContent = busy ? I18N.t("form.submitSaving") : I18N.t("form.submit");
    }
  }

  function extractSerialNo(rpcData) {
    if (typeof rpcData === "number" && !isNaN(rpcData)) return rpcData;
    if (typeof rpcData === "string" && /^\d+$/.test(rpcData.trim())) return parseInt(rpcData.trim(), 10);
    if (Array.isArray(rpcData) && rpcData.length) {
      var first = rpcData[0];
      if (typeof first === "number") return first;
      if (first && first.serial_no != null) return parseInt(first.serial_no, 10);
      if (first && first.create_public_booking != null) return parseInt(first.create_public_booking, 10);
    }
    if (rpcData && typeof rpcData === "object") {
      if (rpcData.serial_no != null) return parseInt(rpcData.serial_no, 10);
      if (rpcData.create_public_booking != null) return parseInt(rpcData.create_public_booking, 10);
    }
    return null;
  }

  function buildSerialSlipWhatsAppUrl(booking) {
    var serialLine = booking.serial_code ? "• সিরিয়াল নম্বর: " + booking.serial_code : "";
    var doctorDisplay = booking.resolved ? booking.resolved.labelFor("bn") : booking.doctor_name;
    var lines = [
      "আসসালামু আলাইকুম, ডেলটা মেডিকেল সেন্টার এন্ড মা ও শিশু হাসপাতাল (শিবগঞ্জ)।",
      "ডিজিটাল সিরিয়াল স্লিপ:",
      ""
    ];
    if (serialLine) lines.push(serialLine);
    lines.push("• রোগীর নাম: " + booking.name);
    lines.push("• মোবাইল: " + booking.phone);
    lines.push("• ডাক্তার: " + (booking.doctor_name || doctorDisplay));
    lines.push("• বিভাগ: " + (booking.department || ""));
    lines.push("• তারিখ: " + booking.dateVal);
    lines.push("");
    lines.push("অনুগ্রহ করে সিরিয়ালটি নিশ্চিত করুন। ধন্যবাদ।");
    return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(lines.join("\n"));
  }

  function openSerialSlipModal(booking) {
    var dlg = $("serialSlipModal");
    if (!dlg || !booking) return;

    var serialCode = booking.serial_code || formatSerialCode(booking.serial_no) || "SL-01";
    var badgeEl = $("slipSerialBadge");
    if (badgeEl) badgeEl.textContent = serialCode;
    if ($("slipPatientName")) $("slipPatientName").textContent = booking.name || "—";
    if ($("slipPatientPhone")) $("slipPatientPhone").textContent = booking.phone || "—";
    if ($("slipDoctorName")) $("slipDoctorName").textContent = booking.doctor_name || "—";
    if ($("slipDepartment")) $("slipDepartment").textContent = booking.department || "—";
    if ($("slipDate")) $("slipDate").textContent = formatBookingDateDisplay(booking.dateVal);

    var statusKey = String(booking.status || "Pending");
    var isConfirmedOrDone = statusKey === "Confirmed" || statusKey === "Completed";

    var statusWrap = $("slipStatusWrap");
    var statusBadge = $("slipStatusBadge");
    if (statusWrap && statusBadge) {
      var slipStatusClasses = {
        Confirmed: "bg-emerald-600 border-emerald-600 text-white",
        Completed: "bg-sky-600 border-sky-600 text-white",
        Pending: "bg-amber-50 border-amber-200 text-amber-800"
      };
      var slipStatusKey = "slip.status." + (slipStatusClasses[statusKey] ? statusKey : "Pending");
      statusBadge.className =
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold " +
        (slipStatusClasses[statusKey] || slipStatusClasses.Pending);
      statusBadge.textContent = I18N.t(slipStatusKey);
      statusWrap.classList.remove("hidden");
    }

    var waBtn = $("slipWaBtn");
    if (waBtn) {
      if (isConfirmedOrDone) {
        waBtn.classList.add("hidden");
        waBtn.style.display = "none";
      } else {
        waBtn.classList.remove("hidden");
        waBtn.style.display = "";
        waBtn.setAttribute("href", buildSerialSlipWhatsAppUrl(booking));
      }
    }

    if (typeof dlg.showModal === "function") {
      if (!dlg.open) dlg.showModal();
    }
  }

  function closeSerialSlipModal() {
    var dlg = $("serialSlipModal");
    if (dlg && dlg.open) dlg.close();
  }

  function printSerialSlip() {
    document.body.classList.add("printing-slip");
    var cleanup = function () {
      document.body.classList.remove("printing-slip");
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    setTimeout(cleanup, 1500);
  }

  window.openSerialSlipModal = openSerialSlipModal;
  window.closeSerialSlipModal = closeSerialSlipModal;
  window.printSerialSlip = printSerialSlip;

  function extractBookingRpcResult(rpcData) {
    var serialNo = extractSerialNo(rpcData);
    var isDuplicate = false;
    var status = "Pending";
    var obj = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (obj && typeof obj === "object") {
      if (obj.is_duplicate === true) isDuplicate = true;
      if (typeof obj.status === "string" && obj.status) status = obj.status;
    }
    return {
      serial_no: serialNo,
      is_duplicate: isDuplicate,
      status: status
    };
  }

  function rememberLastPhone(phone) {
    if (!phone) return;
    try {
      localStorage.setItem(LAST_PHONE_KEY, phone);
    } catch (e) { /* ignore storage errors */ }
  }

  function insertAppointmentToSupabase(booking) {
    if (!window.supabaseClient) {
      return Promise.resolve({ error: { message: "Supabase client unavailable" } });
    }
    return window.supabaseClient.rpc("create_public_booking", {
      p_patient_name: booking.name,
      p_patient_phone: booking.phone,
      p_doctor_name: booking.doctor_name,
      p_department: booking.department,
      p_appointment_date: booking.dateVal
    });
  }

  function handleSerialSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    var booking = validateAndExtractBooking();
    if (!booking) return;

    setSubmittingState(true);
    insertAppointmentToSupabase(booking)
      .then(function (res) {
        if (res && res.error) {
          lastFormResult = {
            type: "error",
            booking: booking,
            reason: res.error.message || "Database error"
          };
        } else {
          var parsed = extractBookingRpcResult(res ? res.data : null);
          booking.serial_no = parsed.serial_no;
          booking.serial_code = formatSerialCode(parsed.serial_no) || "SL-01";
          booking.status = parsed.status;
          rememberLastPhone(booking.phone);
          lastFormResult = {
            type: parsed.is_duplicate ? "duplicate" : "success",
            booking: booking
          };
          var nameInput = $("fName");
          var phoneInput = $("fPhone");
          if (nameInput) nameInput.value = "";
          if (phoneInput) phoneInput.value = "";
          openSerialSlipModal(booking);
        }
        renderFormStatus();
      })
      .catch(function (err) {
        lastFormResult = {
          type: "error",
          booking: booking,
          reason: (err && err.message) || "Connection failed"
        };
        renderFormStatus();
      })
      .finally(function () {
        setSubmittingState(false);
      });
  }

  function handleDirectWhatsApp() {
    if (isSubmitting) return;
    var booking = validateAndExtractBooking();
    if (!booking) return;

    // Open WhatsApp synchronously in click gesture to avoid mobile popup blockers
    var waUrl = buildWhatsAppUrl(booking);
    window.open(waUrl, "_blank", "noopener");

    // Also log the serial in Supabase via RPC so reception sees it in admin.html
    setSubmittingState(true);
    insertAppointmentToSupabase(booking)
      .then(function (res) {
        if (!res || !res.error) {
          var parsed = extractBookingRpcResult(res ? res.data : null);
          booking.serial_no = parsed.serial_no;
          booking.serial_code = formatSerialCode(parsed.serial_no) || "SL-01";
          booking.status = parsed.status;
          rememberLastPhone(booking.phone);
          lastFormResult = {
            type: parsed.is_duplicate ? "duplicate" : "success",
            booking: booking
          };
          var nameInput = $("fName");
          var phoneInput = $("fPhone");
          if (nameInput) nameInput.value = "";
          if (phoneInput) phoneInput.value = "";
          renderFormStatus();
        }
      })
      .catch(function () { /* WhatsApp already opened */ })
      .finally(function () {
        setSubmittingState(false);
      });
  }

  /* ------------ Patient "Check My Serial" Lookup ------------ */
  function setLookupBusy(busy) {
    isLookingUp = busy;
    var btn = $("lookupSubmitBtn");
    var txt = $("lookupSubmitText");
    if (btn) btn.disabled = busy;
    if (txt) txt.textContent = busy ? I18N.t("lookup.searching") : I18N.t("lookup.submit");
  }

  function findLiveDoctorForLookupRow(row) {
    var docNameLower = String(row.doctor_name || "").trim().toLowerCase();
    var docNameBn = String(row.doctor_name_bn || "").trim();
    return activeDoctors.find(function (d) {
      var en = String((d.name && d.name.en) || "").trim().toLowerCase();
      var bn = String((d.name && d.name.bn) || "").trim();
      return (
        (docNameLower && en && en === docNameLower) ||
        (docNameLower && bn && bn.toLowerCase() === docNameLower) ||
        (docNameBn && bn && bn === docNameBn)
      );
    }) || null;
  }

  function renderLookupResults() {
    var container = $("serialLookupResults");
    if (!container) return;

    if (!lastLookupState) {
      container.innerHTML = "";
      return;
    }

    if (lastLookupState.type === "error") {
      container.innerHTML =
        '<div class="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">' +
          '<p class="font-bold text-amber-900 text-sm">' + escapeHtml(I18N.t("lookup.errorTitle")) + "</p>" +
          '<p class="mt-1 text-xs sm:text-sm text-amber-800 leading-relaxed">' +
            escapeHtml(I18N.t("lookup.errorBody", { reason: lastLookupState.reason || "Network error" })) +
          "</p>" +
        "</div>";
      return;
    }

    var rows = lastLookupState.rows || [];
    if (!rows.length) {
      container.innerHTML =
        '<div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">' +
          '<p class="font-bold text-slate-800 text-sm sm:text-base">' + escapeHtml(I18N.t("lookup.emptyTitle")) + "</p>" +
          '<p class="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">' + escapeHtml(I18N.t("lookup.emptyBody")) + "</p>" +
          '<button type="button" data-lookup-book-new class="mt-3.5 btn btn-brand text-xs sm:text-sm py-2 px-4 justify-center">' +
            escapeHtml(I18N.t("lookup.bookNow")) +
          "</button>" +
        "</div>";
      return;
    }

    var lang = I18N.lang;
    var today = todayLocalIso();

    var statusStyles = {
      Pending: "bg-amber-50 border-amber-200 text-amber-800",
      Confirmed: "bg-emerald-50 border-emerald-200 text-emerald-800",
      Completed: "bg-sky-50 border-sky-200 text-sky-800",
      Cancelled: "bg-rose-50 border-rose-200 text-rose-800"
    };

    container.innerHTML = rows.map(function (row, idx) {
      var slCode = formatSerialCode(row.serial_no);
      var statusKey = row.status || "Pending";
      var statusBadgeCls = statusStyles[statusKey] || statusStyles.Pending;
      var statusLabel = I18N.t("lookup.status." + statusKey);

      var liveDoc = findLiveDoctorForLookupRow(row);
      var displayDoctor = lang === "bn"
        ? (row.doctor_name_bn || (liveDoc && liveDoc.name && liveDoc.name.bn) || row.doctor_name)
        : (row.doctor_name || (liveDoc && liveDoc.name && liveDoc.name.en) || row.doctor_name_bn);
      var roomNo = row.room_no || (liveDoc && liveDoc.room_no) || "";

      // Merge freshest live queue numbers from Realtime activeDoctors when available
      var curSerial = liveDoc ? Number(liveDoc.current_serial || 0) : Number(row.current_serial || 0);
      var queueDate = liveDoc
        ? String(liveDoc.queue_updated_date || "").slice(0, 10)
        : String(row.queue_updated_date || "").slice(0, 10);
      var isRunningToday = queueDate === today && curSerial > 0;
      var apptDate = String(row.appointment_date || "").slice(0, 10);

      var queueBannerHtml = "";
      if (statusKey === "Pending" || statusKey === "Confirmed") {
        if (apptDate === today) {
          if (isRunningToday && row.serial_no) {
            var mySerialNum = Number(row.serial_no);
            if (mySerialNum > curSerial) {
              var ahead = mySerialNum - curSerial;
              queueBannerHtml =
                '<div class="mt-3 rounded-xl bg-emerald-50/90 border border-emerald-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">' +
                  '<span class="inline-flex items-center gap-1.5 font-bold text-emerald-800">' +
                    '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>' +
                    "<span>" + escapeHtml(I18N.t("lookup.nowServing", { serial: formatSerialCode(curSerial) })) + "</span>" +
                  "</span>" +
                  '<span class="font-extrabold text-brand-800">' +
                    escapeHtml(I18N.t("lookup.ahead", { n: I18N.num(ahead) })) +
                  "</span>" +
                "</div>";
            } else if (mySerialNum === curSerial) {
              queueBannerHtml =
                '<div class="mt-3 rounded-xl bg-emerald-600 text-white px-3 py-2 flex items-center gap-2 text-xs font-extrabold shadow-sm">' +
                  '<span class="relative flex h-2 w-2 shrink-0" aria-hidden="true">' +
                    '<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>' +
                    '<span class="relative inline-flex rounded-full h-2 w-2 bg-white"></span>' +
                  "</span>" +
                  "<span>" + escapeHtml(I18N.t("lookup.yourTurn")) + "</span>" +
                "</div>";
            } else {
              queueBannerHtml =
                '<div class="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-900">' +
                  escapeHtml(I18N.t("lookup.passed")) +
                "</div>";
            }
          } else {
            queueBannerHtml =
              '<div class="mt-3 rounded-xl bg-slate-50 border border-slate-200/90 px-3 py-2 text-xs font-medium text-slate-600">' +
                escapeHtml(I18N.t("lookup.notStarted")) +
              "</div>";
          }
        } else if (apptDate > today) {
          queueBannerHtml =
            '<div class="mt-3 rounded-xl bg-slate-50 border border-slate-200/90 px-3 py-2 text-xs font-medium text-slate-500">' +
              escapeHtml(I18N.t("lookup.upcoming")) +
            "</div>";
        }
      }

      return (
        '<article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">' +
          '<div class="flex items-start justify-between gap-2.5">' +
            '<div class="min-w-0 flex-1">' +
              '<div class="flex flex-wrap items-center gap-1.5">' +
                (slCode
                  ? '<span class="inline-flex items-center rounded-lg bg-brand-700 text-white text-xs font-extrabold px-2.5 py-0.5 tracking-wide">' +
                      escapeHtml(slCode) +
                    "</span>"
                  : "") +
                '<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ' + statusBadgeCls + '">' +
                  escapeHtml(statusLabel) +
                "</span>" +
              "</div>" +
              '<h3 class="mt-2 font-bold text-slate-900 text-sm sm:text-base leading-snug">' +
                escapeHtml(displayDoctor) +
              "</h3>" +
              '<p class="text-xs text-slate-500 mt-0.5">' +
                escapeHtml(row.department || "") + (roomNo ? " · " + escapeHtml(roomNo) : "") +
              "</p>" +
            "</div>" +
          "</div>" +

          '<div class="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-600">' +
            '<span><strong class="text-slate-800">' + escapeHtml(I18N.t("wa.name")) + ":</strong> " + escapeHtml(row.patient_name || "—") + "</span>" +
            '<span><strong class="text-slate-800">' + escapeHtml(I18N.t("wa.date")) + ":</strong> " + escapeHtml(apptDate ? formatBookingDateDisplay(apptDate) : "—") + "</span>" +
          "</div>" +

          queueBannerHtml +

          (statusKey !== "Cancelled"
            ? '<div class="mt-3 pt-2.5 border-t border-slate-100 flex justify-end">' +
                '<button type="button" data-lookup-slip-idx="' + idx + '" class="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-800 font-bold text-xs px-3 py-2 transition cursor-pointer">' +
                  "<span>🎟️ " + escapeHtml(I18N.t("lookup.viewSlip")) + "</span>" +
                "</button>" +
              "</div>"
            : "") +
        "</article>"
      );
    }).join("");
  }

  function handleSerialLookup(e) {
    e.preventDefault();
    if (isLookingUp) return;

    var phoneInput = $("lookupPhone");
    var errEl = $("eLookupPhone");
    var dateInput = $("lookupDate");
    var phone = normalizeBdPhone(phoneInput ? phoneInput.value : "");
    var errPhone = !/^01[3-9]\d{8}$/.test(phone);

    setFieldError(phoneInput, errEl, errPhone);
    if (errPhone) {
      if (phoneInput) phoneInput.focus();
      return;
    }

    if (!window.supabaseClient) {
      lastLookupState = { type: "error", reason: "Supabase client unavailable", rows: [] };
      renderLookupResults();
      return;
    }

    rememberLastPhone(phone);
    var dateVal = dateInput && dateInput.value ? dateInput.value : null;

    setLookupBusy(true);
    window.supabaseClient
      .rpc("lookup_patient_serials", {
        p_patient_phone: phone,
        p_appointment_date: dateVal
      })
      .then(function (res) {
        if (res && res.error) {
          lastLookupState = {
            type: "error",
            reason: res.error.message || "Database error",
            rows: []
          };
        } else {
          lastLookupState = {
            type: "results",
            phone: phone,
            rows: Array.isArray(res && res.data) ? res.data : []
          };
        }
        renderLookupResults();
      })
      .catch(function (err) {
        lastLookupState = {
          type: "error",
          reason: (err && err.message) || "Connection failed",
          rows: []
        };
        renderLookupResults();
      })
      .finally(function () {
        setLookupBusy(false);
      });
  }

  /* ------------ Boot & Event Wiring ------------ */
  function init() {
    // Initialize date picker to today
    var dateInput = $("fDate");
    if (dateInput) {
      var today = todayIso();
      dateInput.min = today;
      if (!dateInput.value) dateInput.value = today;
    }

    // Language toggle buttons
    document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        I18N.set(btn.getAttribute("data-lang-btn"));
      });
    });

    // Re-render dynamic views whenever language changes
    document.addEventListener("langchange", function () {
      updateLocalizedStatsAndLinks();
      renderSpecialtyControls();
      renderDayChips();
      renderLiveQueueTicker();
      renderDoctors();
      renderFormTargetOptions();
      updateDayHint();
      renderFormStatus();
      renderLookupResults();
      if (isSubmitting) {
        var submitText = $("serialSubmitText");
        if (submitText) submitText.textContent = I18N.t("form.submitSaving");
      }
      if (isLookingUp) {
        var lookupText = $("lookupSubmitText");
        if (lookupText) lookupText.textContent = I18N.t("lookup.searching");
      }
    });

    // Search input
    var searchInput = $("docSearch");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        state.search = searchInput.value || "";
        renderDoctors();
      });
    }

    // Specialty filter select
    var specFilter = $("specFilter");
    if (specFilter) {
      specFilter.addEventListener("change", function () {
        state.specialty = specFilter.value || "all";
        renderDoctors();
      });
    }

    // Reset filters button
    var resetBtn = $("resetFilters");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        state.search = "";
        state.specialty = "all";
        state.day = "all";
        if (searchInput) searchInput.value = "";
        if (specFilter) specFilter.value = "all";
        renderDayChips();
        renderDoctors();
      });
    }

    // Delegated clicks (day chips, book doctor, poster lightbox, department filter/serial links)
    document.addEventListener("click", function (e) {
      var dayBtn = e.target.closest("[data-day-chip]");
      if (dayBtn) {
        state.day = dayBtn.getAttribute("data-day-chip") || "all";
        renderDayChips();
        renderDoctors();
        return;
      }

      var bookBtn = e.target.closest("[data-book-doc]");
      if (bookBtn) {
        setQueuePopoverOpen(false);
        var docId = bookBtn.getAttribute("data-book-doc");
        selectSerialTarget("doc:" + docId);
        return;
      }

      var posterBtn = e.target.closest("[data-poster-doc]");
      if (posterBtn) {
        openPoster(posterBtn.getAttribute("data-poster-doc"));
        return;
      }

      var specLink = e.target.closest("[data-filter-spec]");
      if (specLink) {
        var sp = specLink.getAttribute("data-filter-spec");
        state.specialty = sp || "all";
        state.day = "all";
        state.search = "";
        if (searchInput) searchInput.value = "";
        if (specFilter) specFilter.value = state.specialty;
        renderDayChips();
        renderDoctors();
        return;
      }

      var serialLink = e.target.closest("[data-serial-target]");
      if (serialLink) {
        e.preventDefault();
        selectSerialTarget(serialLink.getAttribute("data-serial-target"));
        return;
      }

      var openSlipBtn = e.target.closest("[data-open-slip]");
      if (openSlipBtn && lastFormResult && lastFormResult.booking) {
        openSerialSlipModal(lastFormResult.booking);
        return;
      }

      var resetSerialBtn = e.target.closest("[data-reset-serial]");
      if (resetSerialBtn) {
        lastFormResult = null;
        renderFormStatus();
        var nameInput = $("fName");
        if (nameInput) nameInput.focus();
        return;
      }

      var lookupSlipBtn = e.target.closest("[data-lookup-slip-idx]");
      if (lookupSlipBtn && lastLookupState && Array.isArray(lastLookupState.rows)) {
        var rowIdx = parseInt(lookupSlipBtn.getAttribute("data-lookup-slip-idx"), 10);
        var row = lastLookupState.rows[rowIdx];
        if (row) {
          openSerialSlipModal({
            serial_no: row.serial_no,
            serial_code: formatSerialCode(row.serial_no) || "SL-01",
            name: row.patient_name || "",
            phone: row.patient_phone || "",
            doctor_name: row.doctor_name || row.doctor_name_bn || "",
            department: row.department || "",
            dateVal: String(row.appointment_date || "").slice(0, 10),
            status: row.status || "Pending"
          });
        }
        return;
      }

      var lookupBookNewBtn = e.target.closest("[data-lookup-book-new]");
      if (lookupBookNewBtn) {
        switchSerialCardTab("book");
        var fNameEl = $("fName");
        if (fNameEl) fNameEl.focus();
      }
    });

    // Poster dialog close
    var dlg = $("posterDialog");
    var closeBtn = $("posterClose");
    if (dlg && closeBtn) {
      closeBtn.addEventListener("click", function () { dlg.close(); });
      dlg.addEventListener("click", function (e) {
        if (e.target === dlg) dlg.close();
      });
    }

    // Digital Serial Slip modal events
    var slipModal = $("serialSlipModal");
    if (slipModal) {
      if ($("slipCloseBtn")) $("slipCloseBtn").addEventListener("click", closeSerialSlipModal);
      if ($("slipDoneBtn")) $("slipDoneBtn").addEventListener("click", closeSerialSlipModal);
      if ($("slipPrintBtn")) $("slipPrintBtn").addEventListener("click", printSerialSlip);
      slipModal.addEventListener("click", function (e) {
        if (e.target === slipModal) closeSerialSlipModal();
      });
    }

    // Floating Live Chamber Queue widget & slide-up popover
    var queueFab = $("liveQueueFab");
    var queuePopover = $("liveQueuePopover");
    var closePopoverBtn = $("closeQueuePopoverBtn");
    var openFromBarBtn = $("openQueueDrawerFromBar");
    var queueWidget = $("liveQueueWidget");

    if (queueFab && queuePopover) {
      queueFab.addEventListener("click", function () {
        var isOpen = !queuePopover.classList.contains("hidden");
        setQueuePopoverOpen(!isOpen);
      });
    }
    var queueTeaser = $("liveQueueTeaser");
    if (queueTeaser) {
      queueTeaser.addEventListener("click", function () {
        setQueuePopoverOpen(true);
      });
    }
    if (closePopoverBtn) {
      closePopoverBtn.addEventListener("click", function () {
        setQueuePopoverOpen(false);
      });
    }
    if (openFromBarBtn) {
      openFromBarBtn.addEventListener("click", function () {
        setQueuePopoverOpen(true);
      });
    }
    var openLookupFromPopoverBtn = $("openLookupFromPopoverBtn");
    if (openLookupFromPopoverBtn) {
      openLookupFromPopoverBtn.addEventListener("click", function () {
        setQueuePopoverOpen(false);
        switchSerialCardTab("lookup");
        var serialSection = $("serial");
        if (serialSection) serialSection.scrollIntoView({ behavior: "smooth" });
        setTimeout(function () {
          var lp = $("lookupPhone");
          if (lp) lp.focus({ preventScroll: true });
        }, 450);
      });
    }
    document.addEventListener("click", function (e) {
      if (
        queuePopover &&
        !queuePopover.classList.contains("hidden") &&
        queueWidget &&
        !queueWidget.contains(e.target) &&
        (!openFromBarBtn || !openFromBarBtn.contains(e.target))
      ) {
        setQueuePopoverOpen(false);
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setQueuePopoverOpen(false);
    });

    // Mobile menu toggle
    var menuBtn = $("menuBtn");
    var mobileMenu = $("mobileMenu");
    var menuIcon = $("menuIcon");
    function setMenuOpen(open) {
      if (!menuBtn || !mobileMenu) return;
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      mobileMenu.classList.toggle("hidden", !open);
      if (menuIcon) {
        menuIcon.innerHTML = '<use href="' + (open ? "#i-x" : "#i-menu") + '"/>';
      }
    }
    if (menuBtn && mobileMenu) {
      menuBtn.addEventListener("click", function () {
        var isOpen = menuBtn.getAttribute("aria-expanded") === "true";
        setMenuOpen(!isOpen);
      });
      mobileMenu.querySelectorAll("a").forEach(function (a) {
        a.addEventListener("click", function () { setMenuOpen(false); });
      });
    }

    // Sticky header shadow on scroll
    var header = $("siteHeader");
    if (header) {
      window.addEventListener("scroll", function () {
        header.classList.toggle("shadow-md", window.scrollY > 8);
      }, { passive: true });
    }

    // Active section highlight in navbar
    var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-link[href^='#']"));
    if ("IntersectionObserver" in window && navLinks.length) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var id = "#" + entry.target.id;
            navLinks.forEach(function (link) {
              link.classList.toggle("is-active", link.getAttribute("href") === id);
            });
          }
        });
      }, { rootMargin: "-35% 0px -55% 0px" });
      ["home", "doctors", "services", "serial", "contact"].forEach(function (id) {
        var el = $(id);
        if (el) obs.observe(el);
      });
    }

    // Serial Card Tabs (Book New vs Check My Serial) & Form listeners
    var tabBookBtn = $("serialTabBook");
    var tabLookupBtn = $("serialTabLookup");
    if (tabBookBtn) {
      tabBookBtn.addEventListener("click", function () {
        switchSerialCardTab("book");
      });
    }
    if (tabLookupBtn) {
      tabLookupBtn.addEventListener("click", function () {
        switchSerialCardTab("lookup");
      });
    }
    var lookupForm = $("serialLookupForm");
    if (lookupForm) {
      lookupForm.addEventListener("submit", handleSerialLookup);
    }

    var form = $("serialForm");
    if (form) {
      form.addEventListener("submit", handleSerialSubmit);
    }
    var waDirectBtn = $("serialWaBtn");
    if (waDirectBtn) {
      waDirectBtn.addEventListener("click", handleDirectWhatsApp);
    }
    var targetSelect = $("fTarget");
    if (targetSelect) targetSelect.addEventListener("change", updateDayHint);
    if (dateInput) dateInput.addEventListener("change", updateDayHint);

    // Apply initial language (Bangla by default, or saved preference), then load live doctors from Supabase
    I18N.apply();
    loadActiveDoctorsFromSupabase();
    startPublicLiveQueueRealtime();

    // Gentle 60s silent fallback poll + tab-focus refresh (Realtime handles <1s live updates)
    setInterval(function () {
      if (!document.hidden) refreshLiveQueueSilently();
    }, 60000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refreshLiveQueueSilently();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
