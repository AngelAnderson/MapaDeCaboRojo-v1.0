
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
    try {
        // Fetch 2.5+ earthquakes from the last day
        const res = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
        const data = await res.json();
        
        // Filter for Puerto Rico Region (Rough Bounding Box)
        // Lat: 17.5 - 19.0, Lng: -68.0 - -65.0
        const prQuakes = data.features.filter((f: any) => {
            const [lng, lat] = f.geometry.coordinates;
            return lat >= 17.0 && lat <= 20.0 && lng >= -69.0 && lng <= -64.0;
        });

        if (prQuakes.length === 0) return null;

        // Get the strongest or most recent
        const significant = prQuakes.find((f: any) => f.properties.mag >= 4.0);
        const latest = prQuakes[0]; // GeoJSON is usually sorted by time desc, but USGS sort is time desc by default

        const target = significant || latest;
        
        return {
            place: target.properties.place,
            mag: target.properties.mag,
            time: target.properties.time,
            url: target.properties.url,
            isSignificant: target.properties.mag >= 4.0
        };
    } catch (e) {
        console.warn("USGS API Error:", e);
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
            const res = await fetch(`https://date.nager.at/api/v3/publicholidays/${year}/PR`);
            if (!res.ok) throw new Error("Holiday API fail");
            holidays = await res.json();
            localStorage.setItem(cacheKey, JSON.stringify(holidays));
        }

        const todayHoliday = holidays.find(h => h.date === dateStr);
        return todayHoliday || null;

    } catch (e) {
        console.warn("Holiday API Error:", e);
        return null;
    }
};
