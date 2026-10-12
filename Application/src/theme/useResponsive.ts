import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export interface ResponsiveLayout {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  maxContentWidth: number;
  stageFlexRatio: number;
  sidePanelWidth: number;
}

export type ResponsiveInfo = ResponsiveLayout;

export function useResponsive(): ResponsiveLayout {
  const { width, height } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;

  const sidePanelWidth = isDesktop ? Math.min(480, Math.max(380, width * 0.35)) : width;
  const maxContentWidth = isDesktop ? 1440 : width;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    maxContentWidth,
    stageFlexRatio: isDesktop ? 1.4 : 1,
    sidePanelWidth,
  };
}
