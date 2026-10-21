-- sessions.chip_value / chip_currency: what one chip of a CHIP session is worth, optional (DEC-062).
-- A live game plays in chips; the player may say "1 chip = 1000 VND" to see money beside chips and bb.
-- Both columns are set together, and only on a CHIP session. A rate, not an amount: numeric(14,4).
alter table public.sessions
  add column chip_value numeric(14,4) check (chip_value > 0),
  add column chip_currency text check (chip_currency in ('VND', 'USD', 'EUR', 'KRW', 'JPY', 'THB')),
  add constraint sessions_chip_rate_check check (
    (chip_value is null and chip_currency is null)
    or (chip_value is not null and chip_currency is not null and currency = 'CHIP')
  );
