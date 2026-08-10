const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function findAndReplace(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findAndReplace(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // If the file contains progress_activity
      if (content.includes('progress_activity') && !content.includes('FlyingLoader')) {
        let needsImport = false;
        
        // Find spans with progress_activity and animate-spin
        const regex = /<span[^>]*animate-spin[^>]*>progress_activity<\/span>/g;
        if (regex.test(content)) {
          content = content.replace(regex, (match) => {
            needsImport = true;
            // Extract class names
            const classMatch = match.match(/className=(["'])(.*?)\1/);
            let classes = classMatch ? classMatch[2] : '';
            // Remove material-symbols-outlined, animate-spin, progress_activity specifics
            classes = classes.replace(/material-symbols-outlined/g, '').replace(/animate-spin/g, '').replace(/text-primary/g, '').trim();
            // Simplify sizes
            let size = 'text-3xl';
            if (classes.includes('text-sm')) size = 'text-sm';
            if (classes.includes('text-[16px]')) size = 'text-[16px]';
            if (classes.includes('text-[18px]')) size = 'text-[18px]';
            if (classes.includes('text-[20px]')) size = 'text-[20px]';
            if (classes.includes('text-[24px]')) size = 'text-[24px]';
            if (classes.includes('text-4xl')) size = 'text-4xl';
            if (classes.includes('text-5xl')) size = 'text-5xl';
            if (classes.includes('text-xxl')) size = 'text-5xl';
            
            // Filter out those size classes from className
            const sizeRegex = /text-(sm|xs|base|lg|xl|2xl|3xl|4xl|5xl|xxl|\[\d+px\])/g;
            const remainingClasses = classes.replace(sizeRegex, '').trim();
            
            let props = [];
            if (size !== 'text-3xl') props.push(`size="${size}"`);
            if (remainingClasses) props.push(`className="${remainingClasses}"`);
            
            return `<FlyingLoader ${props.join(' ')} />`;
          });
        }
        
        // App.jsx has a special one with inline style:
        const appRegex = /<span className="material-symbols-outlined text-primary" style={{ fontSize: 32, animation: 'spin 1s linear infinite' }}>progress_activity<\/span>/g;
        if (appRegex.test(content)) {
          content = content.replace(appRegex, '<FlyingLoader size="text-[32px]" />');
          needsImport = true;
        }
        
        if (needsImport) {
          // Add import statement after the last import
          const importMatches = [...content.matchAll(/^import .* from .*;?$/gm)];
          const lastImportIndex = importMatches.length > 0 ? importMatches[importMatches.length - 1].index + importMatches[importMatches.length - 1][0].length : 0;
          
          // Calculate relative path to components/common/FlyingLoader
          const fileDir = path.dirname(fullPath);
          const commonDir = path.join(srcDir, 'components', 'common');
          let relativePath = path.relative(fileDir, commonDir).replace(/\\/g, '/');
          if (!relativePath.startsWith('.')) relativePath = './' + relativePath;
          
          const importStmt = `\nimport FlyingLoader from '${relativePath}/FlyingLoader.jsx';`;
          content = content.substring(0, lastImportIndex) + importStmt + content.substring(lastImportIndex);
          
          fs.writeFileSync(fullPath, content);
          console.log(`Updated ${fullPath}`);
        }
      }
    }
  }
}

findAndReplace(srcDir);
