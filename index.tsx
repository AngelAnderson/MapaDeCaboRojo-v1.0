import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { LanguageProvider } from './i18n/LanguageContext';

// Standalone owner-facing form. Lazy-loaded so it never enters the map bundle.
// Shareable: mapadecaborojo.com/?page=negocio
const AddBusinessPage = lazy(() => import('./components/AddBusinessPage'));
// Living style guide for the Level-20 design system. Route: ?page=ui
const StyleGuide = lazy(() => import('./components/ui/StyleGuide'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Route static standalone pages before mounting the (heavy) map app.
const pageParam = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('page')
  : null;

const root = ReactDOM.createRoot(rootElement);

if (pageParam === 'negocio') {
  root.render(
    <React.StrictMode>
      <LanguageProvider>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <AddBusinessPage />
          </Suspense>
        </ErrorBoundary>
      </LanguageProvider>
    </React.StrictMode>
  );
} else if (pageParam === 'ui') {
  root.render(
    <React.StrictMode>
      <Suspense fallback={null}>
        <StyleGuide />
      </Suspense>
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <LanguageProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </LanguageProvider>
    </React.StrictMode>
  );
}
