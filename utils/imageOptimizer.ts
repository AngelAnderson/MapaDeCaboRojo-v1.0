
/**
 * Optimizes Supabase Storage URLs to use the Image Transformation service (Edge).
 * Switches from /object/public/ to /render/image/public/ and adds format/size/quality params.
 */
export const getOptimizedImageUrl = (url: string, width: number = 800, quality: number = 80): string => {
    if (!url) return '';
    
    // If it's not a Supabase URL, return as is (e.g., Google Maps photos, Unsplash)
    if (!url.includes('supabase.co/storage/v1/object/public')) {
        return url;
    }

    // Replace the standard object path with the render path
    // Docs: https://supabase.com/docs/guides/storage/image-transformations
    let optimizedUrl = url.replace('/object/public/', '/render/image/public/');

    // Append parameters
    // We enforce WebP for better compression and cover resize mode
    const separator = optimizedUrl.includes('?') ? '&' : '?';
    return `${optimizedUrl}${separator}width=${width}&height=${width}&resize=cover&quality=${quality}&format=webp`;
};

/**
 * Specifically for the PlaceCard header (landscape aspect ratio)
 */
export const getPlaceHeaderImage = (url: string): string => {
    if (!url) return '';
    if (!url.includes('supabase.co/storage/v1/object/public')) return url;

    let optimizedUrl = url.replace('/object/public/', '/render/image/public/');
    const separator = optimizedUrl.includes('?') ? '&' : '?';
    // Request a 16:9 aspect ratio crop roughly, max width 1200 for Retina screens
    return `${optimizedUrl}${separator}width=1200&height=800&resize=cover&quality=85&format=webp`;
};
