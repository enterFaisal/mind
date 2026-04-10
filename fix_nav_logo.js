const fs = require('fs');

const path = 'frontend/src/components/Navigation.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("import { Home", "import logoUrl from '../assets/logo.svg';\nimport { Home");
content = content.replace('src="/brain-bed.svg"', 'src={logoUrl}');

fs.writeFileSync(path, content);
