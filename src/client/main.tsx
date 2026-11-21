import { createRoot } from 'react-dom/client';
import '@fontsource/saira-stencil-one/latin-400.css';
import '@fontsource/saira-stencil-one/latin-ext-400.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-ext-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-ext-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-ext-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow-condensed/latin-ext-800.css';
import '@fontsource/special-elite/latin-400.css';
import '@fontsource/special-elite/latin-ext-400.css';
import './styles.css';
import './design.css';
import './polish.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
