const fs = require('fs');

const path = 'frontend/src/pages/Setup.jsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace("import { Globe,", "import logoUrl from '../assets/logo.svg';\nimport { Globe,");
content = content.replace('src="/brain-bed.svg"', 'src={logoUrl}');

fs.writeFileSync(path, content);
