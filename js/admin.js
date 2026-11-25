/* =====================================================================
 * Delta Medical Center — Reception & Admin CRUD Dashboard (admin.js)
 * - Supabase Auth Gate: getSession, onAuthStateChange, signInWithPassword, signOut
 * - CRUD operations on `appointments` table:
 *   id, patient_name, patient_phone, doctor_name, department,
 *   appointment_date, status, notes, created_at
 * ===================================================================== */
(function () {
  "use strict";

  var STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];
  var BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

  var EXTRA_DEPARTMENTS = [
    { label: "Mother & Child Care (মা ও শিশু বিভাগ)", doctor: "Duty Doctor", dept: "Mother & Child Care" },
    { label: "Gynecology & Obstetrics (গাইনি ও প্রসূতি)", doctor: "Duty Doctor", dept: "Gynecology & Obstetrics" },
    { label: "Pediatrics (শিশু রোগ)", doctor: "Duty Doctor", dept: "Pediatrics" },
    { label: "4D Ultrasonography (৪ডি আল্ট্রাসনোগ্রাফি)", doctor: "Diagnostic Unit", dept: "4D Ultrasonography" },
    { label: "Digital X-Ray (ডিজিটাল এক্স-রে)", doctor: "Diagnostic Unit", dept: "Digital X-Ray" },
    { label: "Pathology Lab (প্যাথলজি ল্যাব)", doctor: "Diagnostic Unit", dept: "Pathology Lab" },
    { label: "24/7 Emergency (জরুরি বিভাগ)", doctor: "Duty Doctor", dept: "24/7 Emergency" }
  ];

  var appointments = [];
  var doctorsList = [];
  var activeTab = "appointments";
  var filters = {
    search: "",
    doctor: "All",
    status: "All",
    date: ""
  };
  var docFilters = {
    search: "",
    active: "all"
  };
  var pendingDeleteTarget = null;
  var toastTimer = null;
  var realtimeChannel = null;

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toAsciiDigits(val) {
    return String(val || "").replace(/[০-৯]/g, function (d) {
      return String(BN_DIGITS.indexOf(d));
    });
  }

  function normalizePhone(raw) {
    var s = toAsciiDigits(raw).replace(/[\s\-().]/g, "");
    if (s.indexOf("+880") === 0) s = "0" + s.slice(4);
    else if (s.indexOf("880") === 0 && s.length === 13) s = "0" + s.slice(3);
    return s;
  }

  function todayIso() {
    return new Date().toLocaleDateString("en-CA");
  }

  function formatSerialCode(serialNo) {
    var n = parseInt(serialNo, 10);
    if (isNaN(n) || n <= 0) return "—";
    return "SL-" + String(n).padStart(2, "0");
  }

  function getRowSerialCode(row, fallbackIdx) {
    var raw = row && row.serial_no != null ? parseInt(row.serial_no, 10) : NaN;
    if (!isNaN(raw) && raw > 0) return formatSerialCode(raw);
    return formatSerialCode((fallbackIdx || 0) + 1);
  }

  function normalizeWaPhone(rawPhone) {
    var digits = toAsciiDigits(rawPhone || "").replace(/\D/g, "");
    if (!digits) return "";
    return digits.startsWith("880")
      ? digits
      : digits.startsWith("0")
        ? "88" + digits
        : "880" + digits;
  }

  function formatDateBadge(isoDate) {
    if (!isoDate) return { label: "—", sub: "", pill: "" };
    var parts = String(isoDate).slice(0, 10).split("-");
    if (parts.length !== 3) return { label: String(isoDate), sub: "", pill: "" };

    var dt = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    var weekday = isNaN(dt.getTime())
      ? ""
      : dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

    var today = todayIso();
    var pill = "";
    if (isoDate === today) {
      pill = '<span class="no-print inline-block rounded-md bg-brand-100 text-brand-800 text-[10px] font-bold px-1.5 py-0.5 ml-1.5">TODAY</span>';
    } else if (isoDate < today) {
      pill = '<span class="no-print inline-block rounded-md bg-slate-100 text-slate-500 text-[10px] font-semibold px-1.5 py-0.5 ml-1.5">Past</span>';
    }

    return {
      label: isoDate,
      sub: weekday,
      pill: pill
    };
  }

  function formatCreatedAt(ts) {
    if (!ts) return "";
    var dt = new Date(ts);
    if (isNaN(dt.getTime())) return "";
    return dt.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function findRowById(idStr) {
    return appointments.find(function (r) {
      return String(r.id) === String(idStr);
    });
  }

  function lookupBanglaDoctorName(enOrBnName) {
    if (!enOrBnName) return "";
    var target = String(enOrBnName).trim().toLowerCase();

    if (doctorsList.length) {
      var dbMatch = doctorsList.find(function (d) {
        return (
          (d.name_en && d.name_en.trim().toLowerCase() === target) ||
          (d.name_bn && d.name_bn.trim() === enOrBnName)
        );
      });
      if (dbMatch && dbMatch.name_bn && dbMatch.name_bn !== enOrBnName) {
        return dbMatch.name_bn;
      }
    }

    if (Array.isArray(window.DOCTORS)) {
      var match = window.DOCTORS.find(function (d) {
        return (
          (d.name.en && d.name.en.toLowerCase() === target) ||
          (d.name.bn && d.name.bn === enOrBnName)
        );
      });
      if (match && match.name.bn && match.name.bn !== enOrBnName) {
        return match.name.bn;
      }
    }
    return "";
  }

  function buildPatientWhatsAppLink(row, serialCode) {
    var waPhone = normalizeWaPhone(row.patient_phone);
    if (!waPhone || waPhone.length < 11) return "";
    var sl = serialCode || getRowSerialCode(row, 0);
    var bnDoc = lookupBanglaDoctorName(row.doctor_name);
    var docDisplay = bnDoc ? bnDoc + " (" + row.doctor_name + ")" : (row.doctor_name || "Duty Doctor");
    var msg =
      "আসসালামু আলাইকুম " + (row.patient_name || "সম্মানিত রোগী") + ",\n" +
      "ডেলটা মেডিকেল সেন্টার এন্ড মা ও শিশু হাসপাতাল (শিবগঞ্জ) থেকে আপনার ডিজিটাল সিরিয়াল নিশ্চিত করা হয়েছে:\n\n" +
      "• সিরিয়াল নম্বর: " + sl + "\n" +
      "• রোগীর নাম: " + (row.patient_name || "") + "\n" +
      "• ডাক্তার: " + docDisplay + "\n" +
      (row.department ? "• বিভাগ: " + row.department + "\n" : "") +
      "• তারিখ: " + (row.appointment_date || "") + "\n" +
      (row.notes ? "• নোট: " + row.notes + "\n" : "") +
      "\nচেম্বারে আসার সময় এই মেসেজটি রিসেপশনে দেখাবেন। প্রয়োজনে কল করুন: ০১৭২৪-৩৬৩৮৩৮। ধন্যবাদ।";
    return "https://wa.me/" + waPhone + "?text=" + encodeURIComponent(msg);
  }

  /* ------------ Toast & Error Alert Helpers ------------ */
  function showToast(msg, isError) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.className =
      "fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl border " +
      (isError
        ? "bg-rose-700 text-white border-rose-500"
        : "bg-brand-950 text-white border-white/10");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.add("hidden");
    }, 3400);
  }

  function setDbError(message) {
    var banner = $("dbErrorBanner");
    if (!banner) return;
    if (!message) {
      banner.textContent = "";
      banner.classList.add("hidden");
    } else {
      banner.innerHTML =
        '<strong class="font-bold">Database Error:</strong> ' + escapeHtml(message);
      banner.classList.remove("hidden");
    }
  }

  /* ------------ Populate Modal Presets & Datalists ------------ */
  function getEffectiveDoctorPresets() {
    var specs = window.SPECIALTIES || {};
    if (doctorsList.length) {
      return doctorsList.map(function (d) {
        return {
          en: d.name_en || d.name_bn || "",
          bn: d.name_bn || d.name_en || "",
          dept: d.specialty_en || d.specialty_bn || "Outpatient",
          active: d.is_active !== false
        };
      });
    }
    return (window.DOCTORS || []).map(function (doc) {
      var firstSpec = (doc.specialties && doc.specialties[0]) || "medicine";
      var deptEn = specs[firstSpec] ? specs[firstSpec].en : "Outpatient";
      return {
        en: doc.name.en,
        bn: doc.name.bn,
        dept: deptEn,
        active: true
      };
    });
  }

  function populateModalPresets() {
    var docs = getEffectiveDoctorPresets();
    var specs = window.SPECIALTIES || {};
    var presetSelect = $("mQuickPreset");
    var docDatalist = $("doctorsDatalist");
    var deptDatalist = $("departmentsDatalist");
    var specBnDatalist = $("specBnDatalist");
    var specEnDatalist = $("specEnDatalist");

    if (presetSelect) {
      var html = '<option value="">— Select to auto-fill Doctor & Department —</option>';
      if (docs.length) {
        html += '<optgroup label="Specialist Doctors">';
        docs.forEach(function (doc) {
          var val = JSON.stringify({ doctor: doc.en, dept: doc.dept });
          var statusTag = doc.active ? "" : " [Off-Duty]";
          html +=
            '<option value="' + escapeHtml(val) + '">' +
            escapeHtml(doc.en + (doc.bn && doc.bn !== doc.en ? " (" + doc.bn + ")" : "") + " — " + doc.dept + statusTag) +
            "</option>";
        });
        html += "</optgroup>";
      }
      html += '<optgroup label="Departments & Diagnostic Services">';
      EXTRA_DEPARTMENTS.forEach(function (item) {
        var val = JSON.stringify({ doctor: item.doctor, dept: item.dept });
        html += '<option value="' + escapeHtml(val) + '">' + escapeHtml(item.label) + "</option>";
      });
      html += "</optgroup>";
      presetSelect.innerHTML = html;
    }

    if (docDatalist) {
      var docNames = docs.map(function (d) { return d.en; }).concat(["Duty Doctor", "Diagnostic Unit"]);
      docDatalist.innerHTML = docNames.map(function (n) {
        return '<option value="' + escapeHtml(n) + '"></option>';
      }).join("");
    }

    if (deptDatalist) {
      var deptSet = [];
      docs.forEach(function (d) {
        if (d.dept && deptSet.indexOf(d.dept) === -1) deptSet.push(d.dept);
      });
      Object.keys(specs).forEach(function (k) {
        if (deptSet.indexOf(specs[k].en) === -1) deptSet.push(specs[k].en);
      });
      EXTRA_DEPARTMENTS.forEach(function (d) {
        if (deptSet.indexOf(d.dept) === -1) deptSet.push(d.dept);
      });
      deptDatalist.innerHTML = deptSet.map(function (n) {
        return '<option value="' + escapeHtml(n) + '"></option>';
      }).join("");
    }

    if (specBnDatalist) {
      var bnSet = [];
      Object.keys(specs).forEach(function (k) {
        if (specs[k].bn && bnSet.indexOf(specs[k].bn) === -1) bnSet.push(specs[k].bn);
      });
      doctorsList.forEach(function (d) {
        if (d.specialty_bn && bnSet.indexOf(d.specialty_bn) === -1) bnSet.push(d.specialty_bn);
      });
      specBnDatalist.innerHTML = bnSet.map(function (n) {
        return '<option value="' + escapeHtml(n) + '"></option>';
      }).join("");
    }

    if (specEnDatalist) {
      var enSet = [];
      Object.keys(specs).forEach(function (k) {
        if (specs[k].en && enSet.indexOf(specs[k].en) === -1) enSet.push(specs[k].en);
      });
      doctorsList.forEach(function (d) {
        if (d.specialty_en && enSet.indexOf(d.specialty_en) === -1) enSet.push(d.specialty_en);
      });
      specEnDatalist.innerHTML = enSet.map(function (n) {
        return '<option value="' + escapeHtml(n) + '"></option>';
      }).join("");
    }
  }

  /* ------------ Summary Counters & Filtering ------------ */
  function updateCounters() {
    var today = todayIso();
    var total = appointments.length;
    var todayCount = 0;
    var pendingCount = 0;
    var confirmedCount = 0;

    appointments.forEach(function (r) {
      if (r.appointment_date === today) todayCount++;
      if (r.status === "Pending") pendingCount++;
      if (r.status === "Confirmed") confirmedCount++;
    });

    $("countTotal").textContent = String(total);
    $("countToday").textContent = String(todayCount);
    $("countPending").textContent = String(pendingCount);
    $("countConfirmed").textContent = String(confirmedCount);

    var tabApptBadge = $("tabAppointmentsCount");
    if (tabApptBadge) tabApptBadge.textContent = String(total);

    var todayLbl = $("todayDateLabel");
    if (todayLbl) todayLbl.textContent = "Date: " + today;
  }

  function populateDoctorFilter() {
    var docSelect = $("filterDoctor");
    if (!docSelect) return;
    var prev = filters.doctor || "All";
    var names = [];

    getEffectiveDoctorPresets().forEach(function (d) {
      if (d.en && names.indexOf(d.en) === -1) {
        names.push(d.en);
      }
    });
    ["Duty Doctor", "Diagnostic Unit"].forEach(function (n) {
      if (names.indexOf(n) === -1) names.push(n);
    });
    appointments.forEach(function (r) {
      var dn = (r.doctor_name || "").trim();
      if (dn && names.indexOf(dn) === -1) names.push(dn);
    });

    var html = '<option value="All">Doctor: All</option>';
    names.forEach(function (name) {
      var bn = lookupBanglaDoctorName(name);
      var label = bn ? name + " (" + bn + ")" : name;
      var sel = name === prev ? " selected" : "";
      html += '<option value="' + escapeHtml(name) + '"' + sel + ">" + escapeHtml(label) + "</option>";
    });
    docSelect.innerHTML = html;
  }

  function getFilteredAppointments() {
    var qRaw = filters.search.trim().toLowerCase();
    var qDigits = toAsciiDigits(qRaw);

    return appointments.filter(function (row) {
      if (filters.doctor !== "All" && (row.doctor_name || "") !== filters.doctor) {
        return false;
      }
      if (filters.status !== "All" && row.status !== filters.status) {
        return false;
      }
      if (filters.date && row.appointment_date !== filters.date) {
        return false;
      }
      if (qRaw) {
        var pName = String(row.patient_name || "").toLowerCase();
        var pPhone = toAsciiDigits(String(row.patient_phone || "")).toLowerCase();
        var docName = String(row.doctor_name || "").toLowerCase();
        var matchName = pName.indexOf(qRaw) !== -1;
        var matchPhone = pPhone.indexOf(qDigits) !== -1;
        var matchDoc = docName.indexOf(qRaw) !== -1;
        if (!matchName && !matchPhone && !matchDoc) return false;
      }
      return true;
    });
  }

  function syncClearButtonVisibility() {
    var hasFilter =
      filters.search.trim() !== "" ||
      filters.doctor !== "All" ||
      filters.status !== "All" ||
      filters.date !== "";
    var clearBtn = $("clearFiltersBtn");
    if (clearBtn) clearBtn.classList.toggle("hidden", !hasFilter);
  }

  function updatePrintHeaderMeta(list) {
    var metaEl = $("printMetaLine");
    if (!metaEl) return;
    var parts = [];
    parts.push("তারিখ (Date): " + (filters.date || "সকল তারিখ / All Dates"));
    if (filters.doctor !== "All") {
      var bnDoc = lookupBanglaDoctorName(filters.doctor);
      parts.push("ডাক্তার: " + (bnDoc ? bnDoc + " (" + filters.doctor + ")" : filters.doctor));
    }
    if (filters.status !== "All") {
      parts.push("স্ট্যাটাস: " + filters.status);
    }
    parts.push("মোট রোগী (Total): " + list.length);
    parts.push("প্রিন্ট সময়: " + new Date().toLocaleString("en-GB"));
    metaEl.textContent = parts.join("  |  ");
  }

  function renderTable() {
    var tbody = $("appointmentsTbody");
    var empty = $("emptyState");
    var meta = $("resultsMeta");
    if (!tbody) return;

    syncClearButtonVisibility();
    var list = getFilteredAppointments();
    updatePrintHeaderMeta(list);

    if (meta) {
      meta.textContent =
        "Showing " + list.length + " of " + appointments.length + " appointment" + (appointments.length === 1 ? "" : "s");
    }

    if (!list.length) {
      tbody.innerHTML = "";
      if (empty) empty.classList.remove("hidden");
      return;
    }

    if (empty) empty.classList.add("hidden");

    tbody.innerHTML = list.map(function (row, idx) {
      var serialCode = getRowSerialCode(row, idx);
      var dateInfo = formatDateBadge(row.appointment_date);
      var createdStr = formatCreatedAt(row.created_at);
      var bnSub = lookupBanglaDoctorName(row.doctor_name);
      var waLink = buildPatientWhatsAppLink(row, serialCode);
      var currentStatus = STATUSES.indexOf(row.status) !== -1 ? row.status : "Pending";

      var statusOptions = STATUSES.map(function (st) {
        var sel = st === currentStatus ? " selected" : "";
        return '<option value="' + st + '"' + sel + ">" + st + "</option>";
      }).join("");

      return (
        '<tr class="hover:bg-slate-50/80 transition align-top">' +
          // 0. Serial No (SL-XX Badge)
          '<td class="py-3.5 px-3 text-center whitespace-nowrap">' +
            '<span class="inline-flex items-center justify-center rounded-lg bg-brand-50 border border-brand-200 px-2 py-1 text-xs font-extrabold text-brand-800 whitespace-nowrap">' +
              escapeHtml(serialCode) +
            "</span>" +
          "</td>" +

          // 1. Patient & Phone
          '<td class="py-3.5 px-4">' +
            '<p class="font-bold text-slate-900 leading-snug">' + escapeHtml(row.patient_name || "—") + "</p>" +
            '<div class="mt-1 flex items-center gap-2 text-xs">' +
              '<a href="tel:' + escapeHtml(normalizePhone(row.patient_phone)) + '" class="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline whitespace-nowrap">' +
                '<svg class="no-print w-3.5 h-3.5"><use href="#i-phone"/></svg>' +
                "<span>" + escapeHtml(row.patient_phone || "—") + "</span>" +
              "</a>" +
            "</div>" +
          "</td>" +

          // 2. Doctor & Department
          '<td class="py-3.5 px-4">' +
            '<p class="font-semibold text-slate-800 leading-snug">' + escapeHtml(row.doctor_name || "Duty Doctor") + "</p>" +
            (bnSub ? '<p class="text-xs text-slate-500">' + escapeHtml(bnSub) + "</p>" : "") +
            (row.department
              ? '<span class="mt-1 inline-block rounded-full bg-brand-50 text-brand-700 border border-brand-100 px-2.5 py-0.5 text-[11px] font-semibold">' +
                  escapeHtml(row.department) +
                "</span>"
              : "") +
          "</td>" +

          // 3. Appointment Date & Booked Time
          '<td class="py-3.5 px-4 whitespace-nowrap">' +
            '<div class="font-bold text-slate-900">' +
              escapeHtml(dateInfo.label) + dateInfo.pill +
            "</div>" +
            (dateInfo.sub ? '<p class="text-xs text-slate-500 mt-0.5">' + escapeHtml(dateInfo.sub) + "</p>" : "") +
            (createdStr ? '<p class="no-print text-[11px] text-slate-400 mt-0.5">Booked: ' + escapeHtml(createdStr) + "</p>" : "") +
          "</td>" +

          // 4. Reception Notes
          '<td class="py-3.5 px-4 max-w-[220px]">' +
            (row.notes
              ? '<p class="text-xs text-slate-700 leading-relaxed break-words">' + escapeHtml(row.notes) + "</p>"
              : '<span class="no-print text-xs text-slate-300 italic">No notes</span>') +
          "</td>" +

          // 5. Inline Status Select (Screen) + Plain Text Status (Print)
          '<td class="py-3.5 px-4">' +
            '<span class="print-only font-semibold">' + escapeHtml(currentStatus) + "</span>" +
            '<label class="sr-only">Update status for ' + escapeHtml(row.patient_name) + "</label>" +
            '<select data-inline-status="' + escapeHtml(row.id) + '" ' +
                    'class="no-print status-select-' + currentStatus + ' w-full rounded-xl border px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer transition">' +
              statusOptions +
            "</select>" +
          "</td>" +

          // 6. Send Slip on WhatsApp + Edit + Delete Actions (Hidden on Print)
          '<td class="no-print py-3.5 px-4 text-right whitespace-nowrap">' +
            '<div class="inline-flex items-center gap-1.5">' +
              (waLink
                ? '<a href="' + escapeHtml(waLink) + '" target="_blank" rel="noopener" title="Send Slip on WhatsApp" ' +
                    'class="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1.5 shadow-sm transition whitespace-nowrap">' +
                    '<svg class="w-3.5 h-3.5"><use href="#i-wa"/></svg>' +
                    '<span>Send Slip</span>' +
                  "</a>"
                : "") +
              '<button type="button" data-edit-id="' + escapeHtml(row.id) + '" title="Edit serial" ' +
                      'class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-200 text-slate-600 hover:text-brand-700 transition">' +
                '<svg class="w-4 h-4"><use href="#i-edit"/></svg>' +
              "</button>" +
              '<button type="button" data-delete-id="' + escapeHtml(row.id) + '" title="Delete serial" ' +
                      'class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 transition">' +
                '<svg class="w-4 h-4"><use href="#i-trash"/></svg>' +
              "</button>" +
            "</div>" +
          "</td>" +
        "</tr>"
      );
    }).join("");
  }

  /* ------------ CSV / Excel Export & Print Sheet ------------ */
  function csvCell(val) {
    var s = String(val == null ? "" : val).replace(/\r?\n/g, " ").trim();
    // Prevent accidental Excel formula execution on user-supplied text
    if (/^[=+\-@]/.test(s)) {
      s = " " + s;
    }
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function csvPhoneFormula(rawPhone) {
    var normalized = normalizePhone(rawPhone);
    var safe = (normalized || String(rawPhone || "")).replace(/["\r\n,]/g, "").trim();
    if (!safe) return '""';
    // Excel formula literal ="017XXXXXXXX" preserves the leading zero cleanly
    return '="' + safe + '"';
  }

  function exportFilteredToCsv() {
    var list = getFilteredAppointments();
    if (!list.length) {
      window.alert("ডাউনলোড করার মতো কোনো সিরিয়াল পাওয়া যায়নি।");
      return;
    }

    var headers = [
      "Serial No",
      "Patient Name",
      "Phone Number",
      "Doctor",
      "Department",
      "Date",
      "Status",
      "Notes"
    ];

    var lines = [headers.join(",")];

    list.forEach(function (row, idx) {
      var bnDoc = lookupBanglaDoctorName(row.doctor_name);
      var doctorDisplay = bnDoc
        ? row.doctor_name + " (" + bnDoc + ")"
        : (row.doctor_name || "");

      lines.push([
        csvCell(getRowSerialCode(row, idx)),
        csvCell(row.patient_name),
        csvPhoneFormula(row.patient_phone),
        csvCell(doctorDisplay),
        csvCell(row.department),
        csvCell(row.appointment_date),
        csvCell(row.status || "Pending"),
        csvCell(row.notes || "")
      ].join(","));
    });

    // Prepend UTF-8 BOM (\uFEFF) so Bangla names open cleanly in Microsoft Excel
    var csvContent = "\uFEFF" + lines.join("\r\n");
    var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);

    var fileDate = filters.date || todayIso();
    var filename = "Delta-Medical-Serials-" + fileDate + ".csv";

    var link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);

    showToast("Downloaded " + list.length + " serial(s) to " + filename);
  }

  function handlePrintList() {
    var list = getFilteredAppointments();
    updatePrintHeaderMeta(list);
    window.print();
  }

  /* ------------ Supabase CRUD Operations ------------ */
  function loadAppointments(silent) {
    if (!window.supabaseClient) return Promise.resolve();
    var icon = $("refreshIcon");
    if (icon && !silent) icon.classList.add("animate-spin");

    return window.supabaseClient
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: true })
      .order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) {
          setDbError(res.error.message);
          return;
        }
        setDbError("");
        appointments = Array.isArray(res.data) ? res.data : [];
        populateDoctorFilter();
        updateCounters();
        renderTable();
      })
      .catch(function (err) {
        setDbError((err && err.message) || "Failed to load appointments.");
      })
      .finally(function () {
        if (icon) icon.classList.remove("animate-spin");
      });
  }

  function handleInlineStatusChange(selectEl) {
    var idStr = selectEl.getAttribute("data-inline-status");
    var row = findRowById(idStr);
    if (!row) return;

    var prevStatus = row.status;
    var nextStatus = selectEl.value;
    if (prevStatus === nextStatus) return;

    selectEl.disabled = true;
    window.supabaseClient
      .from("appointments")
      .update({ status: nextStatus })
      .eq("id", row.id)
      .then(function (res) {
        if (res.error) {
          selectEl.value = prevStatus;
          showToast("Failed to update status: " + res.error.message, true);
          return;
        }
        row.status = nextStatus;
        selectEl.className =
          "no-print status-select-" + nextStatus +
          " w-full rounded-xl border px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer transition";
        var printSpan = selectEl.parentElement && selectEl.parentElement.querySelector("span.print-only");
        if (printSpan) printSpan.textContent = nextStatus;
        updateCounters();
        if (filters.status !== "All") renderTable();
        showToast("Status updated to " + nextStatus);
      })
      .catch(function (err) {
        selectEl.value = prevStatus;
        showToast((err && err.message) || "Network error", true);
      })
      .finally(function () {
        selectEl.disabled = false;
      });
  }

  /* ------------ Create & Edit Modal Logic ------------ */
  function showModalError(msg) {
    var errEl = $("modalError");
    if (!errEl) return;
    if (!msg) {
      errEl.textContent = "";
      errEl.classList.add("hidden");
    } else {
      errEl.textContent = msg;
      errEl.classList.remove("hidden");
    }
  }

  function openCreateModal() {
    $("mId").value = "";
    $("mPatientName").value = "";
    $("mPatientPhone").value = "";
    $("mQuickPreset").value = "";
    $("mDoctorName").value = "";
    $("mDepartment").value = "";
    $("mDate").value = filters.date || todayIso();
    $("mStatus").value = "Pending";
    $("mNotes").value = "";

    $("modalTitle").textContent = "+ New Serial Booking";
    $("modalSubtitle").textContent = "Log walk-in or phone call booking directly into Supabase";
    $("modalSaveBtn").textContent = "Create Serial";
    showModalError("");

    var dlg = $("serialModal");
    if (dlg && typeof dlg.showModal === "function") dlg.showModal();
    setTimeout(function () { $("mPatientName").focus(); }, 60);
  }

  function openEditModal(idStr) {
    var row = findRowById(idStr);
    if (!row) return;

    $("mId").value = String(row.id);
    $("mPatientName").value = row.patient_name || "";
    $("mPatientPhone").value = row.patient_phone || "";
    $("mQuickPreset").value = "";
    $("mDoctorName").value = row.doctor_name || "";
    $("mDepartment").value = row.department || "";
    $("mDate").value = row.appointment_date || todayIso();
    $("mStatus").value = STATUSES.indexOf(row.status) !== -1 ? row.status : "Pending";
    $("mNotes").value = row.notes || "";

    $("modalTitle").textContent = "Edit Serial Booking";
    $("modalSubtitle").textContent = "Modify patient details, doctor, date, status, or reception notes";
    $("modalSaveBtn").textContent = "Save Changes";
    showModalError("");

    var dlg = $("serialModal");
    if (dlg && typeof dlg.showModal === "function") dlg.showModal();
  }

  function closeSerialModal() {
    var dlg = $("serialModal");
    if (dlg && dlg.open) dlg.close();
  }

  function handleModalSubmit(e) {
    e.preventDefault();
    var editingIdStr = $("mId").value;
    var patient_name = ($("mPatientName").value || "").trim();
    var patient_phone = normalizePhone($("mPatientPhone").value);
    var doctor_name = ($("mDoctorName").value || "").trim();
    var department = ($("mDepartment").value || "").trim();
    var appointment_date = $("mDate").value || "";
    var status = $("mStatus").value || "Pending";
    var notes = ($("mNotes").value || "").trim();

    if (patient_name.length < 2) {
      showModalError("Please enter the patient's name.");
      $("mPatientName").focus();
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(patient_phone) && patient_phone.length < 7) {
      showModalError("Please enter a valid mobile number (e.g. 017XXXXXXXX).");
      $("mPatientPhone").focus();
      return;
    }
    if (!doctor_name) {
      showModalError("Please specify a doctor name (or select a preset).");
      $("mDoctorName").focus();
      return;
    }
    if (!department) {
      showModalError("Please specify a department.");
      $("mDepartment").focus();
      return;
    }
    if (!appointment_date) {
      showModalError("Please choose an appointment date.");
      $("mDate").focus();
      return;
    }

    var payload = {
      patient_name: patient_name,
      patient_phone: patient_phone,
      doctor_name: doctor_name,
      department: department,
      appointment_date: appointment_date,
      status: status,
      notes: notes || null
    };

    var saveBtn = $("modalSaveBtn");
    saveBtn.disabled = true;
    var originalText = saveBtn.textContent;
    saveBtn.textContent = "Saving…";
    showModalError("");

    var req;
    if (editingIdStr) {
      var existing = findRowById(editingIdStr);
      var targetId = existing ? existing.id : editingIdStr;
      req = window.supabaseClient
        .from("appointments")
        .update(payload)
        .eq("id", targetId);
    } else {
      // Assign next sequential daily serial_no for the same doctor & appointment_date
      var maxSerial = 0;
      appointments.forEach(function (r) {
        if (
          r.appointment_date === appointment_date &&
          String(r.doctor_name || "").trim().toLowerCase() === doctor_name.toLowerCase()
        ) {
          var sn = parseInt(r.serial_no, 10);
          if (!isNaN(sn) && sn > maxSerial) maxSerial = sn;
        }
      });
      var insertPayload = Object.assign({}, payload, { serial_no: maxSerial + 1 });
      req = window.supabaseClient
        .from("appointments")
        .insert([insertPayload])
        .then(function (res) {
          if (res.error && /serial_no/i.test(res.error.message || "")) {
            return window.supabaseClient.from("appointments").insert([payload]);
          }
          return res;
        });
    }

    req
      .then(function (res) {
        if (res.error) {
          showModalError(res.error.message || "Could not save appointment.");
          return;
        }
        closeSerialModal();
        showToast(editingIdStr ? "Appointment updated" : "New serial created");
        return loadAppointments(true);
      })
      .catch(function (err) {
        showModalError((err && err.message) || "Network error while saving.");
      })
      .finally(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      });
  }

  /* ------------ Tab Switcher (Appointments vs Manage Doctors) ------------ */
  function switchTab(tabName) {
    activeTab = tabName === "doctors" ? "doctors" : "appointments";
    var isAppt = activeTab === "appointments";

    var apptBtn = $("tabAppointmentsBtn");
    var docBtn = $("tabDoctorsBtn");
    var apptPanel = $("appointmentsPanel");
    var docPanel = $("doctorsPanel");
    var apptBadge = $("tabAppointmentsCount");
    var docBadge = $("tabDoctorsCount");

    if (apptPanel) apptPanel.classList.toggle("hidden", !isAppt);
    if (docPanel) docPanel.classList.toggle("hidden", isAppt);

    if (apptBtn) {
      apptBtn.setAttribute("aria-selected", isAppt ? "true" : "false");
      apptBtn.className =
        "flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition cursor-pointer " +
        (isAppt ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100");
    }
    if (docBtn) {
      docBtn.setAttribute("aria-selected", !isAppt ? "true" : "false");
      docBtn.className =
        "flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition cursor-pointer " +
        (!isAppt ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100");
    }
    if (apptBadge) {
      apptBadge.className =
        "rounded-full px-2 py-0.5 text-xs font-extrabold " +
        (isAppt ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-700");
    }
    if (docBadge) {
      docBadge.className =
        "rounded-full px-2 py-0.5 text-xs font-extrabold " +
        (!isAppt ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-700");
    }
  }

  /* ------------ Manage Doctors CRUD (`doctors` table) ------------ */
  function findDoctorById(idStr) {
    return doctorsList.find(function (d) {
      return String(d.id) === String(idStr);
    });
  }

  function updateDoctorCounters() {
    var total = doctorsList.length;
    var active = 0;
    var offDuty = 0;
    doctorsList.forEach(function (d) {
      if (d.is_active) active++;
      else offDuty++;
    });

    if ($("docCountTotal")) $("docCountTotal").textContent = String(total);
    if ($("docCountActive")) $("docCountActive").textContent = String(active);
    if ($("docCountOffDuty")) $("docCountOffDuty").textContent = String(offDuty);
    if ($("tabDoctorsCount")) $("tabDoctorsCount").textContent = String(total);
  }

  function getFilteredDoctors() {
    var q = docFilters.search.trim().toLowerCase();
    return doctorsList.filter(function (doc) {
      if (docFilters.active === "active" && !doc.is_active) return false;
      if (docFilters.active === "inactive" && doc.is_active) return false;
      if (q) {
        var hay = [
          doc.name_bn, doc.name_en,
          doc.qualifications,
          doc.specialty_bn, doc.specialty_en,
          doc.visiting_days, doc.visiting_hours,
          doc.room_no
        ].join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  var isReorderingDoctors = false;

  function renderDoctorsTable() {
    var tbody = $("doctorsTbody");
    var empty = $("doctorsEmptyState");
    var meta = $("doctorsResultsMeta");
    var seedBtn = $("seedDoctorsBtn");
    if (!tbody) return;

    var list = getFilteredDoctors();
    if (meta) {
      meta.textContent =
        "Showing " + list.length + " of " + doctorsList.length + " doctor" + (doctorsList.length === 1 ? "" : "s");
    }

    if (!list.length) {
      tbody.innerHTML = "";
      if (empty) empty.classList.remove("hidden");
      if (seedBtn) {
        var showSeed = doctorsList.length === 0 && Array.isArray(window.DOCTORS) && window.DOCTORS.length > 0;
        seedBtn.classList.toggle("hidden", !showSeed);
      }
      return;
    }

    if (empty) empty.classList.add("hidden");

    tbody.innerHTML = list.map(function (doc, idx) {
      var fullIdx = doctorsList.indexOf(doc);
      var positionLabel =
        doc.display_order != null && doc.display_order !== ""
          ? doc.display_order
          : (fullIdx !== -1 ? fullIdx + 1 : idx + 1);
      var isFirst = fullIdx <= 0 || isReorderingDoctors;
      var isLast = fullIdx === -1 || fullIdx >= doctorsList.length - 1 || isReorderingDoctors;

      var isActive = doc.is_active !== false;
      var switchTrack = isActive ? "bg-emerald-500" : "bg-slate-300";
      var switchKnob = isActive ? "translate-x-5" : "translate-x-0.5";
      var statusBadge = isActive
        ? '<span class="text-xs font-bold text-emerald-700">Active</span>'
        : '<span class="text-xs font-bold text-slate-500">Off-Duty</span>';

      return (
        '<tr class="hover:bg-slate-50/80 transition align-top">' +
          // ক্রম (Order) with position number + Up / Down controls
          '<td class="py-3.5 px-3 whitespace-nowrap">' +
            '<div class="inline-flex items-center justify-center gap-1.5 w-full">' +
              '<span class="inline-flex items-center justify-center min-w-[1.75rem] h-7 rounded-lg bg-brand-50 text-brand-800 font-extrabold text-xs px-1.5 border border-brand-100">' +
                escapeHtml(positionLabel) +
              "</span>" +
              '<div class="inline-flex items-center gap-0.5">' +
                '<button type="button" data-move-doctor="' + escapeHtml(doc.id) + '" data-move-dir="up"' +
                        (isFirst ? " disabled" : "") +
                        ' title="Move up" aria-label="Move ' + escapeHtml(doc.name_en || doc.name_bn) + ' up"' +
                        ' class="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 text-slate-600 text-xs font-bold transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-600">↑</button>' +
                '<button type="button" data-move-doctor="' + escapeHtml(doc.id) + '" data-move-dir="down"' +
                        (isLast ? " disabled" : "") +
                        ' title="Move down" aria-label="Move ' + escapeHtml(doc.name_en || doc.name_bn) + ' down"' +
                        ' class="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 text-slate-600 text-xs font-bold transition cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-600">↓</button>' +
              "</div>" +
            "</div>" +
          "</td>" +

          // Doctor Name & Qualifications
          '<td class="py-3.5 px-4">' +
            '<p class="font-bold text-slate-900 leading-snug">' + escapeHtml(doc.name_bn || doc.name_en || "—") + "</p>" +
            (doc.name_en && doc.name_en !== doc.name_bn
              ? '<p class="text-xs font-semibold text-brand-700 mt-0.5">' + escapeHtml(doc.name_en) + "</p>"
              : "") +
            (doc.qualifications
              ? '<p class="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs">' + escapeHtml(doc.qualifications) + "</p>"
              : "") +
          "</td>" +

          // Specialty (BN & EN)
          '<td class="py-3.5 px-4">' +
            (doc.specialty_bn
              ? '<span class="inline-block rounded-full bg-brand-50 text-brand-800 border border-brand-100 px-2.5 py-0.5 text-xs font-bold">' +
                  escapeHtml(doc.specialty_bn) +
                "</span>"
              : "") +
            (doc.specialty_en
              ? '<p class="text-xs text-slate-500 mt-1">' + escapeHtml(doc.specialty_en) + "</p>"
              : "") +
          "</td>" +

          // Visiting Days & Hours
          '<td class="py-3.5 px-4">' +
            '<span class="inline-block rounded-md bg-slate-100 text-slate-800 px-2 py-0.5 text-xs font-bold">' +
              escapeHtml(doc.visiting_days || "—") +
            "</span>" +
            (doc.visiting_hours
              ? '<p class="text-xs font-medium text-slate-600 mt-1">' + escapeHtml(doc.visiting_hours) + "</p>"
              : "") +
          "</td>" +

          // Room No
          '<td class="py-3.5 px-4 whitespace-nowrap">' +
            (doc.room_no
              ? '<span class="inline-block rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">' +
                  escapeHtml(doc.room_no) +
                "</span>"
              : '<span class="text-xs text-slate-300 italic">—</span>') +
          "</td>" +

          // Quick Active / Off-Duty Toggle Switch
          '<td class="py-3.5 px-4 whitespace-nowrap">' +
            '<div class="inline-flex items-center gap-2.5">' +
              '<button type="button" role="switch" aria-checked="' + (isActive ? "true" : "false") + '" ' +
                      'data-toggle-doctor="' + escapeHtml(doc.id) + '" ' +
                      'title="Toggle Active / Off-Duty status" ' +
                      'class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 ' + switchTrack + '">' +
                '<span class="sr-only">Toggle duty status for ' + escapeHtml(doc.name_en || doc.name_bn) + "</span>" +
                '<span class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ' + switchKnob + '"></span>' +
              "</button>" +
              statusBadge +
            "</div>" +
          "</td>" +

          // Edit & Delete Actions
          '<td class="py-3.5 px-4 text-right whitespace-nowrap">' +
            '<div class="inline-flex items-center gap-1.5">' +
              '<button type="button" data-edit-doctor="' + escapeHtml(doc.id) + '" title="Edit doctor" ' +
                      'class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-brand-50 hover:border-brand-200 text-slate-600 hover:text-brand-700 transition">' +
                '<svg class="w-4 h-4"><use href="#i-edit"/></svg>' +
              "</button>" +
              '<button type="button" data-delete-doctor="' + escapeHtml(doc.id) + '" title="Delete doctor" ' +
                      'class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 transition">' +
                '<svg class="w-4 h-4"><use href="#i-trash"/></svg>' +
              "</button>" +
            "</div>" +
          "</td>" +
        "</tr>"
      );
    }).join("");
  }

  function moveDoctorOrder(idStr, direction) {
    if (!window.supabaseClient || isReorderingDoctors) return;
    var idx = doctorsList.findIndex(function (d) {
      return String(d.id) === String(idStr);
    });
    if (idx === -1) return;

    var swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= doctorsList.length) return;

    isReorderingDoctors = true;
    renderDoctorsTable();

    // Normalize all rows to sequential display_order (1, 2, 3...) and swap the two neighbors
    var reordered = doctorsList.slice();
    var temp = reordered[idx];
    reordered[idx] = reordered[swapIdx];
    reordered[swapIdx] = temp;

    var updates = [];
    reordered.forEach(function (doc, positionIdx) {
      var targetOrder = positionIdx + 1;
      var isSwappedRow = positionIdx === idx || positionIdx === swapIdx;
      var currentOrder = doc.display_order != null ? Number(doc.display_order) : null;
      if (isSwappedRow || currentOrder !== targetOrder) {
        updates.push({ id: doc.id, display_order: targetOrder });
      }
    });

    Promise.all(
      updates.map(function (item) {
        return window.supabaseClient
          .from("doctors")
          .update({ display_order: item.display_order })
          .eq("id", item.id);
      })
    )
      .then(function (results) {
        var failed = results.find(function (r) { return r && r.error; });
        if (failed) {
          showToast("Order update failed: " + failed.error.message, true);
          return;
        }
        showToast("Doctor order updated");
        return loadDoctors(true);
      })
      .catch(function (err) {
        showToast((err && err.message) || "Failed to update doctor order", true);
      })
      .finally(function () {
        isReorderingDoctors = false;
        renderDoctorsTable();
      });
  }

  // Expose helper on window for standard script compatibility
  window.moveDoctorOrder = moveDoctorOrder;

  /* ------------ Live Chamber Queue ("Now Serving") Controls ------------ */
  var queueUpdatingIds = {};

  function renderLiveQueueControls() {
    var grid = $("liveQueueControlGrid");
    var datePill = $("liveQueueDatePill");
    if (!grid) return;

    var today = todayIso();
    if (datePill) datePill.textContent = "Today: " + today;

    var activeDocs = doctorsList.filter(function (d) {
      return d.is_active !== false;
    });

    if (!activeDocs.length) {
      grid.innerHTML =
        '<p class="text-xs text-slate-500 col-span-full">No active doctors found in the <code>doctors</code> table yet. Add or activate doctors under the Manage Doctors tab.</p>';
      return;
    }

    grid.innerHTML = activeDocs.map(function (doc) {
      var isToday = String(doc.queue_updated_date || "").slice(0, 10) === today;
      var currentNum = isToday && Number(doc.current_serial) > 0 ? Number(doc.current_serial) : 0;
      var isBusy = !!queueUpdatingIds[String(doc.id)];
      var slLabel = currentNum > 0 ? formatSerialCode(currentNum) : "শুরু হয়নি";
      var badgeClass = currentNum > 0
        ? "bg-emerald-100 border-emerald-300 text-emerald-900"
        : "bg-slate-100 border-slate-200 text-slate-500";

      return (
        '<div class="min-w-0 bg-white rounded-xl border ' + (currentNum > 0 ? "border-emerald-200" : "border-slate-200") + ' p-3.5 shadow-sm flex flex-col justify-between gap-3">' +
          '<div class="flex items-start justify-between gap-2 min-w-0">' +
            '<div class="min-w-0 flex-1">' +
              '<p class="font-bold text-slate-900 text-sm leading-snug truncate">' + escapeHtml(doc.name_bn || doc.name_en || "—") + "</p>" +
              (doc.name_en && doc.name_en !== doc.name_bn
                ? '<p class="text-[11px] font-semibold text-brand-700 truncate">' + escapeHtml(doc.name_en) + "</p>"
                : "") +
              (doc.room_no
                ? '<p class="text-[11px] text-slate-400 truncate mt-0.5">' + escapeHtml(doc.room_no) + "</p>"
                : "") +
            "</div>" +
            '<span class="inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-extrabold whitespace-nowrap shrink-0 ' + badgeClass + '">' +
              escapeHtml(slLabel) +
            "</span>" +
          "</div>" +

          '<div class="grid grid-cols-3 gap-1.5">' +
            '<button type="button" data-queue-doctor="' + escapeHtml(doc.id) + '" data-queue-action="prev"' +
                    ((currentNum <= 0 || isBusy) ? " disabled" : "") +
                    ' class="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs py-2 px-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">-1</button>' +
            '<button type="button" data-queue-doctor="' + escapeHtml(doc.id) + '" data-queue-action="next"' +
                    (isBusy ? " disabled" : "") +
                    ' class="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-2 shadow-sm transition cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">+1 Next</button>' +
            '<button type="button" data-queue-doctor="' + escapeHtml(doc.id) + '" data-queue-action="reset"' +
                    ((currentNum <= 0 || isBusy) ? " disabled" : "") +
                    ' class="rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-2 px-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Reset</button>' +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  function updateDoctorQueue(doctorId, action) {
    if (!window.supabaseClient) return;
    var key = String(doctorId);
    if (queueUpdatingIds[key]) return;
    var doc = findDoctorById(doctorId);
    if (!doc) return;

    var today = todayIso();
    var isToday = String(doc.queue_updated_date || "").slice(0, 10) === today;
    var currentNum = isToday && Number(doc.current_serial) > 0 ? Number(doc.current_serial) : 0;

    var nextSerial = currentNum;
    if (action === "next") nextSerial = currentNum + 1;
    else if (action === "prev") nextSerial = Math.max(0, currentNum - 1);
    else if (action === "reset") nextSerial = 0;

    queueUpdatingIds[key] = true;
    renderLiveQueueControls();

    window.supabaseClient
      .from("doctors")
      .update({
        current_serial: nextSerial,
        queue_updated_date: today
      })
      .eq("id", doc.id)
      .then(function (res) {
        if (res.error) {
          showToast("Queue update failed: " + res.error.message, true);
          return;
        }
        doc.current_serial = nextSerial;
        doc.queue_updated_date = today;
        var label = nextSerial > 0
          ? "Now Serving " + formatSerialCode(nextSerial)
          : "Queue Reset";
        showToast((doc.name_en || doc.name_bn) + " — " + label);
      })
      .catch(function (err) {
        showToast((err && err.message) || "Failed to update live queue", true);
      })
      .finally(function () {
        delete queueUpdatingIds[key];
        renderLiveQueueControls();
      });
  }

  window.updateDoctorQueue = updateDoctorQueue;

  function loadDoctors(silent) {
    if (!window.supabaseClient) return Promise.resolve();
    var icon = $("refreshIcon");
    if (icon && !silent) icon.classList.add("animate-spin");

    return window.supabaseClient
      .from("doctors")
      .select("*")
      .order("display_order", { ascending: true })
      .order("id", { ascending: true })
      .then(function (res) {
        if (res.error) {
          if (activeTab === "doctors") {
            setDbError("Doctors table: " + res.error.message);
          }
          return;
        }
        if (activeTab === "doctors") setDbError("");
        doctorsList = Array.isArray(res.data) ? res.data : [];
        updateDoctorCounters();
        renderLiveQueueControls();
        renderDoctorsTable();
        populateModalPresets();
        populateDoctorFilter();
      })
      .catch(function (err) {
        if (activeTab === "doctors") {
          setDbError((err && err.message) || "Failed to load doctors.");
        }
      })
      .finally(function () {
        if (icon) icon.classList.remove("animate-spin");
      });
  }

  function handleToggleDoctorActive(btn) {
    var idStr = btn.getAttribute("data-toggle-doctor");
    var doc = findDoctorById(idStr);
    if (!doc) return;

    var prevState = doc.is_active !== false;
    var nextState = !prevState;
    btn.disabled = true;

    window.supabaseClient
      .from("doctors")
      .update({ is_active: nextState })
      .eq("id", doc.id)
      .then(function (res) {
        if (res.error) {
          showToast("Failed to update status: " + res.error.message, true);
          return;
        }
        doc.is_active = nextState;
        updateDoctorCounters();
        renderLiveQueueControls();
        renderDoctorsTable();
        populateModalPresets();
        showToast((doc.name_en || doc.name_bn) + " is now " + (nextState ? "Active" : "Off-Duty"));
      })
      .catch(function (err) {
        showToast((err && err.message) || "Network error", true);
      })
      .finally(function () {
        btn.disabled = false;
      });
  }

  function showDoctorModalError(msg) {
    var errEl = $("doctorModalError");
    if (!errEl) return;
    if (!msg) {
      errEl.textContent = "";
      errEl.classList.add("hidden");
    } else {
      errEl.textContent = msg;
      errEl.classList.remove("hidden");
    }
  }

  function openAddDoctorModal() {
    $("dId").value = "";
    $("dNameBn").value = "";
    $("dNameEn").value = "";
    $("dQualifications").value = "";
    $("dSpecialtyBn").value = "";
    $("dSpecialtyEn").value = "";
    $("dVisitingDays").value = "";
    $("dVisitingHours").value = "";
    $("dRoomNo").value = "";
    $("dDisplayOrder").value = "";
    $("dIsActive").checked = true;

    $("doctorModalTitle").textContent = "+ নতুন ডাক্তার যোগ করুন (Add Doctor)";
    $("doctorModalSubtitle").textContent = "Add a specialist doctor to the live clinic directory";
    $("doctorModalSaveBtn").textContent = "Add Doctor";
    showDoctorModalError("");

    var dlg = $("doctorModal");
    if (dlg && typeof dlg.showModal === "function") dlg.showModal();
    setTimeout(function () { $("dNameBn").focus(); }, 60);
  }

  function openEditDoctorModal(idStr) {
    var doc = findDoctorById(idStr);
    if (!doc) return;

    $("dId").value = String(doc.id);
    $("dNameBn").value = doc.name_bn || "";
    $("dNameEn").value = doc.name_en || "";
    $("dQualifications").value = doc.qualifications || "";
    $("dSpecialtyBn").value = doc.specialty_bn || "";
    $("dSpecialtyEn").value = doc.specialty_en || "";
    $("dVisitingDays").value = doc.visiting_days || "";
    $("dVisitingHours").value = doc.visiting_hours || "";
    $("dRoomNo").value = doc.room_no || "";
    $("dDisplayOrder").value =
      doc.display_order != null && doc.display_order !== "" ? String(doc.display_order) : "";
    $("dIsActive").checked = doc.is_active !== false;

    $("doctorModalTitle").textContent = "Edit Doctor Details";
    $("doctorModalSubtitle").textContent = "Update chamber schedule, qualifications, room, display order, or duty status";
    $("doctorModalSaveBtn").textContent = "Save Changes";
    showDoctorModalError("");

    var dlg = $("doctorModal");
    if (dlg && typeof dlg.showModal === "function") dlg.showModal();
  }

  function closeDoctorModal() {
    var dlg = $("doctorModal");
    if (dlg && dlg.open) dlg.close();
  }

  function handleDoctorModalSubmit(e) {
    e.preventDefault();
    var editingIdStr = $("dId").value;
    var name_bn = ($("dNameBn").value || "").trim();
    var name_en = ($("dNameEn").value || "").trim();
    var qualifications = ($("dQualifications").value || "").trim();
    var specialty_bn = ($("dSpecialtyBn").value || "").trim();
    var specialty_en = ($("dSpecialtyEn").value || "").trim();
    var visiting_days = ($("dVisitingDays").value || "").trim();
    var visiting_hours = ($("dVisitingHours").value || "").trim();
    var room_no = ($("dRoomNo").value || "").trim();
    var rawDisplayOrder = toAsciiDigits(($("dDisplayOrder").value || "").trim());
    var is_active = !!$("dIsActive").checked;

    if (!name_bn) {
      showDoctorModalError("Please enter the doctor's Bangla name.");
      $("dNameBn").focus();
      return;
    }
    if (!name_en) {
      showDoctorModalError("Please enter the doctor's English name.");
      $("dNameEn").focus();
      return;
    }
    if (!specialty_bn) {
      showDoctorModalError("Please enter the specialty in Bangla.");
      $("dSpecialtyBn").focus();
      return;
    }
    if (!specialty_en) {
      showDoctorModalError("Please enter the specialty in English.");
      $("dSpecialtyEn").focus();
      return;
    }
    if (!visiting_days) {
      showDoctorModalError("Please enter visiting days (e.g. Daily or Friday, Tuesday).");
      $("dVisitingDays").focus();
      return;
    }
    if (!visiting_hours) {
      showDoctorModalError("Please enter visiting hours (e.g. 9:00 AM – 4:00 PM).");
      $("dVisitingHours").focus();
      return;
    }

    var parsedOrder = null;
    if (rawDisplayOrder !== "") {
      parsedOrder = parseInt(rawDisplayOrder, 10);
      if (isNaN(parsedOrder) || parsedOrder < 1) {
        showDoctorModalError("Display Order must be a positive number (1 or higher).");
        $("dDisplayOrder").focus();
        return;
      }
    }

    var payload = {
      name_bn: name_bn,
      name_en: name_en,
      qualifications: qualifications || null,
      specialty_bn: specialty_bn,
      specialty_en: specialty_en,
      visiting_days: visiting_days,
      visiting_hours: visiting_hours,
      room_no: room_no || null,
      is_active: is_active
    };

    // Only set display_order when explicitly provided; leaving blank on Add lets the DB auto-assign
    if (parsedOrder !== null) {
      payload.display_order = parsedOrder;
    }

    var saveBtn = $("doctorModalSaveBtn");
    saveBtn.disabled = true;
    var originalText = saveBtn.textContent;
    saveBtn.textContent = "Saving…";
    showDoctorModalError("");

    var req;
    if (editingIdStr) {
      var existing = findDoctorById(editingIdStr);
      var targetId = existing ? existing.id : editingIdStr;
      req = window.supabaseClient
        .from("doctors")
        .update(payload)
        .eq("id", targetId);
    } else {
      req = window.supabaseClient
        .from("doctors")
        .insert([payload]);
    }

    req
      .then(function (res) {
        if (res.error) {
          showDoctorModalError(res.error.message || "Could not save doctor.");
          return;
        }
        closeDoctorModal();
        showToast(editingIdStr ? "Doctor details updated" : "New doctor added");
        return loadDoctors(true);
      })
      .catch(function (err) {
        showDoctorModalError((err && err.message) || "Network error while saving doctor.");
      })
      .finally(function () {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      });
  }

  function seedHardcodedDoctors() {
    if (!window.supabaseClient || !Array.isArray(window.DOCTORS) || !window.DOCTORS.length) return;
    var btn = $("seedDoctorsBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Importing…";
    }

    var specs = window.SPECIALTIES || {};
    var dayLabels = window.DAY_LABELS || {};

    var rows = window.DOCTORS.map(function (doc, idx) {
      var spBn = (doc.specialties || []).map(function (k) { return specs[k] ? specs[k].bn : k; }).join(", ");
      var spEn = (doc.specialties || []).map(function (k) { return specs[k] ? specs[k].en : k; }).join(", ");

      var daysArr = [];
      var hoursArr = [];
      (doc.schedule || []).forEach(function (slot) {
        if (slot.daily) {
          if (daysArr.indexOf("Daily") === -1) daysArr.push("Daily");
        } else if (Array.isArray(slot.days)) {
          slot.days.forEach(function (dk) {
            var lbl = dayLabels[dk] ? dayLabels[dk].en : dk;
            if (daysArr.indexOf(lbl) === -1) daysArr.push(lbl);
          });
        }
        if (slot.bn) hoursArr.push(slot.bn);
      });

      return {
        name_bn: doc.name.bn,
        name_en: doc.name.en,
        qualifications: doc.degrees.bn || doc.degrees.en || "",
        specialty_bn: spBn || doc.focus.bn || "",
        specialty_en: spEn || doc.focus.en || "",
        visiting_days: daysArr.join(", ") || "Daily",
        visiting_hours: hoursArr.join(" / ") || "",
        room_no: null,
        display_order: idx + 1,
        is_active: true
      };
    });

    window.supabaseClient
      .from("doctors")
      .insert(rows)
      .then(function (res) {
        if (res.error) {
          showToast("Import failed: " + res.error.message, true);
          return;
        }
        showToast("Imported " + rows.length + " clinic doctors");
        return loadDoctors(true);
      })
      .catch(function (err) {
        showToast((err && err.message) || "Import failed", true);
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Import 12 Existing Clinic Doctors";
        }
      });
  }

  /* ------------ Unified Delete Confirmation Logic (Serials & Doctors) ------------ */
  function openDeleteModal(idStr) {
    var row = findRowById(idStr);
    if (!row) return;
    pendingDeleteTarget = { type: "appointment", row: row };
    if ($("delModalTitle")) $("delModalTitle").textContent = "Delete Serial Record?";
    if ($("delModalDesc")) {
      $("delModalDesc").innerHTML =
        'Are you sure you want to permanently remove the serial for <strong class="text-slate-900">' +
        escapeHtml((row.patient_name || "Unnamed") + " (" + (row.appointment_date || "No date") + ")") +
        "</strong>? This action cannot be undone.";
    }
    var dlg = $("deleteModal");
    if (dlg && typeof dlg.showModal === "function") dlg.showModal();
  }

  function openDeleteDoctorModal(idStr) {
    var doc = findDoctorById(idStr);
    if (!doc) return;
    pendingDeleteTarget = { type: "doctor", row: doc };
    if ($("delModalTitle")) $("delModalTitle").textContent = "Delete Doctor?";
    if ($("delModalDesc")) {
      $("delModalDesc").innerHTML =
        'Are you sure you want to permanently remove <strong class="text-slate-900">' +
        escapeHtml((doc.name_bn || "") + (doc.name_en ? " (" + doc.name_en + ")" : "")) +
        "</strong> from the doctors directory? This action cannot be undone.";
    }
    var dlg = $("deleteModal");
    if (dlg && typeof dlg.showModal === "function") dlg.showModal();
  }

  function closeDeleteModal() {
    pendingDeleteTarget = null;
    var dlg = $("deleteModal");
    if (dlg && dlg.open) dlg.close();
  }

  function confirmDelete() {
    if (!pendingDeleteTarget) return;
    var target = pendingDeleteTarget;
    var tableName = target.type === "doctor" ? "doctors" : "appointments";
    var btn = $("delConfirmBtn");
    btn.disabled = true;
    btn.textContent = "Deleting…";

    window.supabaseClient
      .from(tableName)
      .delete()
      .eq("id", target.row.id)
      .then(function (res) {
        if (res.error) {
          showToast("Delete failed: " + res.error.message, true);
          return;
        }
        if (target.type === "doctor") {
          doctorsList = doctorsList.filter(function (d) { return d.id !== target.row.id; });
          updateDoctorCounters();
          renderLiveQueueControls();
          renderDoctorsTable();
          populateModalPresets();
          populateDoctorFilter();
          showToast("Doctor deleted");
        } else {
          appointments = appointments.filter(function (r) { return r.id !== target.row.id; });
          updateCounters();
          renderTable();
          showToast("Serial record deleted");
        }
        closeDeleteModal();
      })
      .catch(function (err) {
        showToast((err && err.message) || "Delete failed", true);
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Yes, Delete";
      });
  }

  /* ------------ Realtime Subscription (Optional Auto-Sync) ------------ */
  function startRealtimeSync() {
    if (!window.supabaseClient || realtimeChannel) return;
    try {
      realtimeChannel = window.supabaseClient
        .channel("admin-clinic-feed")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "appointments" },
          function () {
            loadAppointments(true);
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "doctors" },
          function () {
            loadDoctors(true);
          }
        )
        .subscribe();
    } catch (e) {
      /* Realtime is optional; manual refresh always works */
    }
  }

  function stopRealtimeSync() {
    if (realtimeChannel && window.supabaseClient) {
      try {
        window.supabaseClient.removeChannel(realtimeChannel);
      } catch (e) { /* ignore */ }
      realtimeChannel = null;
    }
  }

  /* ------------ Auth Gate & Session Management ------------ */
  function applySessionView(session) {
    var boot = $("bootLoader");
    var loginView = $("loginView");
    var dashView = $("dashboardView");
    if (boot) boot.classList.add("hidden");

    if (session && session.user) {
      loginView.classList.add("hidden");
      dashView.classList.remove("hidden");
      $("sessionUserEmail").textContent = session.user.email || "Signed in";
      loadAppointments(false);
      loadDoctors(true);
      startRealtimeSync();
    } else {
      stopRealtimeSync();
      appointments = [];
      doctorsList = [];
      dashView.classList.add("hidden");
      loginView.classList.remove("hidden");
    }
  }

  function handleLoginSubmit(e) {
    e.preventDefault();
    var email = ($("loginEmail").value || "").trim();
    var password = $("loginPassword").value || "";
    var errBox = $("loginError");
    var submitBtn = $("loginSubmitBtn");
    var submitText = $("loginSubmitText");

    if (!email || !password) {
      errBox.textContent = "Please enter both your email address and password.";
      errBox.classList.remove("hidden");
      return;
    }

    errBox.classList.add("hidden");
    submitBtn.disabled = true;
    submitText.textContent = "Signing in…";

    window.supabaseClient.auth
      .signInWithPassword({ email: email, password: password })
      .then(function (res) {
        if (res.error) {
          errBox.textContent = res.error.message || "Invalid login credentials.";
          errBox.classList.remove("hidden");
          return;
        }
        $("loginPassword").value = "";
        applySessionView(res.data.session);
      })
      .catch(function (err) {
        errBox.textContent = (err && err.message) || "Unable to connect to authentication server.";
        errBox.classList.remove("hidden");
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitText.textContent = "Sign In to Dashboard";
      });
  }

  function handleLogout() {
    if (!window.supabaseClient) return;
    window.supabaseClient.auth.signOut().then(function () {
      applySessionView(null);
      showToast("Signed out");
    });
  }

  /* ------------ Initialize Event Listeners ------------ */
  function init() {
    if (!window.supabaseClient) {
      $("bootLoader").innerHTML =
        '<div class="max-w-md rounded-2xl bg-rose-50 border border-rose-200 p-6 text-rose-900 text-sm">' +
          '<p class="font-bold text-base">Supabase SDK Unavailable</p>' +
          '<p class="mt-1">Please check your internet connection so @supabase/supabase-js@2 can load from the CDN.</p>' +
        "</div>";
      return;
    }

    populateModalPresets();
    populateDoctorFilter();

    // Auth events
    $("loginForm").addEventListener("submit", handleLoginSubmit);
    $("logoutBtn").addEventListener("click", handleLogout);
    $("togglePasswordBtn").addEventListener("click", function () {
      var pw = $("loginPassword");
      pw.type = pw.type === "password" ? "text" : "password";
    });

    // Tab switcher events
    $("tabAppointmentsBtn").addEventListener("click", function () {
      switchTab("appointments");
    });
    $("tabDoctorsBtn").addEventListener("click", function () {
      switchTab("doctors");
      loadDoctors(false);
    });

    // Top bar & Empty state buttons
    $("newSerialBtn").addEventListener("click", openCreateModal);
    $("emptyNewBtn").addEventListener("click", openCreateModal);
    $("refreshBtn").addEventListener("click", function () {
      loadAppointments(false);
      loadDoctors(false);
    });

    // Quick-fill doctor preset inside Serial modal
    var presetSelect = $("mQuickPreset");
    if (presetSelect) {
      presetSelect.addEventListener("change", function () {
        if (!presetSelect.value) return;
        try {
          var parsed = JSON.parse(presetSelect.value);
          if (parsed.doctor) $("mDoctorName").value = parsed.doctor;
          if (parsed.dept) $("mDepartment").value = parsed.dept;
        } catch (e) { /* ignore */ }
      });
    }

    // Export CSV & Print Sheet buttons
    $("exportCsvBtn").addEventListener("click", exportFilteredToCsv);
    $("printSheetBtn").addEventListener("click", handlePrintList);

    // Live Chamber Queue ("Now Serving") Controls
    var queueGrid = $("liveQueueControlGrid");
    if (queueGrid) {
      queueGrid.addEventListener("click", function (e) {
        var qBtn = e.target.closest("[data-queue-doctor]");
        if (!qBtn || qBtn.disabled) return;
        updateDoctorQueue(
          qBtn.getAttribute("data-queue-doctor"),
          qBtn.getAttribute("data-queue-action")
        );
      });
    }

    // Manage Doctors toolbar & table events
    $("addDoctorBtn").addEventListener("click", openAddDoctorModal);
    $("emptyAddDoctorBtn").addEventListener("click", openAddDoctorModal);
    if ($("seedDoctorsBtn")) {
      $("seedDoctorsBtn").addEventListener("click", seedHardcodedDoctors);
    }
    $("docFilterSearch").addEventListener("input", function (e) {
      docFilters.search = e.target.value || "";
      renderDoctorsTable();
    });
    $("docFilterActive").addEventListener("change", function (e) {
      docFilters.active = e.target.value || "all";
      renderDoctorsTable();
    });
    $("doctorsTbody").addEventListener("click", function (e) {
      var moveBtn = e.target.closest("[data-move-doctor]");
      if (moveBtn) {
        if (!moveBtn.disabled) {
          moveDoctorOrder(
            moveBtn.getAttribute("data-move-doctor"),
            moveBtn.getAttribute("data-move-dir")
          );
        }
        return;
      }
      var toggleBtn = e.target.closest("[data-toggle-doctor]");
      if (toggleBtn) {
        handleToggleDoctorActive(toggleBtn);
        return;
      }
      var editBtn = e.target.closest("[data-edit-doctor]");
      if (editBtn) {
        openEditDoctorModal(editBtn.getAttribute("data-edit-doctor"));
        return;
      }
      var delBtn = e.target.closest("[data-delete-doctor]");
      if (delBtn) {
        openDeleteDoctorModal(delBtn.getAttribute("data-delete-doctor"));
      }
    });

    // Create / Edit Doctor modal events
    $("doctorModalForm").addEventListener("submit", handleDoctorModalSubmit);
    $("doctorModalCloseBtn").addEventListener("click", closeDoctorModal);
    $("doctorModalCancelBtn").addEventListener("click", closeDoctorModal);
    $("doctorModal").addEventListener("click", function (e) {
      if (e.target === $("doctorModal")) closeDoctorModal();
    });
    if ($("docDayQuickBtns")) {
      $("docDayQuickBtns").addEventListener("click", function (e) {
        var btn = e.target.closest("[data-day-pick]");
        if (!btn) return;
        var dayVal = btn.getAttribute("data-day-pick");
        var input = $("dVisitingDays");
        if (!input) return;
        if (dayVal === "Daily") {
          input.value = "Daily";
          return;
        }
        var current = (input.value || "")
          .split(",")
          .map(function (s) { return s.trim(); })
          .filter(function (s) { return s && s.toLowerCase() !== "daily"; });
        var idx = current.indexOf(dayVal);
        if (idx === -1) current.push(dayVal);
        else current.splice(idx, 1);
        input.value = current.join(", ");
      });
    }

    // Filters
    $("filterSearch").addEventListener("input", function (e) {
      filters.search = e.target.value || "";
      renderTable();
    });
    $("filterDoctor").addEventListener("change", function (e) {
      filters.doctor = e.target.value || "All";
      renderTable();
    });
    $("filterStatus").addEventListener("change", function (e) {
      filters.status = e.target.value || "All";
      renderTable();
    });
    $("filterDate").addEventListener("change", function (e) {
      filters.date = e.target.value || "";
      renderTable();
    });
    $("filterTodayBtn").addEventListener("click", function () {
      var t = todayIso();
      filters.date = t;
      $("filterDate").value = t;
      renderTable();
    });
    $("clearFiltersBtn").addEventListener("click", function () {
      filters.search = "";
      filters.doctor = "All";
      filters.status = "All";
      filters.date = "";
      $("filterSearch").value = "";
      $("filterDoctor").value = "All";
      $("filterStatus").value = "All";
      $("filterDate").value = "";
      renderTable();
    });

    // Summary card quick filters
    document.querySelectorAll("[data-quick-card]").forEach(function (card) {
      card.addEventListener("click", function () {
        var mode = card.getAttribute("data-quick-card");
        if (mode === "all") {
          filters.status = "All";
          filters.date = "";
        } else if (mode === "today") {
          filters.date = todayIso();
          filters.status = "All";
        } else {
          filters.status = mode;
          filters.date = "";
        }
        $("filterStatus").value = filters.status;
        $("filterDate").value = filters.date;
        renderTable();
      });
    });

    // Table delegated actions (Edit, Delete, Inline Status)
    $("appointmentsTbody").addEventListener("click", function (e) {
      var editBtn = e.target.closest("[data-edit-id]");
      if (editBtn) {
        openEditModal(editBtn.getAttribute("data-edit-id"));
        return;
      }
      var delBtn = e.target.closest("[data-delete-id]");
      if (delBtn) {
        openDeleteModal(delBtn.getAttribute("data-delete-id"));
      }
    });

    $("appointmentsTbody").addEventListener("change", function (e) {
      var selectEl = e.target.closest("[data-inline-status]");
      if (selectEl) {
        handleInlineStatusChange(selectEl);
      }
    });

    // Create / Edit modal events
    $("modalForm").addEventListener("submit", handleModalSubmit);
    $("modalCloseBtn").addEventListener("click", closeSerialModal);
    $("modalCancelBtn").addEventListener("click", closeSerialModal);
    $("serialModal").addEventListener("click", function (e) {
      if (e.target === $("serialModal")) closeSerialModal();
    });

    // Delete modal events
    $("delCancelBtn").addEventListener("click", closeDeleteModal);
    $("delConfirmBtn").addEventListener("click", confirmDelete);
    $("deleteModal").addEventListener("click", function (e) {
      if (e.target === $("deleteModal")) closeDeleteModal();
    });

    // Initial session check + Auth state listener
    window.supabaseClient.auth.getSession().then(function (res) {
      applySessionView(res && res.data ? res.data.session : null);
    });

    window.supabaseClient.auth.onAuthStateChange(function (_event, session) {
      applySessionView(session);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
