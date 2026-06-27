const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.jsx') && f !== 'DashboardPage.jsx');

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Remove imports
  content = content.replace(/import StitchPage from '[^']+';\n?/g, '');
  content = content.replace(/import navMap from '[^']+';\n?/g, '');
  content = content.replace(/import \{ Voyanta[^}]+\} from '\.\/_html\/[^']+';\n?/g, '');
  
  // Replace <StitchPage ... />
  // Regex to match <StitchPage ... /> spanning multiple lines
  content = content.replace(/<StitchPage[^>]*\/>/g, '<div className="p-xl text-center font-body-lg">TODO: Migrate this page to new React architecture</div>');

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Updated ${file}`);
}
