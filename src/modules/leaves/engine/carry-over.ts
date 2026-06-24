/** Art 37.6 — deadline (UTC end-of-day) to consume carry originating from `originYear` entitlement. */
export function carryOverExpiryUtcEndOfDay(params: {
  originYear: number;
  expiryMonth: number;
  expiryDay: number;
}): Date {
  return new Date(
    Date.UTC(params.originYear + 1, params.expiryMonth - 1, params.expiryDay, 23, 59, 59, 999),
  );
}
