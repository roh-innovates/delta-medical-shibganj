/* =====================================================================
 * Doctor Chamber Directory: DATA FILE
 * ---------------------------------------------------------------------
 * Source: the hospital's own doctor posters in ./assets/
 *   (doctor.webp, doctor2–8.webp, doctor10–13.webp, drMahfuzRaihan.webp, drToukirPriyo.webp, drSufianAra.webp). Nothing here is invented.
 *   Please re-check schedules against the reception's latest list.
 *
 * The directory cards, specialty/day filters and the serial-form
 * dropdown are all generated from the DOCTORS array below.
 *
 * Entry template:
 *   {
 *     id: "unique-id",
 *     name:        { bn: "ডা. ...", en: "Dr. ..." },
 *     focus:       { bn: "...",     en: "..." },        // poster headline
 *     degrees:     { bn: "...",     en: "..." },
 *     designation: { bn: "...",     en: "..." },
 *     specialties: ["gynae"],                          // keys of SPECIALTIES
 *     schedule: [                                      // daily:true = every day
 *       { days: ["fri"], bn: "সকাল ৯টা – বিকাল ৪টা", en: "9 AM – 4 PM" }
 *     ],
 *     poster: "assets/doctorX.webp",
 *     face: { x: 75, y: 30 }                           // % focus point for the thumbnail crop
 *   }
 * ===================================================================== */

window.DAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];

window.DAY_LABELS = {
  sat: { bn: "শনিবার",     en: "Saturday" },
  sun: { bn: "রবিবার",     en: "Sunday" },
  mon: { bn: "সোমবার",     en: "Monday" },
  tue: { bn: "মঙ্গলবার",    en: "Tuesday" },
  wed: { bn: "বুধবার",      en: "Wednesday" },
  thu: { bn: "বৃহস্পতিবার", en: "Thursday" },
  fri: { bn: "শুক্রবার",    en: "Friday" },
  daily: { bn: "প্রতিদিন",  en: "Daily" }
};

window.SPECIALTIES = {
  gynae:      { bn: "স্ত্রী ও প্রসূতি রোগ", en: "Gynecology & Obstetrics" },
  pediatrics: { bn: "নবজাতক ও শিশু রোগ",  en: "Pediatrics (Newborn & Child)" },
  pedsurgery: { bn: "শিশু সার্জারি",        en: "Pediatric Surgery" },
  medicine:   { bn: "মেডিসিন",             en: "Medicine" },
  cardiology: { bn: "হৃদরোগ",              en: "Cardiology" },
  neuro:      { bn: "নিউরোলজি (ব্রেইন ও নার্ভ)", en: "Neurology (Brain & Nerve)" },
  skin:       { bn: "চর্ম ও যৌন রোগ",       en: "Skin & VD" },
  ortho:      { bn: "অর্থোপেডিক্স (হাড়-জোড়া)", en: "Orthopedics & Trauma" },
  eye:        { bn: "চক্ষু রোগ",            en: "Eye (Ophthalmology)" },
  dental:     { bn: "মুখ ও দন্ত রোগ",       en: "Dental & Oral Surgery" },
  surgery:    { bn: "জেনারেল সার্জারি",      en: "General Surgery" }
};

