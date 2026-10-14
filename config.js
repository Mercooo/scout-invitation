/* ------------------------------------------------------------------
   EDIT THIS FILE — it's the only place you need to touch to make the
   invitation yours. Everything marked [like this] is a placeholder.
------------------------------------------------------------------- */
window.INVITE = {
  // Big title + one-line promise
  title: "Come Away",
  tagline: "A night with God, under the stars.",
  audience: "Scouts & Guides · 16–25",

  // Start / end. Format: YYYY-MM-DDTHH:MM (local time). Drives the countdown + "Add to calendar".
  start: "2026-11-21T16:00",
  end: "2026-11-22T09:00",

  // What people see in the "When / Where" cards
  whenText: "Saturday 21 November",
  whenDetail: "Arrive 4 PM · home by Sunday 9 AM",
  whereName: "[Camp / venue name]",
  whereDetail: "[Town or area]",
  mapsUrl: "", // paste a Google Maps link to show a "Get directions" button

  // RSVP
  rsvpDeadline: "Reply by [date]",
  organizer: "[Your name]",

  // ---- Where RSVPs go (pick one or both) ---------------------------
  // 1) A form endpoint: Google Apps Script web-app URL, Formspree, etc.
  //    See README.md for the 2-minute Google Sheets setup.
  rsvpEndpoint: "",
  // 2) WhatsApp number of the organizer, digits only with country code
  //    (e.g. "201001234567"). After RSVPing, guests get a one-tap button
  //    that sends you a ready-made message.
  whatsapp: "",

  // ---- Arabic version of the same details (shown when the visitor picks عربي) ----
  // Anything left out falls back to the English value above.
  ar: {
    title: "تعالوا معي",
    tagline: "ليلة مع الله، تحت النجوم.",
    audience: "كشّافة ومرشدات · ١٦–٢٥",
    whenText: "السبت ٢١ نوفمبر",
    whenDetail: "الوصول ٤ مساءً · العودة الأحد ٩ صباحًا",
    whereName: "[اسم المخيم / المكان]",
    whereDetail: "[المدينة أو المنطقة]",
    rsvpDeadline: "الرد قبل [التاريخ]",
    organizer: "[اسمك]",
  },
};
