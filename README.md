# Come Away — scout retreat invitation

A single-page invitation with RSVP. Plain HTML/CSS/JS — no build step.

**Preview:** open `index.html`, or `npx http-server .` in this folder.

## Make it yours (all in `config.js`)
Title, tagline, date/time, place, map link, organizer, RSVP deadline.
The "night" timeline and pack list are plain text in `index.html`.
The date in `start` drives the countdown and the "Add to calendar" button.

## Arabic / English
A **عربي / English** button sits at the top of the page and on the opening screen. Arabic switches the whole
page to right-to-left with Arabic fonts. The choice is remembered, and phones set to Arabic open in Arabic.
- Share the Arabic version directly with `…/index.html?lang=ar` (English: `?lang=en`).
- Arabic text for the page is in `i18n.js`; the Arabic event details (title, date, place…) are in the `ar` block of `config.js`.
- Bible quotes in Arabic are from the Smith-Van Dyke translation; replace them in `i18n.js` if your church uses another.
- If you change English wording in `index.html`, update the matching key in `i18n.js` too.

## Music
Drop `assets/music.mp3` in place and it is used automatically. Without it, the site
synthesises a soft ambient pad + bells. Music starts after the visitor taps
"Begin the walk" (browsers block autoplay), swells as the hand draws near, and has an on/off button.

## Where RSVPs go
Pick one or both in `config.js`:
1. **`whatsapp`** — your number with country code, digits only. After RSVPing, guests get a one-tap
   WhatsApp message to you, pre-filled with their answer.
2. **`rsvpEndpoint`** — saves every RSVP to a Google Sheet:
   1. New Google Sheet → Extensions → Apps Script → paste:
      ```js
      function doPost(e) {
        const p = e.parameter;
        SpreadsheetApp.getActiveSheet().appendRow([
          new Date(), p.attending, p.name, p.phone, p.group, p.age, p.note]);
        return ContentService.createTextOutput("ok");
      }
      ```
   2. Deploy → New deployment → Web app → *Execute as: Me*, *Who has access: Anyone* → copy the URL.
   3. Paste it into `rsvpEndpoint` in `config.js`.
   (Formspree and similar form services also work.)

If neither is set the page shows a "demo mode" note after RSVP so nothing is silently lost.

## Publish
Upload this folder to any static host (GitHub Pages, Netlify drop, Vercel, Cloudflare Pages).