window.DOCTORS = [
  {
    id: "sarmin-akter-keya",
    name: { bn: "ডা. সারমিন আকতার কেয়া", en: "Dr. Sarmin Akter Keya" },
    focus: { bn: "স্ত্রী, প্রসূতি ও শিশু চিকিৎসায় অভিজ্ঞ", en: "Experienced in Gynae, Obstetric & Child Care" },
    degrees: {
      bn: "এমবিবিএস (রাজ), ডিএমইউ (আল্ট্রা), সিসিজিপি (মা ও শিশু)",
      en: "MBBS (Raj), DMU (Ultra), CCGP (Mother & Child)"
    },
    designation: {
      bn: "স্ত্রী, প্রসূতি ও শিশু চিকিৎসায় প্রশিক্ষণপ্রাপ্ত · মেডিকেল অফিসার, ডেলটা মেডিকেল সেন্টার",
      en: "Trained in Gynae, Obstetric & Child Care · Medical Officer, Delta Medical Center"
    },
    specialties: ["gynae", "pediatrics"],
    schedule: [{ daily: true, bn: "সকাল ৯টা থেকে সন্ধ্যা পর্যন্ত", en: "9 AM – evening" }],
    poster: "assets/doctor.webp",
    face: { x: 79, y: 36 }
  },
  {
    id: "mohim-ali",
    name: { bn: "ডাঃ মোঃ মহিম আলী", en: "Dr. Md. Mohim Ali" },
    focus: { bn: "মেডিসিন, নিউরোমেডিসিন, চর্ম ও যৌন রোগে অভিজ্ঞ", en: "Medicine, Neuromedicine, Skin & VD" },
    degrees: {
      bn: "এমবিবিএস (রামেক), বিসিএস (স্বাস্থ্য), পিজিটি (মেডিসিন), ডিওসি (চর্ম ও যৌন), এফসিপিএস (মেডিসিন) শেষ পর্ব",
      en: "MBBS (RMC), BCS (Health), PGT (Medicine), DOC (Skin & VD), FCPS (Medicine) Final Part"
    },
    designation: {
      bn: "ঢাকা মেডিকেল কলেজ (এক্স) · মেডিকেল অফিসার (মেডিসিন), উপজেলা স্বাস্থ্য কমপ্লেক্স, শিবগঞ্জ",
      en: "Dhaka Medical College (Ex) · Medical Officer (Medicine), Upazila Health Complex, Shibganj"
    },
    specialties: ["medicine", "neuro", "skin"],
    schedule: [{ daily: true, bn: "বিকাল ৩টা – রাত ৮টা", en: "3 PM – 8 PM" }],
    poster: "assets/doctor2.webp",
    face: { x: 73, y: 41 }
  },
  {
    id: "khadija-khanam-masuma",
    name: { bn: "ডা. খাদিজা খানম (মাসুমা)", en: "Dr. Khadija Khanam (Masuma)" },
    focus: { bn: "প্রসূতি ও স্ত্রী রোগ বিশেষজ্ঞ ও সার্জন", en: "Obstetrics & Gynecology Specialist & Surgeon" },
    degrees: {
      bn: "এমবিবিএস (ঢাকা), বিসিএস (স্বাস্থ্য), এফসিপিএস (গাইনি এন্ড অবস)",
      en: "MBBS (Dhaka), BCS (Health), FCPS (Gynae & Obs)"
    },
    designation: {
      bn: "বন্ধ্যাত্ব বিষয়ে উচ্চ প্রশিক্ষণপ্রাপ্ত · রাজশাহী মেডিকেল কলেজ হাসপাতাল",
      en: "Advanced training in infertility · Rajshahi Medical College Hospital"
    },
    specialties: ["gynae"],
    schedule: [{ days: ["fri"], bn: "সকাল ৯:৩০ – বিকাল ৪টা", en: "9:30 AM – 4 PM" }],
    poster: "assets/doctor3.webp",
    face: { x: 74, y: 30 }
  },
  {
    id: "rubel-ahmed",
    name: { bn: "ডা. রুবেল আহমেদ", en: "Dr. Rubel Ahmed" },
    focus: { bn: "অর্থোপেডিক, সার্জারি চিকিৎসক ও ট্রমা সার্জন", en: "Orthopedic, Surgery & Trauma Surgeon" },
    degrees: {
      bn: "এমবিবিএস, পিজিটি (সার্জারি), সিসিডি (বারডেম), এফসিপিএস (অর্থোপেডিক সার্জারি) (এফ.পি)",
      en: "MBBS, PGT (Surgery), CCD (BIRDEM), FCPS (Orthopedic Surgery) (FP)"
    },
    designation: { bn: "রাজশাহী মেডিকেল কলেজ হাসপাতাল", en: "Rajshahi Medical College Hospital" },
    specialties: ["ortho", "surgery"],
    schedule: [{ days: ["tue"], bn: "বিকাল ৩টা – রাত ৯টা", en: "3 PM – 9 PM" }],
    poster: "assets/doctor4.webp",
    face: { x: 79, y: 27 }
  },
  {
    id: "anowarul-azim-bappy",
    name: { bn: "ডা. আনোয়ারুল আজিম (বাপ্পী)", en: "Dr. Anowarul Azim (Bappy)" },
    focus: { bn: "নবজাতক, শিশু ও কিশোর রোগ বিশেষজ্ঞ ও সার্জন", en: "Newborn, Child & Adolescent Specialist & Surgeon" },
    degrees: {
      bn: "এমবিবিএস, বিসিএস (স্বাস্থ্য), এমএস (শিশু সার্জারি)",
      en: "MBBS, BCS (Health), MS (Pediatric Surgery)"
    },
    designation: {
      bn: "শিশু ইউরোলজিস্ট ও শিশু ল্যাপারোস্কপিক সার্জন · রাজশাহী মেডিকেল কলেজ হাসপাতাল",
      en: "Pediatric Urologist & Pediatric Laparoscopic Surgeon · Rajshahi Medical College Hospital"
    },
    specialties: ["pedsurgery", "pediatrics"],
    schedule: [{ days: ["fri"], bn: "সকাল ৯টা – দুপুর ১২টা", en: "9 AM – 12 PM" }],
    poster: "assets/doctor5.webp",
    face: { x: 79, y: 33 }
  },
  {
    id: "abdullahil-kafi",
    name: { bn: "ডা. মোঃ আব্দুল্লাহিল কাফি", en: "Dr. Md. Abdullahil Kafi" },
    focus: { bn: "নিউরোলজি (নার্ভ, ব্রেইন, স্ট্রোক, মেরুদণ্ড) মেডিসিন বিষয়ে অভিজ্ঞ ও সার্জন", en: "Neurology (Nerve, Brain, Stroke, Spine) & Medicine, Surgeon" },
    degrees: {
      bn: "এমবিবিএস, বিসিএস (স্বাস্থ্য), এফসিপিএস (সার্জারী) এফপি, এম.এস রেসিডেন্ট (নিউরোসার্জারী), পিজিটি (সার্জারী)",
      en: "MBBS, BCS (Health), FCPS (Surgery) FP, MS Resident (Neurosurgery), PGT (Surgery)"
    },
    designation: {
      bn: "নিউরোসাইন্স হাসপাতাল, ঢাকা · মেডিকেল অফিসার, উপজেলা স্বাস্থ্য কমপ্লেক্স, শিবগঞ্জ",
      en: "Neuroscience Hospital, Dhaka · Medical Officer, Upazila Health Complex, Shibganj"
    },
    specialties: ["neuro", "medicine"],
    schedule: [
      { daily: true, bn: "বিকাল ৩টা – রাত ৯টা", en: "3 PM – 9 PM" },
      { days: ["fri"], bn: "সকাল ৯টা – রাত ৯টা", en: "9 AM – 9 PM" }
    ],
    poster: "assets/doctor6.webp",
    face: { x: 77, y: 35 }
  },
  {
    id: "imran-javed",
    name: { bn: "ডা. মোঃ ইমরান জাভেদ", en: "Dr. Md. Imran Javed" },
    focus: { bn: "চক্ষু বিশেষজ্ঞ · কনসালটেন্ট চিকিৎসক ও সার্জন", en: "Eye Specialist · Consultant Physician & Surgeon" },
    degrees: {
      bn: "এমবিবিএস (ঢাকা), ডিও (চক্ষু) পিজি হাসপাতাল, সিসিডি (বারডেম)",
      en: "MBBS (Dhaka), DO (Eye) PG Hospital, CCD (BIRDEM)"
    },
    designation: {
      bn: "কনসালটেন্ট চিকিৎসক ও সার্জন · বিএনএসবি, চাঁপাইনবাবগঞ্জ চক্ষু হাসপাতাল",
      en: "Consultant Physician & Surgeon · BNSB, Chapainawabganj Eye Hospital"
    },
    specialties: ["eye"],
    schedule: [
      { days: ["fri"], bn: "সকাল ১০টা থেকে সন্ধ্যা পর্যন্ত", en: "10:00 AM – evening" }
    ],
    poster: "assets/doctor7.webp",
    face: { x: 25, y: 30 }
  },
  {
    id: "tosikul-islam-tasik",
    name: { bn: "ডা. মোঃ তোসিকুল ইসলাম (তাসিক)", en: "Dr. Md. Tosikul Islam (Tasik)" },
    focus: { bn: "অর্থোপেডিক বিশেষজ্ঞ ও সার্জন", en: "Orthopedic Specialist & Surgeon" },
    degrees: {
      bn: "এমবিবিএস (ঢাকা), বিসিএস (স্বাস্থ্য), এমএস (অর্থোপেডিক সার্জারি), বিএমইউ, এফসিপিএস (অর্থোপেডিক সার্জারি-ফাইনাল পার্ট), সিসিডি (বারডেম), এমআরসিএস (ইংল্যান্ড-২য় ফেজ)",
      en: "MBBS (Dhaka), BCS (Health), MS (Orthopedic Surgery), BMU, FCPS (Orthopedic Surgery – Final Part), CCD (BIRDEM), MRCS (England – 2nd Phase)"
    },
    designation: {
      bn: "অর্থোপেডিক ও ট্রমা সার্জন · পিজি হাসপাতাল, শাহবাগ, ঢাকা",
      en: "Orthopedic & Trauma Surgeon · PG Hospital, Shahbag, Dhaka"
    },
    specialties: ["ortho"],
    schedule: [{ days: ["fri"], bn: "সকাল ৯:৩০ থেকে সন্ধ্যা পর্যন্ত", en: "9:30 AM – evening" }],
    poster: "assets/doctor8.webp",
    face: { x: 78, y: 31 }
  },
  {
    id: "nafis-kabir",
    name: { bn: "ডা. শেখ মোঃ নাফিস কবির", en: "Dr. Sheikh Md. Nafis Kabir" },
    focus: { bn: "হৃদরোগ, বক্ষব্যাধি, ডায়াবেটিস ও মেডিসিন বিশেষজ্ঞ", en: "Heart, Chest, Diabetes & Medicine Specialist" },
    degrees: {
      bn: "এমবিবিএস, বিসিএস (স্বাস্থ্য), সিসিডি (বারডেম), এমডি (কার্ডিওলজি), পিজি হাসপাতাল, ঢাকা, এফসিপিএস (মেডিসিন-এফপি), এমআরসিপি (PACES), লন্ডন",
      en: "MBBS, BCS (Health), CCD (BIRDEM), MD (Cardiology) PG Hospital Dhaka, FCPS (Medicine-FP), MRCP (PACES) London"
    },
    designation: {
      bn: "কনসালটেন্ট (কার্ডিওলজি) · ক্লিনিক্যাল এন্ড ইন্টারভেনশনাল কার্ডিওলজিস্ট · জাতীয় হৃদরোগ ইনস্টিটিউট ও হাসপাতাল (এক্স)",
      en: "Consultant (Cardiology) · Clinical & Interventional Cardiologist · National Institute of Cardiovascular Diseases (Ex)"
    },
    specialties: ["cardiology", "medicine"],
    schedule: [{ days: ["fri"], bn: "সকাল ৯টা – সন্ধ্যা ৭টা", en: "9 AM – 7 PM" }],
    poster: "assets/doctor10.webp",
    face: { x: 76, y: 25 }
  },
  {
    id: "delowar-hossain",
    name: { bn: "ডা. মোঃ দেলোয়ার হোসাইন", en: "Dr. Md. Delowar Hossain" },
    focus: { bn: "নবজাতক, শিশু ও কিশোর রোগ বিশেষজ্ঞ", en: "Newborn, Child & Adolescent Specialist" },
    degrees: {
      bn: "এমবিবিএস, বিসিএস (স্বাস্থ্য), এমডি (শিশু), পিজি হাসপাতাল",
      en: "MBBS, BCS (Health), MD (Pediatrics), PG Hospital"
    },
    designation: {
      bn: "স্পেশাল ট্রেনিং শিশু স্বাস্থ্য ও পুষ্টি, ঢাকা · ২৫০ শয্যা বিশিষ্ট জেলা হাসপাতাল, চাঁপাইনবাবগঞ্জ",
      en: "Special training in Child Health & Nutrition, Dhaka · 250-Bed District Hospital, Chapainawabganj"
    },
    specialties: ["pediatrics"],
    schedule: [
      { days: ["fri"], bn: "সকাল ৯টা – রাত ৯টা", en: "9 AM – 9 PM" },
      { days: ["tue"], bn: "বিকাল ৩টা – রাত ৯টা", en: "3 PM – 9 PM" }
    ],
    poster: "assets/doctor11.webp",
    face: { x: 77, y: 29 }
  },
  {
    id: "asif-iqbal-sabuj",
    name: { bn: "ডা. মোঃ আসিফ ইকবাল সবুজ", en: "Dr. Md. Asif Iqbal Sabuj" },
    focus: { bn: "মেডিসিন ও সার্জারী অভিজ্ঞ", en: "Experienced in Medicine & Surgery" },
    degrees: {
      bn: "এম.বি.বি.এস, এম.আর.সি.এস (পার্ট এ), ইংল্যান্ড, সি.এম.ইউ (আল্ট্রাসাউন্ড)",
      en: "MBBS, MRCS (Part A) England, CMU (Ultrasound)"
    },
    designation: {
      bn: "আবাসিক মেডিকেল অফিসার, ডেলটা মেডিকেল সেন্টার এন্ড মা ও শিশু হাসপাতাল · জরুরী বিভাগ ২৪ ঘণ্টা",
      en: "Resident Medical Officer, Delta Medical Center & Mother and Child Hospital · Emergency 24 hours"
    },
    specialties: ["medicine", "surgery"],
    schedule: [{ daily: true, bn: "বহিঃবিভাগ: সকাল ৯টা – রাত ৯টা", en: "Outdoor: 9 AM – 9 PM" }],
    poster: "assets/doctor12.webp",
    face: { x: 20, y: 24 }
  },
  {
    id: "israfil-islam",
    name: { bn: "ডা. মোঃ ইস্রাফিল ইসলাম", en: "Dr. Md. Israfil Islam" },
    focus: { bn: "সার্জারী বিশেষজ্ঞ · জেনারেল ও এন্ডো-ল্যাপারোস্কপিক সার্জন", en: "Surgery Specialist · General & Endo-Laparoscopic Surgeon" },
    degrees: {
      bn: "এমবিবিএস, বিসিএস (স্বাস্থ্য), এমএস (সার্জারী), এমসিপিএস (সার্জারী)",
      en: "MBBS, BCS (Health), MS (Surgery), MCPS (Surgery)"
    },
    designation: {
      bn: "সার্টিফাইড ট্রেইনড ইন এন্ডোসকপি এন্ড কোলনোস্কপি · সহকারী অধ্যাপক (সার্জারী), নওগাঁ মেডিকেল কলেজ, নওগাঁ",
      en: "Certified trained in Endoscopy & Colonoscopy · Assistant Professor (Surgery), Naogaon Medical College, Naogaon"
    },
    specialties: ["surgery"],
    schedule: [{ days: ["thu"], bn: "বিকাল ৩টা থেকে সন্ধ্যা পর্যন্ত", en: "3 PM – evening" }],
    poster: "assets/doctor13.webp",
    face: { x: 20, y: 31 }
  },
  {
    id: "mahfuz-raihan",
    name: { bn: "ডা. মো: মাহফুজ রায়হান", en: "Dr. Md. Mahfuz Raihan" },
    focus: { bn: "নবজাতক ও শিশুরোগ বিশেষজ্ঞ", en: "Neonatal & Pediatric Specialist" },
    degrees: {
      bn: "এমবিবিএস, বিসিএস (স্বাস্থ্য), ডিসিএইচ (শিশু হাসপাতাল, মিরপুর), এফসিপিএস (শেষ পর্ব)",
      en: "MBBS, BCS (Health), DCH (Shishu Hospital, Mirpur), FCPS (Final Part)"
    },
    designation: {
      bn: "কনসালটেন্ট (শিশু ও নবজাতক), ২৫০ শয্যা বিশিষ্ট জেলা হাসপাতাল, চাঁপাইনবাবগঞ্জ",
      en: "Consultant (Pediatrics & Neonatology), 250 Bedded District Hospital, Chapainawabganj"
    },
    specialties: ["pediatrics"],
    schedule: [
      { days: ["fri"], bn: "১০:০০টা থেকে সন্ধ্যা পর্যন্ত", en: "10:00 AM – evening" },
      { days: ["tue"], bn: "দুপুর ৩:০০ টা থেকে রাত ৮:০০ টা", en: "3:00 PM – 8:00 PM" }
    ],
    poster: "assets/drMahfuzRaihan.webp",
    face: { x: 78, y: 24 }
  },
  {
    id: "toukir-hasan-priyo",
    name: { bn: "ডা. মোঃ তৌকির হাসান প্রিয়", en: "Dr. Md. Toukir Hasan Priyo" },
    focus: { bn: "মুখ ও দন্ত বিশেষজ্ঞ ও সার্জন", en: "Oral & Dental Specialist & Surgeon" },
    degrees: {
      bn: "বিডিএস (আর ইউ), পিজিটি (ওরাল এন্ড ম্যাক্সিলোফেসিয়াল সার্জারি)",
      en: "BDS (RU), PGT (Oral & Maxillofacial Surgery)"
    },
    designation: {
      bn: "রাজশাহী মেডিকেল কলেজ হাসপাতাল · বিশেষ প্রশিক্ষণপ্রাপ্ত রুট ক্যানেল এবং কসমেটিক ডেন্টিস্ট্রি",
      en: "Rajshahi Medical College Hospital · Specially Trained in Root Canal & Cosmetic Dentistry"
    },
    specialties: ["dental"],
    schedule: [
      { days: ["fri"], bn: "সকাল ৯টা থেকে সন্ধ্যা পর্যন্ত", en: "9 AM – evening" },
      { days: ["tue"], bn: "সকাল ৯টা – বিকাল ৫টা", en: "9 AM – 5 PM" }
    ],
    poster: "assets/drToukirPriyo.webp",
    face: { x: 50, y: 42 }
  },
  {
    id: "sufian-ara",
    name: { bn: "ডা. সুফিয়ান আরা", en: "Dr. Sufian Ara" },
    focus: { bn: "চক্ষু চিকিৎসক", en: "Eye Physician" },
    degrees: {
      bn: "এমবিবিএস, সিসিডি (বারডেম), সিসিজিপি (চক্ষু)",
      en: "MBBS, CCD (BIRDEM), CCGP (Eye)"
    },
    designation: {
      bn: "চক্ষু রোগে বিশেষ প্রশিক্ষণপ্রাপ্ত · মেডিকেল অফিসার, চক্ষু ইউনিট, ডেলটা মেডিকেল সেন্টার",
      en: "Specially Trained in Eye Care · Medical Officer, Eye Unit, Delta Medical Center"
    },
    specialties: ["eye"],
    schedule: [{ daily: true, bn: "সকাল ১০টা – দুপুর ২টা", en: "10 AM – 2 PM" }],
    poster: "assets/drSufianAra.webp",
    face: { x: 50, y: 40 }
  }
];
