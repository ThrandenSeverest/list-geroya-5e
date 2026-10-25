import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectHomeHeroArt } from '../app/homeHeroArt';

test('original blue and gold and parchment artwork stays untouched', () => {
  assert.equal(selectHomeHeroArt('classic', ''), 'home/hero-night.webp');
  assert.equal(selectHomeHeroArt('parchment', ''), 'home/hero-day.webp');
});

test('all other design presets and personalized themes use universal PNG', () => {
  for (const theme of ['paper','graphite','journal','custom-uuid']) {
    assert.equal(selectHomeHeroArt('classic',theme),'home/hero-universal-v2.png');
    assert.equal(selectHomeHeroArt('parchment',theme),'home/hero-universal-v2.png');
  }
});
