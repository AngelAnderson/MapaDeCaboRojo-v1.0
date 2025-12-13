
# 🗺️ MapaDeCaboRojo.com - Product Roadmap (2025)

**Mission:** To be the definitive digital copilot for Cabo Rojo, blending local "Veci" wisdom with modern AI convenience.

---

## 🛡️ Phase 1: Operation "Fortress" (Stability & Security)
*Focus: "Don't lose it. Protect it."*

### 🔴 Critical (Immediate)
- [ ] **Git Repository:** Ensure code is pushed to a private GitHub/GitLab repo.
- [ ] **Supabase RLS (Row Level Security):** 
    - Enable RLS on `places` and `events` tables.
    - Policy: `ENABLE READ` for `anon`.
    - Policy: `ENABLE INSERT/UPDATE/DELETE` for `authenticated` users only.
- [ ] **Environment Variables:** Verify `.env` is in `.gitignore` (Checked: ✅).
- [ ] **Database Backup:** Enable Point-in-Time Recovery (PITR) in Supabase or set up a cron job to dump CSVs weekly.

### 🟡 High Priority
- [ ] **API Quotas:** Set spending limits on Google Cloud Console (Maps & Gemini) to prevent billing spikes.
- [ ] **Error Monitoring:** Install Sentry or LogRocket to track crashes on user devices.
- [ ] **Legal:** Add `Privacy Policy` and `Terms of Service` pages (Required for Google Login and App Store approval).

---

## 🚀 Phase 2: Operation "Speed" (UX & Performance)
*Focus: "Make it feel like a native app."*

### 🛠️ Technical
- [ ] **Image Optimization:** Implement Next-Gen formats (WebP) automatically via Supabase Storage transformations.
- [ ] **Data Caching:** Cache Google Places API responses in Supabase for 30 days to reduce API costs.
- [ ] **Code Splitting:** Lazy load the `Admin` and `Concierge` components to speed up initial load time.

### ✨ User Experience
- [ ] **Skeleton Screens:** Replace loading spinners with skeleton UI for Place Cards.
- [ ] **"Add to Home Screen":** Custom iOS install prompt to encourage PWA usage.
- [ ] **Map Clustering:** If we exceed 200 places, implement `react-leaflet-cluster` to prevent lag.

---

## 🌱 Phase 3: Operation "Community" (Growth)
*Focus: "Grow it."*

### 📢 Features
- [ ] **User Reviews:** Allow users to leave simple "Vibe Checks" (Thumbs up/down + 1 tag).
- [ ] **Verified Owners:** Allow business owners to "Claim this Place" and update their own hours/specials.
- [ ] **Events Scraper:** Automate event ingestion from Facebook Pages (using specialized scrapers).

### 📈 SEO & Marketing
- [ ] **Sitemap Automation:** Ensure `sitemap.xml` updates automatically every night (Already setup via Cron ✅).
- [ ] **Blog/Content:** Launch `/blog` with AI-generated articles ("Top 5 Sunsets", "Best Mofongo").
- [ ] **Social Share Images:** Generate dynamic Open Graph images for every place (e.g., an image that overlays the Place Name on the photo).

---

## 💰 Phase 4: Operation "Sustain" (Monetization)
*Focus: "Make it pay for itself."*

- [ ] **Featured Listings:** Charge local businesses a small fee to appear in the "Recomendados" category or have a Gold Pin.
- [ ] **Lead Gen:** Affiliate links for hotels/Airbnbs.
- [ ] **"El Veci" Premium:** Advanced itinerary planning for tourists (PDF export, booking assistance).

---

## 🧠 Ideas Backlog (The "Maybe" Pile)
- [ ] **Live Traffic:** Layer Waze/Google Traffic data on the map.
- [ ] **Beach Cams:** Integration with local surf cams.
- [ ] **Audio Tour:** Geofenced audio that plays when you drive past a landmark.
