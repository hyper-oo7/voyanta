---
name: voyanta-template-registry
description: Instructions and architectural patterns for creating, registering, and styling new Voyanta document and presentation templates using the Template Registry pattern.
---

# Voyanta Template Registry Skill

Use this skill when adding new PDF proposal layouts, presentation themes, or editorial magazine designs to the Voyanta platform.

## Architecture & Decoupling
Voyanta uses a central Template Registry (`frontend/src/templates/registry.js`) that maps style slugs to lazy-loaded template layout components.
Do NOT modify `ClassicTemplateRenderer` inside `TemplateRenderer.jsx` when adding new designs. Instead, create self-contained template modules under `frontend/src/templates/<name>/`.

## Adding a New Template (Step-by-Step)

### 1. Create the Template Component
Create a new directory and React component under `frontend/src/templates/<template-name>/<TemplateName>Template.jsx`.
Always import shared utilities and styling helpers from `frontend/src/templates/base/BaseTemplate.jsx`:
```jsx
import React from 'react';
import './<template-name>.css';
import { formatPrice, safeText, SectionHeader, PageBreak } from '../base/BaseTemplate.jsx';

export default function MyCustomTemplate({ data, include = {}, viewMode = 'document' }) {
  const p = data.proposal || {};
  const b = p.preferences?.branding || {};
  const items = data.items_by_kind || {};
  const total = data.totals?.subtotal || 0;
  const currency = data.totals?.currency || 'INR';

  return (
    <div className="template-my-custom w-full">
      {/* Cover Section */}
      {(include.hero ?? true) && (
        <section className="custom-cover">
          <h1>{safeText(p.name || p.destination || 'Proposal')}</h1>
        </section>
      )}
      
      {/* Use PageBreak for clean PDF page boundaries */}
      <PageBreak />
      
      {/* Other sections... */}
    </div>
  );
}
```

### 2. Add Print & PDF Stylesheet Resets
In your `<template-name>.css` file, ensure proper print CSS isolation so that PDF exports look crisp regardless of the user's browser theme:
```css
.template-my-custom {
  color: #1a1a1a;
  background-color: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

@media print {
  @page { size: A4; margin: 0; }
  .template-my-custom section {
    page-break-inside: avoid;
    break-inside: avoid;
  }
}
```

### 3. Register the Template in `registry.js`
In `frontend/src/templates/registry.js`, import your component using `lazy()` and add its metadata to `TEMPLATE_REGISTRY`:
```javascript
export const TEMPLATE_REGISTRY = {
  // ... existing entries
  my_custom: {
    name: 'My Custom Luxury Design',
    category: 'Luxury',
    description: 'A breathtaking layout tailored for elite travel experiences.',
    thumbnail: 'https://images.unsplash.com/...',
    bestFor: ['luxury', 'safari'],
    component: lazy(() => import('./my_custom/MyCustomTemplate.jsx')),
  },
};
```

### 4. Verification & Testing
Once registered:
1. Open the Proposal Wizard at **Step 6 (Branding & Template)**. The new layout will automatically appear in the visual **Template Architecture Gallery**.
2. Select the template and proceed to **Step 7 (Preview & Export)**. Verify that toggle sections dynamically hide/show without layout breakage.
3. Click **Generate PDF** to test Puppeteer rendering. Confirm generation finishes under 3 seconds and output PDF preserves full-bleed headers and custom typography.
