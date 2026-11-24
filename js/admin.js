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
  var filters = {
    search: "",
    status: "All",
    date: ""
  };
  var pendingDeleteRow = null;
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
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
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
      pill = '<span class="inline-block rounded-md bg-brand-100 text-brand-800 text-[10px] font-bold px-1.5 py-0.5 ml-1.5">TODAY</span>';
    } else if (isoDate < today) {
      pill = '<span class="inline-block rounded-md bg-slate-100 text-slate-500 text-[10px] font-semibold px-1.5 py-0.5 ml-1.5">Past</span>';
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
    if (!enOrBnName || !Array.isArray(window.DOCTORS)) return "";
    var target = String(enOrBnName).trim().toLowerCase();
    var match = window.DOCTORS.find(function (d) {
      return (
        (d.name.en && d.name.en.toLowerCase() === target) ||
        (d.name.bn && d.name.bn === enOrBnName)
      );
    });
    if (match && match.name.bn && match.name.bn !== enOrBnName) {
      return match.name.bn;
    }
    return "";
  }

  function buildPatientWhatsAppLink(row) {
    var clean = normalizePhone(row.patient_phone);
    if (!/^01\d{9}$/.test(clean)) return "";
    var intl = "88" + clean;
    var msg =
      "আসসালামু আলাইকুম " + (row.patient_name || "") + ",\n" +
      "ডেলটা মেডিকেল সেন্টার এন্ড মা ও শিশু হাসপাতাল (শিবগঞ্জ) থেকে আপনার সিরিয়ালের আপডেট:\n" +
      "• ডাক্তার/বিভাগ: " + (row.doctor_name || "") + " (" + (row.department || "") + ")\n" +
      "• তারিখ: " + (row.appointment_date || "") + "\n" +
      "• স্ট্যাটাস: " + (row.status || "Pending") +
      (row.notes ? "\n• নোট: " + row.notes : "") +
      "\nপ্রয়োজনে কল করুন: ০১৭২৪-৩৬৩৮৩৮";
    return "https://wa.me/" + intl + "?text=" + encodeURIComponent(msg);
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
  function populateModalPresets() {
    var docs = window.DOCTORS || [];
    var specs = window.SPECIALTIES || {};
    var presetSelect = $("mQuickPreset");
    var docDatalist = $("doctorsDatalist");
    var deptDatalist = $("departmentsDatalist");

    if (presetSelect) {
      var html = '<option value="">— Select to auto-fill Doctor & Department —</option>';
      if (docs.length) {
        html += '<optgroup label="Specialist Doctors">';
        docs.forEach(function (doc) {
          var firstSpec = (doc.specialties && doc.specialties[0]) || "medicine";
          var deptEn = specs[firstSpec] ? specs[firstSpec].en : "Outpatient";
          var val = JSON.stringify({ doctor: doc.name.en, dept: deptEn });
          html +=
            '<option value="' + escapeHtml(val) + '">' +
            escapeHtml(doc.name.en + " (" + doc.name.bn + ") — " + deptEn) +
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

      presetSelect.addEventListener("change", function () {
        if (!presetSelect.value) return;
        try {
          var parsed = JSON.parse(presetSelect.value);
          if (parsed.doctor) $("mDoctorName").value = parsed.doctor;
          if (parsed.dept) $("mDepartment").value = parsed.dept;
        } catch (e) { /* ignore */ }
      });
    }

    if (docDatalist) {
      var docNames = docs.map(function (d) { return d.name.en; }).concat(["Duty Doctor", "Diagnostic Unit"]);
      docDatalist.innerHTML = docNames.map(function (n) {
        return '<option value="' + escapeHtml(n) + '"></option>';
      }).join("");
    }

    if (deptDatalist) {
      var deptSet = [];
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

    var todayLbl = $("todayDateLabel");
    if (todayLbl) todayLbl.textContent = "Date: " + today;
  }

  function getFilteredAppointments() {
    var qRaw = filters.search.trim().toLowerCase();
    var qDigits = toAsciiDigits(qRaw);

    return appointments.filter(function (row) {
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
      filters.status !== "All" ||
      filters.date !== "";
    var clearBtn = $("clearFiltersBtn");
    if (clearBtn) clearBtn.classList.toggle("hidden", !hasFilter);
  }

  function renderTable() {
    var tbody = $("appointmentsTbody");
    var empty = $("emptyState");
    var meta = $("resultsMeta");
    if (!tbody) return;

    syncClearButtonVisibility();
    var list = getFilteredAppointments();

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

    tbody.innerHTML = list.map(function (row) {
      var dateInfo = formatDateBadge(row.appointment_date);
      var createdStr = formatCreatedAt(row.created_at);
      var bnSub = lookupBanglaDoctorName(row.doctor_name);
      var waLink = buildPatientWhatsAppLink(row);
      var currentStatus = STATUSES.indexOf(row.status) !== -1 ? row.status : "Pending";

      var statusOptions = STATUSES.map(function (st) {
        var sel = st === currentStatus ? " selected" : "";
        return '<option value="' + st + '"' + sel + ">" + st + "</option>";
      }).join("");

      return (
        '<tr class="hover:bg-slate-50/80 transition align-top">' +
          // 1. Patient & Phone
          '<td class="py-3.5 px-4">' +
            '<p class="font-bold text-slate-900 leading-snug">' + escapeHtml(row.patient_name || "—") + "</p>" +
            '<div class="mt-1 flex items-center gap-2 text-xs">' +
              '<a href="tel:' + escapeHtml(normalizePhone(row.patient_phone)) + '" class="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">' +
                '<svg class="w-3.5 h-3.5"><use href="#i-phone"/></svg>' +
                "<span>" + escapeHtml(row.patient_phone || "—") + "</span>" +
              "</a>" +
              (waLink
                ? '<a href="' + escapeHtml(waLink) + '" target="_blank" rel="noopener" title="Send WhatsApp update to patient" class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100">' +
                    '<svg class="w-3.5 h-3.5"><use href="#i-wa"/></svg>' +
                  "</a>"
                : "") +
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
            (createdStr ? '<p class="text-[11px] text-slate-400 mt-0.5">Booked: ' + escapeHtml(createdStr) + "</p>" : "") +
          "</td>" +

          // 4. Reception Notes
          '<td class="py-3.5 px-4 max-w-[220px]">' +
            (row.notes
              ? '<p class="text-xs text-slate-700 leading-relaxed break-words">' + escapeHtml(row.notes) + "</p>"
              : '<span class="text-xs text-slate-300 italic">No notes</span>') +
          "</td>" +

          // 5. Inline Status Select
          '<td class="py-3.5 px-4">' +
            '<label class="sr-only">Update status for ' + escapeHtml(row.patient_name) + "</label>" +
            '<select data-inline-status="' + escapeHtml(row.id) + '" ' +
                    'class="status-select-' + currentStatus + ' w-full rounded-xl border px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer transition">' +
              statusOptions +
            "</select>" +
          "</td>" +

          // 6. Edit & Delete Actions
          '<td class="py-3.5 px-4 text-right whitespace-nowrap">' +
            '<div class="inline-flex items-center gap-1.5">' +
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
          "status-select-" + nextStatus +
          " w-full rounded-xl border px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer transition";
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
      req = window.supabaseClient
        .from("appointments")
        .insert([payload]);
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

  /* ------------ Delete Confirmation Logic ------------ */
  function openDeleteModal(idStr) {
    var row = findRowById(idStr);
    if (!row) return;
    pendingDeleteRow = row;
    $("delPatientLabel").textContent =
      (row.patient_name || "Unnamed") + " (" + (row.appointment_date || "No date") + ")";
    var dlg = $("deleteModal");
    if (dlg && typeof dlg.showModal === "function") dlg.showModal();
  }

  function closeDeleteModal() {
    pendingDeleteRow = null;
    var dlg = $("deleteModal");
    if (dlg && dlg.open) dlg.close();
  }

  function confirmDelete() {
    if (!pendingDeleteRow) return;
    var targetRow = pendingDeleteRow;
    var btn = $("delConfirmBtn");
    btn.disabled = true;
    btn.textContent = "Deleting…";

    window.supabaseClient
      .from("appointments")
      .delete()
      .eq("id", targetRow.id)
      .then(function (res) {
        if (res.error) {
          showToast("Delete failed: " + res.error.message, true);
          return;
        }
        appointments = appointments.filter(function (r) { return r.id !== targetRow.id; });
        updateCounters();
        renderTable();
        closeDeleteModal();
        showToast("Serial record deleted");
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
        .channel("admin-appointments-feed")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "appointments" },
          function () {
            loadAppointments(true);
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
      startRealtimeSync();
    } else {
      stopRealtimeSync();
      appointments = [];
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

    // Auth events
    $("loginForm").addEventListener("submit", handleLoginSubmit);
    $("logoutBtn").addEventListener("click", handleLogout);
    $("togglePasswordBtn").addEventListener("click", function () {
      var pw = $("loginPassword");
      pw.type = pw.type === "password" ? "text" : "password";
    });

    // Top bar & Empty state buttons
    $("newSerialBtn").addEventListener("click", openCreateModal);
    $("emptyNewBtn").addEventListener("click", openCreateModal);
    $("refreshBtn").addEventListener("click", function () {
      loadAppointments(false);
    });

    // Filters
    $("filterSearch").addEventListener("input", function (e) {
      filters.search = e.target.value || "";
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
      filters.status = "All";
      filters.date = "";
      $("filterSearch").value = "";
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
