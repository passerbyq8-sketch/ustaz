// Provider scores and this boundary both use the production 0..10 scale.
export const passesRerankCardMin = (score, minimum) => Number.isFinite(score) && score > minimum;
