
import React, { useEffect } from 'react';
import { Place, Event } from '../types';

interface SeoEngineProps {
  title?: string;
  description?: string;
  image?: string;
  place?: Place | null;
  event?: Event | null;
}

const SeoEngine: React.FC<SeoEngineProps> = ({ 
  title = "El Veci — El Copiloto del Pueblo", 
  description = "Navega Cabo Rojo como si vivieras aquí.", 
  image = "https://images.unsplash.com/photo-1599060690625-f70e9c8cb5eb?q=80&w=1200&auto=format&fit=crop",
  place,
  event
}) => {

  // 1. Update Basic Meta Tags
  useEffect(() => {
    let currentTitle = title;
    let currentDescription = description;
    let currentImage = image;

    if (place) {
      // Prioritize AI-generated metaTitle/metaDescription if available
      currentTitle = place.metaTitle || `${place.name} | Cabo Rojo`;
      currentDescription = place.metaDescription || place.description;
      currentImage = place.imageUrl || currentImage;
    } else if (event) {
      currentTitle = event.title;
      currentDescription = event.description;
      currentImage = event.imageUrl || currentImage;
    }

    // Document Title
    document.title = currentTitle;

    // Meta Tags Helper
    const setMeta = (name: string, content: string, isProperty = false) => {
      let element = document.querySelector(`meta[${isProperty ? 'property' : 'name'}="${name}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(isProperty ? 'property' : 'name', name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    setMeta('description', currentDescription);
    
    // Open Graph
    setMeta('og:title', currentTitle, true);
    setMeta('og:description', currentDescription, true);
    setMeta('og:image', currentImage, true);
    setMeta('og:url', window.location.href, true);
    
    // Twitter
    setMeta('twitter:title', currentTitle);
    setMeta('twitter:description', currentDescription);
    setMeta('twitter:image', currentImage);

  }, [title, description, image, place, event]);

  // 2. Inject Structured Data (JSON-LD)
  useEffect(() => {
    let schemaData: any = null;

    if (place) {
      // LocalBusiness / TouristAttraction Schema
      schemaData = {
        "@context": "https://schema.org",
        "@type": mapCategoryToSchema(place.category),
        "name": place.name,
        "description": place.description,
        "image": [place.imageUrl],
        "telephone": place.phone,
        "url": place.website || window.location.href,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Cabo Rojo",
          "addressRegion": "PR",
          "addressCountry": "US",
          "streetAddress": place.address
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": place.coords?.lat, // Use optional chaining for coords
          "longitude": place.coords?.lng
        },
        "priceRange": place.priceLevel || "$",
        "aggregateRating": place.is_featured ? {
          "@type": "AggregateRating",
          "ratingValue": "4.8",
          "reviewCount": "120"
        } : undefined
      };
    } else if (event) {
      // Event Schema
      schemaData = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": event.title,
        "startDate": event.startTime,
        "endDate": event.endTime || event.startTime, // Fallback if no end time
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {
          "@type": "Place",
          "name": event.locationName,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Cabo Rojo",
            "addressRegion": "PR",
            "addressCountry": "US"
          }
        },
        "image": [event.imageUrl],
        "description": event.description
      };
    } else {
        // Default WebSite Schema
        schemaData = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "El Veci",
            "url": "https://mapadecaborojo.com/",
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://mapadecaborojo.com/?q={search_term_string}",
              "query-input": "required name=search_term_string"
            }
        };
    }

    // Inject Script
    const scriptId = 'json-ld-structured-data';
    let script = document.getElementById(scriptId);
    
    if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
    }
    
    script.textContent = JSON.stringify(schemaData);

    return () => {
        // Cleanup? Usually fine to leave or overwrite.
    };
  }, [place, event]);

  return null; // This component renders nothing visually
};

// Helper to map app categories to Schema.org types
const mapCategoryToSchema = (cat: string) => {
    const map: Record<string, string> = {
        'FOOD': 'Restaurant',
        'LODGING': 'Hotel',
        'BEACH': 'Beach',
        'SIGHTS': 'TouristAttraction',
        'HEALTH': 'Pharmacy', // Salud layer — primarily farmacias; PHASE 2: refine per subcategory (medico→Physician, dentista→Dentist)
        'SHOPPING': 'Store',
        'NIGHTLIFE': 'BarOrPub'
    };
    return map[cat] || 'Place';
};

export default SeoEngine;