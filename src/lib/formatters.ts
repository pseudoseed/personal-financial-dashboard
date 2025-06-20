export const formatBalance = (amount: number | null) => {
  if (amount === null || amount === undefined) {
    return "$0.00";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}; 