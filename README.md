
# 🌴 MapaDeCaboRojo.com (El Veci)

**The Definitive Digital Copilot for Cabo Rojo, Puerto Rico.**

This project is a Progressive Web App (PWA) that combines a curated local directory with a Generative AI Concierge ("El Veci") to guide tourists and locals. It is built for resilience, speed, and offline usage in areas with poor cellular coverage.

---

## 1. 🏗 High-Level Architecture

The system operates on a **Serverless / Client-Heavy** hybrid architecture.

### **Frontend ( The Client)**
*   **Core:** React 18 + TypeScript + Vite.
*   **State Management:** React Hooks (`usePlacesData`, `useMapEngine`) + LocalStorage (for offline caching).
*   **Mapping:** Leaflet.js rendering CartoDB tiles (Light/Dark).
*   **Styling:** Tailwind CSS with a custom "Glassmorphism" UI kit.
*   **Routing:** Custom hash/search-param router (`useRouter.ts`) to ensure shareable links work in sandboxed environments.

### **Backend (The Data Layer)**
*   **Database:** Supabase (PostgreSQL).
*   **Storage:** Supabase Storage (Bucket: `places-images`) for user/admin uploads.
*   **Edge/Serverless Functions:** Hosted on **Vercel** (`/api` directory). These act as secure proxies for third-party APIs to keep keys hidden from the client.

### **Intelligence (The Brain)**
*   **AI Model:** Google Gemini 2.5 Flash via `@google/genai`.
*   **Implementation:**
    *   **RAG-Lite:** We inject a minified JSON representation of places/events into the system prompt context.
    *   **Services:** `services/aiService.ts` handles prompt engineering, intent detection, and structured JSON output.

### **Resilience ("Signal Saver")**
*   **Offline Mode:** `services/supabase.ts` implements a custom caching layer.
*   **Logic:** If the DB connection fails (offline/bad signal), the app hydrates from `localStorage` (TTL: 24h) or falls back to hardcoded `constants.ts`.

---

## 2. 🚦 Getting Started

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
VITE_GOOGLE_PLACES_API_KEY=your-google-places-key (Optional: for client-side maps/autocomplete)

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
    *Note: The frontend will run on `localhost:3000`. API routes (`/api/*`) require running via `vercel dev` or deployment to work correctly, as they are serverless functions.*

3.  **Mock Mode:**
    If you do not provide Supabase keys, the app will automatically switch to **Mock Mode**, using data from `constants.ts` and logging write actions to the console instead of a DB.

---

## 3. 🗄 Database Schema

The database is PostgreSQL hosted on Supabase.

### `public.places`
The master directory of locations.
*   `id` (uuid, PK): Unique identifier.
*   `name` (text): Searchable name.
*   `category` (text): Enum-like string (e.g., 'BEACH', 'FOOD').
*   `lat` / `lon` (float): Geocoordinates.
*   `status` (text): 'open', 'closed', 'pending'.
*   `amenities` (jsonb): Flexible storage for tags.
    *   `{ parking: 'FREE', restrooms: true, has_generator: true, surf_report: {...}, vibe_check: {...} }`
*   `opening_hours` (jsonb): Structured hours for "Open Now" logic.
*   `sponsor_weight` (int): 0-100. Determines sorting order.
*   `is_featured` (bool): Shows "Star" on map.

### `public.events`
Time-sensitive activities.
*   `id` (uuid, PK).
*   `title` (text).
*   `start_time` / `end_time` (timestamptz).
*   `location_name` (text).
*   `place_id` (uuid, FK): Optional link to a Place.

### `public.categories`
Dynamic configuration for UI filters.
*   `id` (text, PK): e.g., 'BEACH'.
*   `label_es` / `label_en` (text): Display names.
*   `icon` (text): FontAwesome class name suffix.
*   `color` (text): Hex code or Tailwind class.

### `public.admin_logs`
Audit trail and AI memory.
*   `action` (text): 'USER_SEARCH', 'UPDATE', 'AI_BRIEFING'.
*   `details` (text): Context or JSON dump.
*   *Used to track what users are searching for to improve the database.*

---

## 4. 📦 External Dependencies & Rationale

| Dependency | Purpose | Why? |
| :--- | :--- | :--- |
| **react / react-dom** | UI Framework | Component-based architecture, ecosystem. |
| **vite** | Build Tool | Extremely fast HMR (Hot Module Replacement). |
| **leaflet** | Maps | Lightweight, open-source, no cost per load (unlike Google Maps SDK). |
| **@supabase/supabase-js** | Backend SDK | Auth, DB, and Realtime in one package. |
| **@google/genai** | AI | Native SDK for Gemini 2.5 Flash. Low latency, high reasoning. |
| **tailwindcss** | Styling | Rapid UI development, consistency, dark mode. |
| **html2canvas** | Features | Used in Admin panel to generate "Instagram Stories" from place data. |
| **Open-Meteo API** | Data | Free weather/marine data (No API key required). |
| **USGS Earthquake API** | Data | Free seismic data (No API key required). |

---

## 5. 🛡 How Not To Break It (Protocols)

### For Humans 👨‍💻
1.  **Do NOT touch `constants.ts` structure:** This file serves as the fail-safe. If the DB dies, the app runs from here.
2.  **Leaflet Refs:** When modifying `useMapEngine`, always ensure `map.current` exists before calling methods. The map is detached on component unmount.
3.  **API Proxies:** Do not call Google Places API or Gemini API directly from client-side components (`.tsx`). Always go through `/api/` endpoints to protect credentials.

### For AI Agents 🤖
1.  **Token Economy:** When updating `prepareAiContext` in `geminiService.ts`, strictly limit the fields sent to the LLM. Use `n` for name, `d` for description. Do not send full JSON blobs.
2.  **Type Safety:** Always import interfaces from `../types` when creating new components. Do not infer types inline.
3.  **Supabase RLS:** If you modify database logic, ensure you are respecting Row Level Security. `anon` users can only READ. `service_role` or authenticated users can WRITE.
4.  **Signal Saver:** Any new data fetching hook **MUST** implement the caching pattern found in `services/supabase.ts` (Memory -> LocalStorage -> Network) to ensure offline functionality.

---

## 6. 🔄 Automations (Cron Jobs)
Defined in `vercel.json`:
1.  **Briefing (`/api/cron-briefing`):** Runs daily at 11 AM. Analyzes search logs and generates a business report.
2.  **Maintenance (`/api/cron-maintenance`):** Runs weekly. Archives past events and prunes old logs.
3.  **Vibe Check (`/api/cron-vibe`):** Runs Mon/Thu. Fetches new Google Reviews for random places and updates the "Vibe" summary using AI.
