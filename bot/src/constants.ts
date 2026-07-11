// Alert duration in days per product type
export const ALERT_DURATIONS: Record<string, number> = {
  transit_reading: 90,
  masterclass_eq: 180,
  masterclass_ll: 180,
};

// Products that qualify for transit alerts
export const ALERT_PRODUCTS = Object.keys(ALERT_DURATIONS);
