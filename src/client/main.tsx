import { createRoot } from 'react-dom/client';
// Two type families: Archivo (heavy display sans for headings) + Inter (highly readable text face)
import '@fontsource/archivo/latin-800';
import '@fontsource/archivo/latin-ext-800';
import '@fontsource/archivo/latin-900';
import '@fontsource/archivo/latin-ext-900';
import '@fontsource/archivo/latin-900-italic';
import '@fontsource/archivo/latin-ext-900-italic';
import '@fontsource/inter/latin-400';
import '@fontsource/inter/latin-ext-400';
import '@fontsource/inter/latin-500';
import '@fontsource/inter/latin-ext-500';
import '@fontsource/inter/latin-600';
import '@fontsource/inter/latin-ext-600';
import '@fontsource/inter/latin-700';
import '@fontsource/inter/latin-ext-700';
import '@fontsource/inter/latin-400-italic';
import '@fontsource/inter/latin-ext-400-italic';
import './styles.css';
import './design.css';
import './polish.css';
import './edition.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
