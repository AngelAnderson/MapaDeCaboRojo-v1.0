
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

## 🏗 Technical Architecture

### **Frontend (The Client)**
*   **Core:** React 18 + TypeScript + Vite.
*   **UI System:** Tailwind CSS with a custom "Glassmorphism" design language (iOS-like).
*   **Mapping:** Leaflet.js with custom CartoDB tiles (Light/Dark mode support).
*   **State:** React Hooks + `idb-keyval` for persistent offline storage.

### **Backend (The Data Layer)**
*   **Database:** Supabase (PostgreSQL) with Row Level Security (RLS).
*   **Storage:** Supabase Storage for optimized image hosting (`places-images` bucket).
*   **Edge Functions:** Hosted on Vercel/Next.js API routes (`/api/*`) to proxy sensitive calls (Google Places, Gemini).

### **AI Layer**
*   **Model:** Google Gemini 2.5 Flash via `@google/genai` SDK.
*   **Persona:** "El Veci" - A helpful, local 105-year-old neighbor.

---

## 👷 Contributor Workflow

This guide explains how to maintain the dataset, add events, and deploy changes.

### 1. Prerequisites
*   **Node.js 18+** installed.
*   Access to the **Supabase Project** (ask Admin for invite).
*   Keys for **Google AI Studio** and **Google Maps Platform**.

### 2. Environment Setup
Create a `.env` file in the root directory:

```env
# Client-Side Exposed (Vite)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_GOOGLE_PLACES_API_KEY=your-google-places-key (For client-side autocomplete)

# Server-Side Only (Vercel/Node Functions)
API_KEY=your-gemini-api-key
GOOGLE_PLACES_API_KEY=your-google-places-key (For server-side proxies)
CRON_SECRET=your-vercel-cron-secret (Optional: for testing crons locally)
```

Run the development server:
```bash
npm install
npm run dev
```

### 3. Adding New Places
We use a **"Magic Import"** workflow to minimize manual data entry.

**Method A: The Admin Panel (Recommended)**
1.  Open the App locally or in production.
2.  Open the **Command Menu** (`Cmd+K` or `Ctrl+K`).
3.  Select **"System Login"** and enter credentials.
4.  Go to the **Places** tab.
5.  Click **"Add New"**.
6.  **✨ Magic Trick:** Paste a Google Maps link (e.g., `https://goo.gl/maps/...`) or the name of the place into the "Magic Fill" input at the top.
7.  Click **"Magic Fill"**. The system will:
    *   Fetch address, coordinates, and phone number from Google Places API.
    *   Import photos via the secure proxy.
    *   Parse opening hours.
8.  **Review:** Ensure the category is correct.
9.  **AI Enhancement:** Click "Auto-Detect" on Tags and "Enhance Description" to rewrite the copy in "El Veci" style.
10. Click **Save**.

**Method B: Supabase Dashboard (Fallback)**
1.  Go to the `places` table editor.
2.  Insert a new row.
3.  **Required fields:** `name`, `category`, `lat`, `lon`, `status`.
4.  `slug` is auto-generated if left blank (handled by App logic, but manual entry requires care).

### 4. Adding Events
1.  Login to Admin Panel -> **Events** tab.
2.  Click **"Add Event"**.
3.  **Critical:** Ensure `startTime` and `endTime` are accurate.
4.  **Auto-Archiving:** The `cron-maintenance` job runs weekly (Mondays at 3am) to mark past events as `archived`. You do not need to delete them manually.

### 5. Managing Photos
*   **Uploads:** Use the "Upload" button in the Admin Panel.
*   **Compression:** The app automatically compresses images to WebP format *before* uploading to save bandwidth and storage.
*   **Storage Bucket:** Images are stored in the `places-images` bucket in Supabase.
*   **Cleanup:** When updating a place's image, the system attempts to garbage-collect the old image to keep the bucket clean.

---

## 🧰 Admin Panel Tools

The Admin Panel is a powerhouse of AI tools designed to make content management effortless.

| Tool | Description | AI Model |
| :--- | :--- | :--- |
| **Magic Import** | Pasting a Google Maps link fetches all metadata, photos, and hours. | Google Places API |
| **Enhance Description** | Rewrites dry text into engaging, "Boricua Sano" style copy following the 105-Year Rule. | Gemini 2.5 Flash |
| **Generate Tips** | Creates a specific "El Veci Tip" based on the place category and description. | Gemini 2.5 Flash |
| **Parse Hours** | Converts natural text (e.g., "Mon-Fri 9 to 5") into structured JSON for the database. | Gemini 2.5 Flash |
| **SEO Generator** | Generates 3 options for Meta Title and Meta Description. | Gemini 2.5 Flash |
| **Alt Text Gen** | Analyzes the image pixel data to generate accessibility descriptions. | Gemini 2.5 Flash |
| **Marketing Studio** | Generates Instagram captions, Email blasts, or Radio scripts with selectable tones (Hype/Chill/Pro). | Gemini 2.5 Flash |
| **Social Card** | Generates a downloadable `.png` graphic for Instagram Stories directly in the browser. | `html2canvas` |
| **Demand Analysis** | Analyzes anonymous user search logs to recommend new content categories. | Gemini 2.5 Flash |

---

## 🚀 Deployment (Vercel)

The project is optimized for Vercel.

1.  **Push to Git:**
    ```bash
    git add .
    git commit -m "feat: added new places"
    git push origin main
    ```

2.  **Vercel Auto-Build:**
    Vercel detects the commit and triggers a build.
    *   **Build Command:** `vite build`
    *   **Output Directory:** `dist`

3.  **Environment Variables:**
    Ensure all variables from `.env` are added to the Vercel Project Settings.

4.  **Cron Jobs:**
    Cron jobs are defined in `vercel.json`. Vercel automatically schedules them upon deployment.
    *   `/api/cron-briefing`: Daily at 11am (Admin Report).
    *   `/api/cron-maintenance`: Mondays at 3am (Cleanup).
    *   `/api/cron-vibe`: Periodically updates place vibes.

---

## 📜 License
Proprietary. Built for the community of Cabo Rojo.
