/* =====================================================================
 * Bangla / English language toggle
 * - Default language: Bangla (bn). The choice is saved in localStorage.
 * - Markup hooks:
 *     data-i18n="key"              → textContent
 *     data-i18n-html="key"         → innerHTML (trusted strings only)
 *     data-i18n-placeholder="key"  → placeholder attribute
 *     data-i18n-aria="key"         → aria-label attribute
 *     data-lang-btn="bn|en"        → toggle buttons
 * - Fires a "langchange" event on document so dynamic content can re-render.
 * ===================================================================== */
(function () {
  "use strict";

  var DICT = {
    bn: {
      "meta.title": "ডেলটা মেডিকেল সেন্টার এন্ড মা ও শিশু হাসপাতাল, শিবগঞ্জ | সিরিয়াল: ০১৭২৪-৩৬৩৮৩৮",
      "meta.desc": "শিবগঞ্জ, চাঁপাইনবাবগঞ্জের ডেলটা মেডিকেল সেন্টার এন্ড মা ও শিশু হাসপাতাল — মা ও শিশু সেবা, গাইনি, শিশু রোগ, ৪ডি আল্ট্রাসনোগ্রাফি, ডিজিটাল এক্স-রে, প্যাথলজি ও ২৪ ঘণ্টা জরুরি সেবা।",
      "skip": "মূল কন্টেন্টে যান",

      "top.emergency": "২৪ ঘণ্টা জরুরি সেবা",
      "top.hotline": "সিরিয়াল ও জরুরি:",
      "top.fb": "ফেসবুক পেজ",

      "brand.name": "ডেলটা মেডিকেল সেন্টার",
      "brand.sub": "এন্ড মা ও শিশু হাসপাতাল, শিবগঞ্জ",
      "brand.full": "ডেলটা মেডিকেল সেন্টার এন্ড মা ও শিশু হাসপাতাল",

      "nav.home": "হোম",
      "nav.doctors": "ডাক্তার",
      "nav.services": "সেবাসমূহ",
      "nav.serial": "সিরিয়াল",
      "nav.contact": "যোগাযোগ",
      "nav.call": "কল করুন",
      "nav.menu": "মেনু খুলুন",
      "nav.lang": "ভাষা পরিবর্তন",

      "hero.badge": "মা ও শিশু স্বাস্থ্যসেবা · আধুনিক ডায়াগনস্টিক",
      "hero.title1": "মা ও শিশুর নিরাপদ চিকিৎসা,",
      "hero.title2": "নির্ভুল পরীক্ষা — এক ছাদের নিচে",
      "hero.lead": "গর্ভকালীন সেবা, স্ত্রী ও প্রসূতি রোগ, নবজাতক ও শিশুর চিকিৎসা — সাথে ৪ডি আল্ট্রাসনোগ্রাফি, ডিজিটাল এক্স-রে ও প্যাথলজি ল্যাব। শিবগঞ্জের হাসপাতাল রোডে, আপনার খুব কাছেই।",
      "hero.tagline": "আস্থার সাথে, স্বাস্থ্যসেবায় আপনার পাশে",
      "hero.call": "সিরিয়াল দিন — কল করুন",
      "hero.wa": "হোয়াটসঅ্যাপে সিরিয়াল",
      "hero.stat.doctors": "বিশেষজ্ঞ ডাক্তার",
      "hero.stat.emergency": "জরুরি বিভাগ",
      "hero.stat.usg": "আল্ট্রাসনোগ্রাফি",
      "hero.stat.xray": "এক্স-রে",
      "hero.stat.xrayVal": "ডিজিটাল",
      "hero.outdoor": "বহিঃবিভাগ খোলা",
      "hero.outdoorTime": "প্রতিদিন সকাল ৯টা – রাত ৯টা",
      "hero.imgAlt": "শিবগঞ্জের হাসপাতাল রোডে ডেলটা মেডিকেল সেন্টার এন্ড মা ও শিশু হাসপাতাল ভবন",

      "info.em.title": "জরুরি বিভাগ ২৪ ঘণ্টা",
      "info.em.text": "দিন-রাত যেকোনো সময় কল করুন",
      "info.out.title": "বহিঃবিভাগ",
      "info.out.text": "প্রতিদিন সকাল ৯টা – রাত ৯টা",
      "info.loc.title": "ওয়াটার সাপ্লাই মোড়",
      "info.loc.text": "হাসপাতাল রোড, শিবগঞ্জ, চাঁপাইনবাবগঞ্জ",

      "doc.eyebrow": "বিশেষজ্ঞ চেম্বার",
      "doc.title": "ডাক্তারদের চেম্বার তালিকা",
      "doc.lead": "বিভাগ বা বার অনুযায়ী খুঁজুন, তারপর এক ট্যাপে সিরিয়াল দিন।",
      "doc.search": "ডাক্তারের নাম বা রোগ লিখে খুঁজুন",
      "doc.searchLabel": "ডাক্তার খুঁজুন",
      "doc.specialty": "বিভাগ",
      "doc.allSpecialties": "সব বিভাগ",
      "doc.day": "চেম্বারের বার",
      "doc.allDays": "সব দিন",
      "doc.today": "আজ",
      "doc.count": "{n} জন ডাক্তার পাওয়া গেছে",
      "doc.empty.title": "এই ফিল্টারে কোনো ডাক্তার পাওয়া যায়নি",
      "doc.empty.text": "অন্য বার বা বিভাগ বেছে নিন, অথবা রিসেপশনে কল করে জেনে নিন।",
      "doc.reset": "ফিল্টার মুছুন",
      "doc.note": "চেম্বারের সময় পরিবর্তন হতে পারে — আসার আগে কল করে সিরিয়াল নিশ্চিত করুন।",
      "doc.serial": "সিরিয়াল দিন",
      "doc.call": "কল",
      "doc.poster": "পোস্টার দেখুন",
      "doc.more": "বিস্তারিত",
      "doc.less": "সংক্ষেপে",
      "doc.schedule": "রোগী দেখার সময়",
      "doc.room": "কক্ষ নং",
      "doc.photoAlt": "{name} এর ছবি",

      "svc.eyebrow": "বিভাগ ও ডায়াগনস্টিক",
      "svc.title": "আমাদের সেবাসমূহ",
      "svc.lead": "মা ও শিশুর পূর্ণাঙ্গ চিকিৎসা থেকে আধুনিক পরীক্ষা-নিরীক্ষা — সবকিছু এক জায়গায়।",
      "svc.mch.title": "মা ও শিশু বিভাগ",
      "svc.mch.text": "গর্ভবতী মা, নবজাতক ও শিশুর জন্য নিবেদিত সেবা — গাইনি ও শিশু বিশেষজ্ঞ একই হাসপাতালে।",
      "svc.gynae.title": "গাইনি ও প্রসূতি",
      "svc.gynae.text": "গর্ভকালীন চেকআপ, প্রসূতি সেবা ও স্ত্রী রোগের চিকিৎসা; বন্ধ্যাত্ব বিষয়ে প্রশিক্ষণপ্রাপ্ত বিশেষজ্ঞ।",
      "svc.peds.title": "শিশু রোগ",
      "svc.peds.text": "নবজাতক, শিশু ও কিশোর রোগ বিশেষজ্ঞ এবং শিশু সার্জনের পরামর্শ।",
      "svc.xray.title": "ডিজিটাল এক্স-রে",
      "svc.xray.text": "দ্রুত ও স্পষ্ট ডিজিটাল এক্স-রে ইমেজিং এবং রিপোর্ট।",
      "svc.usg.title": "৪ডি আল্ট্রাসনোগ্রাফি",
      "svc.usg.text": "গর্ভস্থ শিশুর ৪ডি স্ক্যান সহ সব ধরনের আল্ট্রাসাউন্ড পরীক্ষা।",
      "svc.lab.title": "প্যাথলজি ল্যাব",
      "svc.lab.text": "আধুনিক যন্ত্রপাতি সমৃদ্ধ ল্যাবে রক্ত, প্রস্রাব ও অন্যান্য পরীক্ষা।",
      "svc.em.title": "২৪/৭ জরুরি বিভাগ",
      "svc.em.text": "দিন-রাত ২৪ ঘণ্টা জরুরি বিভাগ, আবাসিক মেডিকেল অফিসার সহ।",
      "svc.cta": "সিরিয়াল দিন",
      "svc.more": "আরও বিশেষজ্ঞ চেম্বার",
      "svc.imgXray": "ডিজিটাল এক্স-রে রিপোর্টিং কক্ষ",
      "svc.imgUsg": "৪ডি আল্ট্রাসনোগ্রাফি পরীক্ষা চলছে",
      "svc.imgLab": "প্যাথলজি ল্যাবরেটরি",

      "form.eyebrow": "অনলাইন ও হোয়াটসঅ্যাপ সিরিয়াল",
      "form.title": "অনলাইনে সিরিয়াল বুক করুন",
      "form.lead": "ফর্মটি পূরণ করে সিরিয়াল বুক করুন — আপনার তথ্য সরাসরি হাসপাতালের রিসেপশন সিস্টেমে জমা হবে। চাইলে এক ট্যাপে হোয়াটসঅ্যাপেও পাঠাতে পারবেন।",
      "form.name": "রোগীর নাম",
      "form.namePh": "যেমন: রহিমা খাতুন",
      "form.phone": "মোবাইল নম্বর",
      "form.phonePh": "০১XXXXXXXXX",
      "form.target": "ডাক্তার / বিভাগ",
      "form.choose": "নির্বাচন করুন",
      "form.groupDoctors": "ডাক্তার",
      "form.groupDepts": "বিভাগ ও পরীক্ষা",
      "form.date": "পছন্দের তারিখ",
      "form.submit": "সিরিয়াল বুক করুন",
      "form.submitSaving": "সংরক্ষণ করা হচ্ছে…",
      "form.waDirect": "সরাসরি হোয়াটসঅ্যাপে সিরিয়াল পাঠান",
      "form.privacy": "আপনার তথ্য শুধুমাত্র হাসপাতালের সিরিয়াল বুকিংয়ের জন্য ব্যবহৃত হবে।",
      "form.err.name": "রোগীর নাম লিখুন",
      "form.err.phone": "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (০১XXXXXXXXX)",
      "form.err.target": "ডাক্তার বা বিভাগ নির্বাচন করুন",
      "form.err.date": "আজ বা পরবর্তী কোনো তারিখ নির্বাচন করুন",
      "form.warnDay": "নোট: {doctor} সাধারণত {days} রোগী দেখেন। রিসেপশন আপনাকে সঠিক সময় জানিয়ে দেবেন।",
      "form.dayIs": "নির্বাচিত দিন: {day}",
      "form.sent": "হোয়াটসঅ্যাপ খোলা হচ্ছে… মেসেজটি পাঠাতে ‘Send’ চাপুন।",
      "form.successTitle": "আপনার সিরিয়াল অনুরোধ সফলভাবে জমা হয়েছে!",
      "form.successBody": "ধন্যবাদ, {name}। আপনার তথ্য আমাদের রিসেপশন তালিকায় যুক্ত হয়েছে (স্ট্যাটাস: অপেক্ষমাণ)। রিসেপশন শীঘ্রই আপনার নম্বরে যোগাযোগ করে সিরিয়াল নিশ্চিত করবে।",
      "form.successSummary": "{target} · তারিখ: {date}",
      "form.successWaBtn": "দ্রুত নিশ্চিতকরণে হোয়াটসঅ্যাপেও মেসেজ পাঠান",
      "form.bookAnother": "নতুন আরেকটি সিরিয়াল নিন",
      "form.dbErrorTitle": "অনলাইনে সংরক্ষণ করা যায়নি",
      "form.dbErrorBody": "দুঃখিত, এই মুহূর্তে সার্ভারে সংরক্ষণ করা যায়নি ({reason})। নিচের বাটনে চাপ দিয়ে সরাসরি হোয়াটসঅ্যাপে সিরিয়াল পাঠান অথবা রিসেপশনে কল করুন।",
      "form.or": "হোয়াটসঅ্যাপ নেই? সরাসরি কল করুন",
      "form.callBox": "রিসেপশন হটলাইন",
      "form.steps1": "রোগীর তথ্য ও পছন্দের তারিখ দিন",
      "form.steps2": "অনলাইনে সিরিয়াল জমা দিন বা হোয়াটসঅ্যাপে পাঠান",
      "form.steps3": "রিসেপশন থেকে কল বা মেসেজে নিশ্চিতকরণ পান",
      "footer.admin": "অ্যাডমিন লগইন",
      "wa.greet": "আসসালামু আলাইকুম, ডেলটা মেডিকেল সেন্টার।",
      "wa.intro": "আমি একটি সিরিয়াল নিতে চাই:",
      "wa.name": "রোগীর নাম",
      "wa.phone": "মোবাইল",
      "wa.target": "ডাক্তার/বিভাগ",
      "wa.date": "পছন্দের তারিখ",
      "wa.end": "অনুগ্রহ করে সিরিয়াল নিশ্চিত করুন। ধন্যবাদ।",
      "wa.quick": "আসসালামু আলাইকুম, আমি ডেলটা মেডিকেল সেন্টারে একটি সিরিয়াল নিতে চাই।",

      "contact.eyebrow": "যোগাযোগ",
      "contact.title": "ঠিকানা ও যোগাযোগ",
      "contact.address": "ঠিকানা",
      "contact.addressText": "ওয়াটার সাপ্লাই মোড়, হাসপাতাল রোড, শিবগঞ্জ, চাঁপাইনবাবগঞ্জ, বাংলাদেশ",
      "contact.hotlines": "সিরিয়াল ও জরুরি হটলাইন",
      "contact.hours": "সেবার সময়",
      "contact.hEm": "জরুরি বিভাগ",
      "contact.hEmVal": "২৪ ঘণ্টা, সপ্তাহে ৭ দিন",
      "contact.hOut": "বহিঃবিভাগ",
      "contact.hOutVal": "প্রতিদিন সকাল ৯টা – রাত ৯টা",
      "contact.hChamber": "বিশেষজ্ঞ চেম্বার",
      "contact.hChamberVal": "ডাক্তারের সময়সূচি অনুযায়ী",
      "contact.directions": "গুগল ম্যাপে দিকনির্দেশনা",
      "contact.fb": "ফেসবুকে আমাদের অনুসরণ করুন",
      "contact.mapTitle": "গুগল ম্যাপে ডেলটা মেডিকেল সেন্টারের অবস্থান",
      "footer.rights": "সর্বস্বত্ব সংরক্ষিত।",
      "footer.top": "উপরে যান",

      "mob.call": "কল",
      "mob.wa": "হোয়াটসঅ্যাপ",
      "mob.serial": "সিরিয়াল",
      "lb.close": "বন্ধ করুন",

      "phone1": "০১৭২৪-৩৬৩৮৩৮",
      "phone2": "০১৭৯৬-৭৯৭৮৭৮"
    },

    en: {
      "meta.title": "Delta Medical Center & Mother and Child Hospital, Shibganj | Serial: 01724-363838",
      "meta.desc": "Delta Medical Center & Mother and Child Hospital, Shibganj, Chapainawabganj — mother & child care, gynecology, pediatrics, 4D ultrasonography, digital X-ray, pathology and 24/7 emergency.",
      "skip": "Skip to main content",

      "top.emergency": "24/7 Emergency Service",
      "top.hotline": "Serial & Emergency:",
      "top.fb": "Facebook Page",

      "brand.name": "Delta Medical Center",
      "brand.sub": "& Mother and Child Hospital, Shibganj",
      "brand.full": "Delta Medical Center & Mother and Child Hospital",

      "nav.home": "Home",
      "nav.doctors": "Doctors",
      "nav.services": "Services",
      "nav.serial": "Serial",
      "nav.contact": "Contact",
      "nav.call": "Call Now",
      "nav.menu": "Open menu",
      "nav.lang": "Change language",

      "hero.badge": "Mother & Child Care · Modern Diagnostics",
      "hero.title1": "Safe care for mother & child,",
      "hero.title2": "accurate diagnostics — under one roof",
      "hero.lead": "Pregnancy care, gynecology & obstetrics, newborn and child treatment — plus 4D ultrasonography, digital X-ray and a pathology lab. Right on Hospital Road, Shibganj.",
      "hero.tagline": "With trust, by your side in healthcare",
      "hero.call": "Call Now for Serial",
      "hero.wa": "WhatsApp Serial",
      "hero.stat.doctors": "Specialist doctors",
      "hero.stat.emergency": "Emergency",
      "hero.stat.usg": "Ultrasonography",
      "hero.stat.xray": "X-Ray",
      "hero.stat.xrayVal": "Digital",
      "hero.outdoor": "Outdoor open",
      "hero.outdoorTime": "Daily 9 AM – 9 PM",
      "hero.imgAlt": "Delta Medical Center & Mother and Child Hospital building on Hospital Road, Shibganj",

      "info.em.title": "24-hour Emergency",
      "info.em.text": "Call any time, day or night",
      "info.out.title": "Outdoor (OPD)",
      "info.out.text": "Daily 9 AM – 9 PM",
      "info.loc.title": "Water Supply Mor",
      "info.loc.text": "Hospital Road, Shibganj, Chapainawabganj",

      "doc.eyebrow": "Specialist Chambers",
      "doc.title": "Doctor Chamber Directory",
      "doc.lead": "Filter by specialty or visiting day, then book your serial in one tap.",
      "doc.search": "Search by doctor name or condition",
      "doc.searchLabel": "Search doctors",
      "doc.specialty": "Specialty",
      "doc.allSpecialties": "All specialties",
      "doc.day": "Visiting day",
      "doc.allDays": "All days",
      "doc.today": "Today",
      "doc.count": "{n} doctors found",
      "doc.empty.title": "No doctor matches these filters",
      "doc.empty.text": "Try another day or specialty, or call reception to ask.",
      "doc.reset": "Clear filters",
      "doc.note": "Chamber times may change — please call to confirm your serial before visiting.",
      "doc.serial": "Book Serial",
      "doc.call": "Call",
      "doc.poster": "View poster",
      "doc.more": "Details",
      "doc.less": "Less",
      "doc.schedule": "Visiting hours",
      "doc.room": "Room No",
      "doc.photoAlt": "Photo of {name}",

      "svc.eyebrow": "Departments & Diagnostics",
      "svc.title": "Our Services",
      "svc.lead": "From complete mother & child care to modern diagnostic tests — all in one place.",
      "svc.mch.title": "Mother & Child Care",
      "svc.mch.text": "Dedicated care for expecting mothers, newborns and children — gynae and child specialists in one hospital.",
      "svc.gynae.title": "Gynecology & Obstetrics",
      "svc.gynae.text": "Antenatal check-ups, obstetric care and women's health treatment, with an infertility-trained specialist.",
      "svc.peds.title": "Pediatrics",
      "svc.peds.text": "Consultations with newborn, child & adolescent specialists and a pediatric surgeon.",
      "svc.xray.title": "Digital X-Ray",
      "svc.xray.text": "Fast, clear digital X-ray imaging and reporting.",
      "svc.usg.title": "4D Ultrasonography",
      "svc.usg.text": "4D pregnancy scans and all routine ultrasound examinations.",
      "svc.lab.title": "Pathology Lab",
      "svc.lab.text": "Blood, urine and other tests in a lab with modern equipment.",
      "svc.em.title": "24/7 Emergency",
      "svc.em.text": "Round-the-clock emergency department with a resident medical officer.",
      "svc.cta": "Book serial",
      "svc.more": "More specialist chambers",
      "svc.imgXray": "Digital X-ray reporting room",
      "svc.imgUsg": "4D ultrasonography in progress",
      "svc.imgLab": "Pathology laboratory",

      "form.eyebrow": "Online & WhatsApp Serial",
      "form.title": "Book a Serial Online",
      "form.lead": "Fill in the form to book your serial — your request is saved directly to reception's system, and you can also send it via WhatsApp in one tap.",
      "form.name": "Patient name",
      "form.namePh": "e.g. Rahima Khatun",
      "form.phone": "Mobile number",
      "form.phonePh": "01XXXXXXXXX",
      "form.target": "Doctor / Department",
      "form.choose": "Select one",
      "form.groupDoctors": "Doctors",
      "form.groupDepts": "Departments & Tests",
      "form.date": "Preferred date",
      "form.submit": "Book Serial Online",
      "form.submitSaving": "Saving serial…",
      "form.waDirect": "Or Send Directly via WhatsApp",
      "form.privacy": "Your details are used solely by hospital reception to manage your appointment.",
      "form.err.name": "Please enter the patient's name",
      "form.err.phone": "Enter a valid 11-digit mobile number (01XXXXXXXXX)",
      "form.err.target": "Please select a doctor or department",
      "form.err.date": "Please pick today or a future date",
      "form.warnDay": "Note: {doctor} usually sees patients on {days}. Reception will tell you the right time.",
      "form.dayIs": "Selected day: {day}",
      "form.sent": "Opening WhatsApp… tap ‘Send’ to deliver your message.",
      "form.successTitle": "Your serial request has been booked!",
      "form.successBody": "Thank you, {name}. Your request has been saved to our reception queue (Status: Pending). Reception will contact your phone shortly to confirm.",
      "form.successSummary": "{target} · Date: {date}",
      "form.successWaBtn": "Also Send on WhatsApp for Instant Confirmation",
      "form.bookAnother": "Book another serial",
      "form.dbErrorTitle": "Could not save online right now",
      "form.dbErrorBody": "Sorry, the online booking could not be saved ({reason}). Please tap below to send your serial via WhatsApp or call reception directly.",
      "form.or": "No WhatsApp? Call us directly",
      "form.callBox": "Reception hotline",
      "form.steps1": "Enter patient details & preferred date",
      "form.steps2": "Submit online or send via WhatsApp",
      "form.steps3": "Get confirmation from reception",
      "footer.admin": "Admin Login",
      "wa.greet": "Assalamu Alaikum, Delta Medical Center.",
      "wa.intro": "I would like to book a serial:",
      "wa.name": "Patient name",
      "wa.phone": "Mobile",
      "wa.target": "Doctor/Department",
      "wa.date": "Preferred date",
      "wa.end": "Please confirm the serial. Thank you.",
      "wa.quick": "Assalamu Alaikum, I would like to book a serial at Delta Medical Center.",

      "contact.eyebrow": "Contact",
      "contact.title": "Location & Contact",
      "contact.address": "Address",
      "contact.addressText": "Water Supply Mor, Hospital Road, Shibganj, Chapainawabganj, Bangladesh",
      "contact.hotlines": "Serial & emergency hotlines",
      "contact.hours": "Hours",
      "contact.hEm": "Emergency",
      "contact.hEmVal": "24 hours, 7 days a week",
      "contact.hOut": "Outdoor (OPD)",
      "contact.hOutVal": "Daily 9 AM – 9 PM",
      "contact.hChamber": "Specialist chambers",
      "contact.hChamberVal": "As per each doctor's schedule",
      "contact.directions": "Get directions on Google Maps",
      "contact.fb": "Follow us on Facebook",
      "contact.mapTitle": "Location of Delta Medical Center on Google Maps",
      "footer.rights": "All rights reserved.",
      "footer.top": "Back to top",

      "mob.call": "Call",
      "mob.wa": "WhatsApp",
      "mob.serial": "Serial",
      "lb.close": "Close",

      "phone1": "01724-363838",
      "phone2": "01796-797878"
    }
  };

  var STORAGE_KEY = "dmc-lang";
  var BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

  function readSaved() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function save(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* private mode */ }
  }

  var I18N = {
    lang: readSaved() === "en" ? "en" : "bn",

    t: function (key, vars) {
      var str = (DICT[I18N.lang] && DICT[I18N.lang][key]) || DICT.bn[key] || key;
      if (vars) {
        Object.keys(vars).forEach(function (k) {
          str = str.split("{" + k + "}").join(vars[k]);
        });
      }
      return str;
    },

    /** Convert ASCII digits to Bangla digits when in Bangla mode. */
    num: function (value) {
      var s = String(value);
      if (I18N.lang !== "bn") return s;
      return s.replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
    },

    /** Convert Bangla digits to ASCII (for parsing user input). */
    toAscii: function (value) {
      return String(value).replace(/[০-৯]/g, function (d) { return String(BN_DIGITS.indexOf(d)); });
    },

    apply: function () {
      var root = document.documentElement;
      root.lang = I18N.lang;

      document.querySelectorAll("[data-i18n]").forEach(function (el) {
        el.textContent = I18N.t(el.getAttribute("data-i18n"));
      });
      document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
        el.innerHTML = I18N.t(el.getAttribute("data-i18n-html"));
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
        el.setAttribute("placeholder", I18N.t(el.getAttribute("data-i18n-placeholder")));
      });
      document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
        el.setAttribute("aria-label", I18N.t(el.getAttribute("data-i18n-aria")));
      });
      document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
        el.setAttribute("alt", I18N.t(el.getAttribute("data-i18n-alt")));
      });
      document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
        el.setAttribute("title", I18N.t(el.getAttribute("data-i18n-title")));
      });

      document.title = I18N.t("meta.title");
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", I18N.t("meta.desc"));

      document.querySelectorAll("[data-lang-btn]").forEach(function (btn) {
        var active = btn.getAttribute("data-lang-btn") === I18N.lang;
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.classList.toggle("is-active", active);
      });

      document.dispatchEvent(new CustomEvent("langchange", { detail: { lang: I18N.lang } }));
    },

    set: function (lang) {
      I18N.lang = lang === "en" ? "en" : "bn";
      save(I18N.lang);
      I18N.apply();
    }
  };

  window.I18N = I18N;
})();
