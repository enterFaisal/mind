const fs = require('fs');
let content = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// Remove the old inline Navigation completely
content = content.replace(/function Navigation\(\).*?^\}\n/ms, '');

// Swap the generic lucide-react import for the component import
content = content.replace(
  "import { Home, Mic, MessageSquare, Activity } from 'lucide-react';",
  "import Navigation from './components/Navigation';"
);

fs.writeFileSync('frontend/src/App.jsx', content);
