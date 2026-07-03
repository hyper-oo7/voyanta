import React from 'react';
import * as Layouts from './layouts.jsx';

const LAYOUT_MAP = {
  'left-image': Layouts.LeftImage,
  'right-image': Layouts.RightImage,
  'top-image': Layouts.TopImage,
  'bottom-gallery': Layouts.BottomGallery,
  'masonry-gallery': Layouts.MasonryGallery,
  'pinterest-style': Layouts.PinterestStyle,
  'magazine-editorial': Layouts.MagazineEditorial,
  'timeline': Layouts.Timeline,
  'split-screen': Layouts.SplitScreen,
  'floating-cards': Layouts.FloatingCards,
  'glass-cards': Layouts.GlassCards,
  'bento-grid': Layouts.BentoGrid,
  'polaroid-style': Layouts.PolaroidStyle,
  'luxury-card-stack': Layouts.LuxuryCardStack,
  'alternating-layout': Layouts.AlternatingLayout,
  'full-bleed-image': Layouts.FullBleedImage,
  'hero-image-gallery': Layouts.HeroImageGallery,
  'two-column-editorial': Layouts.TwoColumnEditorial,
  'three-column-magazine': Layouts.ThreeColumnMagazine,
  'storybook-layout': Layouts.StorybookLayout,
};

/**
 * Dispatches a day layout rendering based on layoutId.
 * Falls back to AlternatingLayout if layoutId is unrecognized.
 */
export function renderDayLayout(layoutId, props) {
  const Component = LAYOUT_MAP[layoutId] || Layouts.AlternatingLayout;
  return React.createElement(Component, props);
}

export * from './layouts.jsx';
