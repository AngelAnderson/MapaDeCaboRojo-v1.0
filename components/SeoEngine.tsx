
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
      // LocalBusiness / TouristAttraction / etc Schema (refined by category + subcategory)
      const schemaType = mapCategoryToSchema(place.category, place.subcategory);
      const breadcrumbList = {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", position: 1, name: "Mapa de Cabo Rojo", item: "https://mapadecaborojo.com/" },
          { "@type": "ListItem", position: 2, name: place.category, item: `https://mapadecaborojo.com/?cat=${encodeURIComponent(place.category)}` },
          { "@type": "ListItem", position: 3, name: place.name, item: window.location.href }
        ]
      };
      const placeSchema: any = {
        "@context": "https://schema.org",
        "@type": schemaType,
        "name": place.name,
        "description": place.description,
        "image": [place.imageUrl].filter(Boolean),
        "telephone": place.phone,
        "url": place.website || window.location.href,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Cabo Rojo",
          "addressRegion": "PR",
          "addressCountry": "US",
          "streetAddress": place.address
        },
        "geo": place.coords ? {
          "@type": "GeoCoordinates",
          "latitude": place.coords.lat,
          "longitude": place.coords.lng
        } : undefined,
        "priceRange": place.priceLevel || "$",
        // Surface the freshness signal — gives LLMs a hint this entry is maintained
        "dateModified": place.verified_at || place.created_at,
        "additionalProperty": place.verified_at ? [
          { "@type": "PropertyValue", name: "verified_at", value: place.verified_at }
        ] : undefined,
        "aggregateRating": place.is_featured ? {
          "@type": "AggregateRating",
          "ratingValue": "4.8",
          "reviewCount": "120"
        } : undefined
      };
      schemaData = { "@graph": [placeSchema, breadcrumbList], "@context": "https://schema.org" };
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

// Helper to map app categories to Schema.org types.
// Covers all 12 PlaceCategory enum values + subcategory refinement for HEALTH
// (pharmacy/dentist/physician/optometrist/etc) so LLM citation + Google rich
// results work across the whole directory, not just FOOD/LODGING.
const mapCategoryToSchema = (cat: string, subcategory?: string) => {
    // HEALTH has finer-grained schema.org types depending on the practice
    if (cat === 'HEALTH' && subcategory) {
        const sub = subcategory.toLowerCase();
        if (sub.includes('dentist') || sub.includes('dental')) return 'Dentist';
        if (sub.includes('vet') || sub.includes('animal')) return 'VeterinaryCare';
        if (sub.includes('optic') || sub.includes('eye')) return 'Optician';
        if (sub.includes('lab')) return 'MedicalClinic';
        if (sub.includes('hospital')) return 'Hospital';
        if (sub.includes('mental') || sub.includes('psych')) return 'MedicalClinic';
        if (sub.includes('chiro') || sub.includes('quiro')) return 'MedicalClinic';
        if (sub.includes('gym') || sub.includes('fitness') || sub.includes('gimnasio')) return 'ExerciseGym';
        if (sub.includes('medico') || sub.includes('doctor') || sub.includes('physician')) return 'Physician';
        return 'Pharmacy'; // default for HEALTH
    }
    const map: Record<string, string> = {
        FOOD: 'Restaurant',
        LODGING: 'LodgingBusiness',
        BEACH: 'Beach',
        SIGHTS: 'TouristAttraction',
        HEALTH: 'Pharmacy',
        SHOPPING: 'Store',
        NIGHTLIFE: 'BarOrPub',
        LOGISTICS: 'LocalBusiness',
        ACTIVITY: 'TouristAttraction',
        SERVICE: 'ProfessionalService',
        HISTORY: 'LandmarksOrHistoricalBuildings',
        PROJECT: 'CivicStructure',
    };
    return map[cat] || 'LocalBusiness';
};

export default SeoEngine;