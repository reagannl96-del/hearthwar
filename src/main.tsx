import '@fontsource/grenze-gotisch/latin-600.css';
import '@fontsource/grenze-gotisch/latin-800.css';
import '@fontsource/alegreya-sans/latin-400.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-700.css';
import './ui/styles.css';
import { render } from 'preact';
import { App } from './ui/App';
import { finishSignInFromUrl } from './net/supabase';

// back from Google: finish signing in and take the login out of the address bar
void finishSignInFromUrl();
render(<App />, document.getElementById('app')!);
