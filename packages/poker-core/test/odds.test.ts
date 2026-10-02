import { describe, expect, it } from 'vitest';
import { potOddsAtDecisions } from '../src/index';
import { hand } from './helpers';

const CO_VS_BTN = { heroPos: 'CO', villPos: 'BTN' } as const;

describe('potOddsAtDecisions', () => {
  it('half-pot bet: 25% pot odds, 66.7% MDF', () => {
    // Flop pot 275, villain bets 137.5.
    const [d] = potOddsAtDecisions(hand('H o100 V c / H x V b137.5 H c', CO_VS_BTN));
    expect(d).toMatchObject({
      street: 'flop',
      index: 4,
      toCall: 137.5,
      potBefore: 412.5,
      potOdds: 0.25,
      mdf: 0.6667,
      betFraction: 0.5,
    });
  });

  it('facing a raise', () => {
    const [d] = potOddsAtDecisions(hand('H o100 V c / H b100 V r400 H c', CO_VS_BTN));
    expect(d).toMatchObject({
      street: 'flop',
      toCall: 300,
      potBefore: 775,
      potOdds: 0.2791,
      mdf: 0.4839,
      betFraction: 1.0667,
    });
  });

  it('completing a limped pot has a price but no bet to defend against', () => {
    const [d] = potOddsAtDecisions(hand('UTG lp H c', { heroPos: 'SB' }));
    expect(d).toMatchObject({
      street: 'preflop',
      toCall: 25,
      potBefore: 125,
      potOdds: 0.1667,
      mdf: null,
      betFraction: null,
    });
  });

  it('caps the price at the hero stack', () => {
    const [d] = potOddsAtDecisions(
      hand('H o100 V ai H c', { ...CO_VS_BTN, heroStack: 300, villStack: 5000 }),
    );
    expect(d?.toCall).toBe(200);
  });

  it('skips actions that do not face a bet (open vs blinds, checks)', () => {
    expect(potOddsAtDecisions(hand('H o100 V c / H x V x', CO_VS_BTN))).toEqual([]);
  });

  it('includes a re-raise against a voluntary bet', () => {
    const ds = potOddsAtDecisions(hand('V o100 H 3b300 V c', { heroPos: 'BTN', villPos: 'CO' }));
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ street: 'preflop', toCall: 100, potBefore: 175 });
  });
});
