# 🌴 MapaDeCaboRojo.com

**El Copiloto Digital definitivo para navegar Cabo Rojo, Puerto Rico.**

This project is a modern, mobile-first Progressive Web App (PWA) designed to guide locals and tourists through Cabo Rojo. It features an interactive map, a "Neighbory" AI Concierge named "El Veci", and a comprehensive directory of beaches, restaurants, and logistics.

---

## 🏗 High-Level Architecture

The application follows a **Serverless / Client-Heavy** architecture to ensure speed and offline resilience.

### 1. Frontend Core
*   **Framework:** React 18 with TypeScript.
*   **Styling:** Tailwind CSS with a custom "Cupertino/Glassmorphism" design system. It supports system-based and manual Dark Mode.
*   **Maps:** Leaflet.js rendering **CartoDB Voyager** (Day) and **CartoDB Dark Matter** (Night) tiles.
*   **Icons:** FontAwesome 6 (Pro/Free mix).

### 2. Backend & Data (Supabase)
*   **Database:** PostgreSQL via Supabase.
*   **Auth:** Supabase Auth (Email/Password) for Admin access.
*   **Storage:** Supabase Storage buckets for hosting place images.
*   **Resiliency:** The app includes a **Mock Client** (`services/supabase.ts`). If the database keys are missing or the connection fails, the app falls back to a read-only mode using hardcoded data constants (`constants.ts`), preventing a "White Screen of Death".

### 3. Artificial Intelligence (Google Gemini)
*   **Model:** Gemini 2.5 Flash.
*   **Service:** `services/geminiService.ts`
*   **Features:**
    *   **"El Veci" Concierge:** RAG-lite implementation. It injects the current list of `Places` and `Events` into the system prompt context, allowing the AI to answer specific questions about the local database with a distinct Puerto Rican personality.
    *   **Admin Tools:** Generates marketing copy (Instagram/Email/Radio), improves place descriptions, and auto-tags places using AI.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js 18+
*   npm or yarn

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-repo/mapadecaborojo.git
    cd mapadecaborojo
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory (or use `.env.local` if using Vite):

    ```env
    # Supabase Credentials
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

    # Google Gemini API Key
    API_KEY=your_gemini_api_key
    ```
    *Note: If you skip this step, the app will run in "Mock Mode" using fallback data.*

4.  **Run Development Server**
    ```bash
    npm start
    # or
    npm run dev
    ```

---

## 🗄 Database Schema (Inferred)

The application relies on the following PostgreSQL structure hosted on Supabase.

### Tables

#### `public.places`
The core directory of locations.
*   `id` (uuid, PK): Unique identifier.
*   `name` (text): Place name.
*   `category` (text): BEACH, FOOD, SIGHTS, etc.
*   `description` (text): Short bio.
*   `lat` / `lon` (float): Geographic coordinates.
*   `image_url` (text): URL to the main photo.
*   `amenities` (jsonb): Stores flexible data like `{ parking: 'FREE', restrooms: true, tips: '...' }`.
*   `sponsor_weight` (int): Determines sorting priority (0-100).
*   `status` (text): 'open', 'closed', or 'pending' (for user suggestions).
*   `is_featured` (boolean): Highlights the place on the map.
*   `tags` (text[]): Array of search keywords.
*   `opening_hours` (jsonb): Structured hours.
*   `contact_info` (jsonb): Phone, email, socials.

#### `public.events`
Dynamic agenda items.
*   `id` (uuid, PK)
*   `title` (text)
*   `start_time` (timestamptz)
*   `place_id` (uuid, FK -> places.id): Optional link to a physical place.
*   `location_name` (text): Text fallback if no place_id.
*   `category` (text): MUSIC, FESTIVAL, etc.

#### `public.admin_logs`
Audit trail for admin actions.
*   `id` (uuid, PK)
*   `action` (text): CREATE, UPDATE, DELETE, MARKETING_GEN.
*   `place_name` (text)
*   `created_at` (timestamptz)

### Storage
*   **Bucket:** `places-images` (Public) - Used for uploading user suggestions and admin photos.

---

## 📦 External Dependencies

| Dependency | Purpose |
| :--- | :--- |
| **react** | Core UI library. |
| **leaflet** | Rendering the interactive map logic. |
| **tailwindcss** | Styling utility for Glassmorphism and Dark Mode. |
| **@supabase/supabase-js** | Official client for database, auth, and storage. |
| **@google/genai** | SDK for connecting to Gemini 2.5 Flash model. |
| **html2canvas** | Used for screenshotting or generating visual assets (if needed). |
| **FontAwesome** | (Loaded via CDN) UI Icons. |
| **Google Fonts** | (Loaded via CDN) 'Inter' font family. |

---

## 🎨 UI/UX Philosophy ("The Apple Touch")
The app implements a **"Cupertino" aesthetic**:
1.  **Glassmorphism:** Heavy use of `backdrop-blur-xl` and semi-transparent whites/blacks.
2.  **Noise/Grain:** A subtle SVG noise overlay (`.noise-overlay` in `index.html`) gives the app a premium, textured feel.
3.  **Animations:** Smooth transitions (flyTo map movements, sliding sheets) rather than abrupt state changes.
4.  **Typography:** Uses `Inter`, closely mirroring Apple's San Francisco font.
