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

  var lastFormResult = null;
  var isSubmitting = false;

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
      } else if (Array.isArray(slot.days)) {
        dayPart = slot.days.map(function (d) {
          return labels[d] ? labels[d][lang] : d;
        }).join(lang === "bn" ? ", " : ", ");
      }
      var timePart = slot[lang] || slot.bn || "";
      return { dayPart: dayPart, timePart: timePart, isDaily: !!slot.daily };
    });
  }

  /* ------------ Render Specialty Filter & More Chips ------------ */
  function renderSpecialtyControls() {
    var lang = I18N.lang;
    var specs = window.SPECIALTIES || {};
    var select = $("specFilter");
    if (select) {
      var current = state.specialty;
      var html = '<option value="all">' + escapeHtml(I18N.t("doc.allSpecialties")) + "</option>";
      Object.keys(specs).forEach(function (key) {
        var sel = key === current ? " selected" : "";
        html += '<option value="' + escapeHtml(key) + '"' + sel + ">" + escapeHtml(specs[key][lang]) + "</option>";
      });
      select.innerHTML = html;
    }

    var more = $("moreSpecs");
    if (more) {
      more.innerHTML = Object.keys(specs).map(function (key) {
        return (
          '<a href="#doctors" data-filter-spec="' + escapeHtml(key) + '" ' +
          'class="chip">' + escapeHtml(specs[key][lang]) + " →</a>"
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
    var docs = window.DOCTORS || [];
    var specs = window.SPECIALTIES || {};
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
          return specs[s] ? specs[s].bn + " " + specs[s].en : "";
        }).join(" ");
        var haystack = [
          doc.name.bn, doc.name.en,
          doc.focus.bn, doc.focus.en,
          doc.degrees.bn, doc.degrees.en,
          doc.designation.bn, doc.designation.en,
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
    var specs = window.SPECIALTIES || {};
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
      var name = doc.name[lang] || doc.name.bn;
      var focus = doc.focus[lang] || doc.focus.bn;
      var degrees = doc.degrees[lang] || doc.degrees.bn;
      var desig = (doc.designation && (doc.designation[lang] || doc.designation.bn)) || "";
      var faceX = (doc.face && doc.face.x) || 75;
      var faceY = (doc.face && doc.face.y) || 30;

      var badgesHtml = (doc.specialties || []).map(function (sp) {
        var label = specs[sp] ? specs[sp][lang] : sp;
        return '<span class="doc-badge">' + escapeHtml(label) + "</span>";
      }).join(" ");

      var schedLines = formatScheduleLines(doc, lang).map(function (line) {
        var pillClass = line.isDaily
          ? "bg-emerald-100 text-emerald-800"
          : "bg-brand-100 text-brand-800";
        return (
          '<div class="flex flex-wrap items-center justify-between gap-1.5">' +
            '<span class="inline-block text-xs font-bold px-2 py-0.5 rounded-md ' + pillClass + '">' +
              escapeHtml(line.dayPart) +
            "</span>" +
            '<span class="font-semibold text-slate-700 text-xs sm:text-sm">' +
              escapeHtml(line.timePart) +
            "</span>" +
          "</div>"
        );
      }).join('<div class="my-1 border-t border-slate-200/70"></div>');

      return (
        '<article class="doc-card">' +
          '<div class="p-5">' +
            '<div class="flex items-start gap-3.5">' +
              '<button type="button" data-poster-doc="' + escapeHtml(doc.id) + '" class="doc-avatar group relative" title="' + escapeHtml(I18N.t("doc.poster")) + '">' +
                '<img src="' + escapeHtml(doc.poster) + '" loading="lazy" decoding="async" ' +
                  'style="object-position:' + faceX + "% " + faceY + '%" ' +
                  'alt="' + escapeHtml(I18N.t("doc.photoAlt", { name: name })) + '" />' +
              "</button>" +
              '<div class="min-w-0 flex-1">' +
                '<div class="flex flex-wrap gap-1.5">' + badgesHtml + "</div>" +
                '<h3 class="mt-1.5 text-lg font-bold text-brand-950 leading-snug">' + escapeHtml(name) + "</h3>" +
                '<p class="text-xs font-semibold text-delta-600 mt-0.5">' + escapeHtml(focus) + "</p>" +
              "</div>" +
            "</div>" +

            '<p class="mt-3 text-sm font-medium text-slate-700 leading-relaxed">' + escapeHtml(degrees) + "</p>" +
            (desig ? '<p class="mt-1 text-xs text-slate-500 leading-relaxed">' + escapeHtml(desig) + "</p>" : "") +

            '<div class="doc-sched mt-4">' +
              '<p class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">' +
                '<svg class="icon w-3.5 h-3.5 text-brand-600"><use href="#i-clock"/></svg>' +
                '<span>' + escapeHtml(I18N.t("doc.schedule")) + "</span>" +
              "</p>" +
              schedLines +
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
            '<button type="button" data-poster-doc="' + escapeHtml(doc.id) + '" class="btn btn-outline text-sm py-2.5 px-3" title="' + escapeHtml(I18N.t("doc.poster")) + '" aria-label="' + escapeHtml(I18N.t("doc.poster") + " - " + name) + '">' +
              '<svg class="icon w-4 h-4 text-brand-600"><use href="#i-img"/></svg>' +
            "</button>" +
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
    var docs = window.DOCTORS || [];
    var specs = window.SPECIALTIES || {};

    var html = '<option value="">' + escapeHtml(I18N.t("form.choose")) + "</option>";

    if (docs.length) {
      html += '<optgroup label="' + escapeHtml(I18N.t("form.groupDoctors")) + '">';
      docs.forEach(function (doc) {
        var spNames = (doc.specialties || []).map(function (s) {
          return specs[s] ? specs[s][lang] : s;
        }).join(", ");
        var label = (doc.name[lang] || doc.name.bn) + (spNames ? " — " + spNames : "");
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
      var doc = (window.DOCTORS || []).find(function (d) { return d.id === docId; });
      if (doc && !doctorVisitsOnDay(doc, dayKey)) {
        var visitDays = [];
        (doc.schedule || []).forEach(function (slot) {
          (slot.days || []).forEach(function (d) {
            var lbl = dayLabels[d] ? dayLabels[d][lang] : d;
            if (visitDays.indexOf(lbl) === -1) visitDays.push(lbl);
          });
        });
        hint.className = "mt-2 text-xs sm:text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2";
        hint.textContent = I18N.t("form.warnDay", {
          doctor: doc.name[lang] || doc.name.bn,
          days: visitDays.join(", ")
        });
        return;
      }
    }

    hint.className = "mt-1.5 text-xs font-medium text-slate-500";
    hint.textContent = I18N.t("form.dayIs", { day: dayName });
  }

  /* ------------ Update Localized Numbers & Quick WA Links ------------ */
  function updateLocalizedStatsAndLinks() {
    var docsCount = (window.DOCTORS || []).length;
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
    var doc = (window.DOCTORS || []).find(function (d) { return d.id === docId; });
    var dlg = $("posterDialog");
    var img = $("posterImg");
    var title = $("posterTitle");
    if (!doc || !dlg || !img) return;

    var name = doc.name[I18N.lang] || doc.name.bn;
    img.src = doc.poster;
    img.alt = name;
    if (title) title.textContent = name;

    if (typeof dlg.showModal === "function") {
      dlg.showModal();
    } else {
      window.open(doc.poster, "_blank", "noopener");
    }
  }

  /* ------------ Select Target & Scroll to Serial Form ------------ */
  function selectSerialTarget(targetValue) {
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
    var specs = window.SPECIALTIES || {};
    if (targetVal.indexOf("doc:") === 0) {
      var docId = targetVal.slice(4);
      var doc = (window.DOCTORS || []).find(function (d) { return d.id === docId; });
      if (doc) {
        var primarySpecKey = (doc.specialties && doc.specialties[0]) || "medicine";
        var deptEn = specs[primarySpecKey] ? specs[primarySpecKey].en : "Outpatient Consultation";
        return {
          doctor_name: doc.name.en || doc.name.bn,
          department: deptEn,
          labelFor: function (lang) {
            var spList = (doc.specialties || []).map(function (s) {
              return specs[s] ? specs[s][lang] : s;
            }).join(", ");
            return (doc.name[lang] || doc.name.bn) + (spList ? " — " + spList : "");
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

    if (lastFormResult.type === "success") {
      statusEl.className = "rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-950 shadow-sm";
      statusEl.innerHTML =
        '<div class="flex items-start gap-3">' +
          '<span class="w-8 h-8 rounded-full bg-emerald-600 text-white grid place-items-center shrink-0 mt-0.5">' +
            '<svg class="icon w-4 h-4"><use href="#i-check"/></svg>' +
          "</span>" +
          '<div class="min-w-0 flex-1">' +
            '<p class="font-bold text-emerald-900 text-base">' + escapeHtml(I18N.t("form.successTitle")) + "</p>" +
            '<p class="mt-1 text-sm text-emerald-800 leading-relaxed">' +
              escapeHtml(I18N.t("form.successBody", { name: booking.name })) +
            "</p>" +
            '<p class="mt-2 inline-block text-xs font-semibold bg-white/80 border border-emerald-200 text-emerald-900 rounded-lg px-2.5 py-1">' +
              escapeHtml(summaryText) +
            "</p>" +
            '<div class="mt-3.5 flex flex-col sm:flex-row sm:items-center gap-2.5">' +
              '<a href="' + escapeHtml(waUrl) + '" target="_blank" rel="noopener" class="btn btn-wa justify-center text-sm py-2.5 flex-1">' +
                '<svg class="icon w-4 h-4"><use href="#i-wa"/></svg>' +
                "<span>" + escapeHtml(I18N.t("form.successWaBtn")) + "</span>" +
              "</a>" +
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

  function insertAppointmentToSupabase(booking) {
    if (!window.supabaseClient) {
      return Promise.resolve({ error: { message: "Supabase client unavailable" } });
    }
    return window.supabaseClient
      .from("appointments")
      .insert([{
        patient_name: booking.name,
        patient_phone: booking.phone,
        doctor_name: booking.doctor_name,
        department: booking.department,
        appointment_date: booking.dateVal,
        status: "Pending"
      }]);
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
          lastFormResult = {
            type: "success",
            booking: booking
          };
          var nameInput = $("fName");
          var phoneInput = $("fPhone");
          if (nameInput) nameInput.value = "";
          if (phoneInput) phoneInput.value = "";
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

    // Also log the serial in Supabase so reception sees it in admin.html
    setSubmittingState(true);
    insertAppointmentToSupabase(booking)
      .then(function (res) {
        if (!res || !res.error) {
          lastFormResult = { type: "success", booking: booking };
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
      renderDoctors();
      renderFormTargetOptions();
      updateDayHint();
      renderFormStatus();
      if (isSubmitting) {
        var submitText = $("serialSubmitText");
        if (submitText) submitText.textContent = I18N.t("form.submitSaving");
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

      var resetSerialBtn = e.target.closest("[data-reset-serial]");
      if (resetSerialBtn) {
        lastFormResult = null;
        renderFormStatus();
        var nameInput = $("fName");
        if (nameInput) nameInput.focus();
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

    // Form listeners
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

    // Apply initial language (Bangla by default, or saved preference)
    I18N.apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
