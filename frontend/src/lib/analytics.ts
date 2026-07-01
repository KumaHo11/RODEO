export const GA_MEASUREMENT_ID = 'G-WNEFPKRP9B';

const isProduction = () => typeof window !== 'undefined' && window.location.hostname === 'rodeoagtech.com';

// log the pageview with their URL
export const pageview = (url: string) => {
  if (isProduction() && typeof window.gtag !== 'undefined') {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};

// log specific events happening
export const event = ({ action, category, label, value, ...rest }: { action: string; category?: string; label?: string; value?: number; [key: string]: any }) => {
  if (isProduction() && typeof window.gtag !== 'undefined') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
      ...rest,
    });
  }
};
