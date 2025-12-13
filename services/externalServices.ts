
// Free Public APIs integration

// --- USGS EARTHQUAKE API ---
// Docs: https://earthquake.usgs.gov/fdsnws/event/1/
export interface EarthQuake {
    place: string;
    mag: number;
    time: number;
    url: string;
    isSignificant: boolean;
}

export const getRecentEarthquakes = async (): Promise<EarthQuake | null> => {
    const CACHE_KEY = 'cabo_recent_quake';
    
    try {
        // 1. Check Cache (TTL: 15 minutes)
        const cachedRaw = localStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
            try {
                const cached = JSON.parse(cachedRaw);
                const age = Date.now() - cached.timestamp;
                if (age < 15 * 60 * 1000) { // 15 mins
                    return cached.data;
                }
            } catch (parseError) {
                localStorage.removeItem(CACHE_KEY);
            }
        }

        // 2. Fetch with Timeout (5 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        
        // Filter for Puerto Rico Region (Rough Bounding Box)
        // Lat: 17.5 - 19.0, Lng: -68.0 - -65.0
        const prQuakes = data.features.filter((f: any) => {
            const [lng, lat] = f.geometry.coordinates;
            return lat >= 17.0 && lat <= 20.0 && lng >= -69.0 && lng <= -64.0;
        });

        let result: EarthQuake | null = null;

        if (prQuakes.length > 0) {
            // Get the strongest or most recent
            const significant = prQuakes.find((f: any) => f.properties.mag >= 4.0);
            const latest = prQuakes[0]; // GeoJSON is usually sorted by time desc

            const target = significant || latest;
            
            result = {
                place: target.properties.place,
                mag: target.properties.mag,
                time: target.properties.time,
                url: target.properties.url,
                isSignificant: target.properties.mag >= 4.0
            };
        }

        // 3. Update Cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data: result
        }));
        
        return result;

    } catch (e) {
        // 4. Graceful Fallback
        // Don't warn visibly in console for network/timeout errors, just debug
        console.debug("USGS Feed unavailable (using stale cache if possible):", e);
        
        // Try to return stale cache if fetch fails
        const cachedRaw = localStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
            try { return JSON.parse(cachedRaw).data; } catch(err) {}
        }
        return null;
    }
};

// --- NAGER.DATE HOLIDAY API ---
// Docs: https://date.nager.at/Api
export interface PublicHoliday {
    date: string;
    localName: string;
    name: string;
    global: boolean; // true if public holiday
}

export const checkPublicHolidays = async (): Promise<PublicHoliday | null> => {
    try {
        const today = new Date();
        const year = today.getFullYear();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Check cache first to save bandwidth
        const cacheKey = `cabo_holidays_${year}`;
        const cached = localStorage.getItem(cacheKey);
        let holidays: PublicHoliday[] = [];

        if (cached) {
            holidays = JSON.parse(cached);
        } else {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const res = await fetch(`https://date.nager.at/api/v3/publicholidays/${year}/PR`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error("Holiday API fail");
            holidays = await res.json();
            localStorage.setItem(cacheKey, JSON.stringify(holidays));
        }

        const todayHoliday = holidays.find(h => h.date === dateStr);
        return todayHoliday || null;

    } catch (e) {
        console.debug("Holiday API Error:", e);
        return null;
    }
};
