
/**
 * Optimizes Supabase Storage URLs to use the Image Transformation service (Edge).
 * Switches from /object/public/ to /render/image/public/ and adds format/size/quality params.
 * 
 * NOTE: Currently disabled/bypassed to ensure image stability until Image Transformation service 
 * is confirmed active on the Supabase project. Returns original URL.
 */
export const getOptimizedImageUrl = (url: string, _width: number = 400, _quality: number = 75): string => {
    if (!url) return '';
    // Image transforms not available on current Supabase plan (returns 400)
    // When upgrading to Pro, uncomment the render path below
    // if (url.includes('supabase.co/storage/v1/object/public')) {
    //     const optimized = url.replace('/object/public/', '/render/image/public/');
    //     return `${optimized}${optimized.includes('?') ? '&' : '?'}width=${_width}&quality=${_quality}&format=webp`;
    // }
    return url;

    /* 
    // Optimization Logic (Disabled)
    if (!url.includes('supabase.co/storage/v1/object/public')) {
        return url;
    }

    // Replace the standard object path with the render path
    let optimizedUrl = url.replace('/object/public/', '/render/image/public/');

    // Append parameters
    const separator = optimizedUrl.includes('?') ? '&' : '?';
    return `${optimizedUrl}${separator}width=${width}&height=${width}&resize=cover&quality=${quality}&format=webp`;
    */
};

/**
 * Specifically for the PlaceCard header (landscape aspect ratio)
 */
export const getPlaceHeaderImage = (url: string): string => {
    if (!url) return '';
    
    // Bypass optimization
    return url;

    /*
    if (!url.includes('supabase.co/storage/v1/object/public')) return url;

    let optimizedUrl = url.replace('/object/public/', '/render/image/public/');
    const separator = optimizedUrl.includes('?') ? '&' : '?';
    // Request a 16:9 aspect ratio crop roughly, max width 1200 for Retina screens
    return `${optimizedUrl}${separator}width=1200&height=800&resize=cover&quality=85&format=webp`;
    */
};
