
# 🌴 MapaDeCaboRojo.com (El Veci)

**The Definitive Digital Copilot for Cabo Rojo, Puerto Rico.**

This is not just a map. It is an **AI-First Progressive Web App (PWA)** that combines a curated local directory with a hyper-localized Generative AI Concierge ("El Veci") to guide tourists and locals. It is engineered for resilience, speed, and offline usage in areas with poor cellular coverage ("Signal Saver").

---

## 🚨 Critical Technical Constraints (DO NOT CHANGE)

These architectural decisions are fundamental to the app's correctness. Do not refactor without explicit approval.

### 1. The "Absolute Truth" Time Source
*   **Problem:** Users often have incorrect device clocks, different timezones on their phones, or privacy settings that block local time access. This caused "El Veci" to hallucinate that restaurants were closed when they were open.
*   **Solution:** We use **TimeAPI.io** to fetch the atomic time for `America/Puerto_Rico`.
*   **Rule:** Never rely solely on `new Date()` for business logic (Open/Closed status) or AI Context. Always fetch the "Absolute Truth" from the API or use the fallback logic provided in `useConcierge.ts`.

### 2. Stateless AI Context
*   We use a "RAG-Lite" approach. We inject the *entire* relevant database schema (minified) into the System Instruction on every turn. We do not use vector databases. This ensures the AI always has the latest "Live" data without synchronization lag.

---

## 🌟 Key Features

### 🤖 For Travelers ("El Veci" Experience)
*   **AI Concierge Chat:** A RAG-powered chatbot that knows the time, weather, and open places. It speaks in a specific local dialect ("Boricua Sano") and follows the **"105-Year Rule"** (simple enough for a centenarian to understand).
*   **Visual Search:** Snap a photo of a landmark, and El Veci identifies it and tells you how to get there.
*   **Smart Itineraries:** Ask for a "Relaxed beach day" or "Foodie tour", and get a structured timeline generated on the fly.
*   **Vibe Checks:** AI analyzes Google Reviews to summarize the *current* atmosphere of a place (e.g., "Crowded but worth it", "Chill sunset spot").
*   **Signal Saver (Offline Mode):** A aggressive caching strategy ensures the map and directory work even when the signal dies at Playa Sucia.
*   **Marine Weather Widget:** Real-time surf, wind, and UV data for beachgoers.

### ⚡ For Admins (AI Productivity Suite)
*   **Magic Import:** Paste a Google Maps link or raw text, and the system auto-fills address, coordinates, hours, and photos.
*   **"El Veci" Rewrite:** AI rewrites dry descriptions into engaging, local-style copy with one click.
*   **SEO Generator:** Auto-generates 3 variations of Meta Titles and Descriptions optimized for search engines.
*   **Hours Parser:** Pasting "Mon-Fri 9-5" gets converted into structured machine-readable JSON schedules automatically.
*   **Marketing Studio:** Generates Instagram captions, Email blasts, and Radio scripts tailored to specific tones (Hype, Chill, Professional).
*   **Social Card Generator:** Instantly renders and downloads a branded PNG graphic for Instagram Stories using `html2canvas`.
*   **Demand Analysis:** AI analyzes anonymized search logs to predict content gaps and trending topics.

---

## 🧠 "El Veci" Intelligence Model

The AI is prompt-engineered with a specific persona defined in `PERSONALITY.md`:

1.  **The 105-Year Rule:** No tech jargon. Clear, respectful, and simple instructions.
2.  **Boricua Sano:** Uses local slang ("Wepa", "Ay bendito") but remains family-friendly and respectful.
3.  **Context Aware:** Knows if it's raining (recommends indoor spots) or if it's lunchtime (recommends food).
4.  **Humor:** Cracks innocent jokes about common local struggles (potholes, heat, power outages) to build rapport.

---

## 🏗 Technical Architecture

### **Frontend (The Client)**
*   **Core:** React 18 + TypeScript + Vite.
*   **UI System:** Tailwind CSS with a custom "Glassmorphism" design language (iOS-like).
*   **Mapping:** Leaflet.js with custom CartoDB tiles (Light/Dark mode support).
*   **State:** React Hooks + `idb-keyval` for persistent offline storage.

### **Backend (The Data Layer)**
*   **Database:** Supabase (PostgreSQL) with Row Level Security (RLS).
*   **Storage:** Supabase Storage for optimized image hosting (`places-images` bucket).
*   **Edge Functions:** Hosted on Vercel/Next.js API routes to proxy sensitive calls (Google Places, Gemini).

### **AI Layer**
*   **Model:** Google Gemini 2.5 Flash via `@google/genai` SDK.
*   **Strategy:** Stateless "RAG-Lite". We inject a minified, token-optimized JSON index of places into the system prompt context on every request, ensuring the AI always has the latest database state without vector DB complexity.

---

## 🚦 Getting Started

### Prerequisites
*   Node.js 18+
*   npm or yarn
*   A Supabase Project
*   Google AI Studio Key (Gemini)
*   Google Cloud Console Key (Maps/Places API)

### Environment Variables
Create a `.env` file in the root. **Do not commit this file.**

```env
# Client-Side Exposed (Vite)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_GOOGLE_PLACES_API_KEY=your-google-places-key (Optional: for client-side autocomplete)

# Server-Side Only (Vercel/Node)
API_KEY=your-gemini-api-key
GOOGLE_PLACES_API_KEY=your-google-places-key (For API proxies)
CRON_SECRET=your-vercel-cron-secret (For automated maintenance)
```

### Installation & Run

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    *The app will launch at `http://localhost:3000`.*

3.  **Mock Mode:**
    If Supabase keys are missing, the app automatically switches to **Mock Mode**, using hardcoded data from `constants.ts` to allow UI development without a backend connection.

---

## 🔄 Automations (Cron Jobs)
Defined in `vercel.json` and handled by `/api/cron-*.ts`:

1.  **Daily Briefing:** Analyzes user search logs to generate a business report for the admin.
2.  **Weekly Maintenance:** Archives past events and cleans up old logs.
3.  **Vibe Check Sync:** Periodically fetches fresh Google Reviews for places and uses AI to update their "Vibe" summary.

---

## 🛠️ Admin Workflow

To access the Admin Panel:
1.  Open the app.
2.  Press **`Cmd + K`** (Mac) or **`Ctrl + K`** (Windows) to open the Command Menu.
3.  Select **"System Login"** (or click the Lock icon in the header).
4.  Enter credentials.

**Pro Tip:** Use the "Magic Import" bar at the top of the Place Editor to paste a Google Maps link. The AI will do 90% of the data entry work for you.

---

## 📜 License
Proprietary. Built for the community of Cabo Rojo.
