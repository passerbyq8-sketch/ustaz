// Provider scores and this boundary both use the production 0..10 scale.
export const passesRerankCardMin = (score, minimum) => Number.isFinite(score) && score > minimum;
export const canShowRerankCard = (row) => row?.rerankCardMin === undefined
  || row.rerankScore === undefined
  || passesRerankCardMin(row.rerankScore, row.rerankCardMin);
