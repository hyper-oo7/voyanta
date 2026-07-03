export { default as ConfigDrivenRenderer } from './ConfigDrivenRenderer.jsx';
export { TEMPLATE_CONFIGS, getTemplateConfig, getTemplatesByCategory } from './templateConfig.js';
export { resolveTheme, THEME_PRESETS } from './themeEngine.js';
export { resolveLayout, SECTION_LAYOUT_REGISTRY, DAY_LAYOUT_REGISTRY } from './layoutEngine.js';
export { recommendTemplates, getAIRecommendationPrompt } from './recommendationEngine.js';
