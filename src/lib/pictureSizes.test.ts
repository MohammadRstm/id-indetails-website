import { describe, expect, it } from 'vitest';
import { FULL_SIZE, PREVIEW_SIZE, sizedSrc, sizeToFill } from './pictureSizes';

describe('sizedSrc', () => {
  it('asks the API for a copy of one of its pictures', () => {
    expect(sizedSrc('/api/public/website/files/42', 480)).toBe('/api/public/website/files/42?size=480');
    expect(sizedSrc('https://api.example.com/api/public/website/files/42', PREVIEW_SIZE)).toBe(
      'https://api.example.com/api/public/website/files/42?size=160',
    );
  });

  it('leaves any other address as it is', () => {
    expect(sizedSrc('/test/villa/thumb.jpg', 480)).toBe('/test/villa/thumb.jpg');
  });
});

describe('sizeToFill', () => {
  const landscape = { width: 160, height: 119 };
  const portrait = { width: 89, height: 160 };

  it('takes the smallest copy at least as large as the place', () => {
    // a strip card: 207 × 138 px on a screen of 1.5 device px to each
    expect(sizeToFill({ width: 207, height: 138 }, landscape, 1.5, 'cover')).toBe(480);
    expect(sizeToFill({ width: 207, height: 138 }, landscape, 1, 'cover')).toBe(480);
    expect(sizeToFill({ width: 84, height: 63 }, landscape, 1, 'cover')).toBe(PREVIEW_SIZE);
  });

  it('needs more of a photo whose shape is cropped to fill the place', () => {
    // a tall photo across a wide card is as wide as the card, and its height is cropped away
    expect(sizeToFill({ width: 207, height: 138 }, portrait, 1.5, 'cover')).toBe(960);
  });

  it('takes a copy a little smaller than the place: it looks just as sharp', () => {
    // a wide photo cropped into a tall card needs 984 px; the 960 copy is 2% short
    expect(sizeToFill({ width: 293, height: 366 }, { width: 1280, height: 714 }, 1.5, 'cover')).toBe(960);
    expect(sizeToFill({ width: 293, height: 366 }, { width: 1280, height: 714 }, 2, 'cover')).toBe(FULL_SIZE);
  });

  it('needs less of a photo shown whole inside the place', () => {
    expect(sizeToFill({ width: 600, height: 400 }, portrait, 1, 'contain')).toBe(480);
  });

  it('follows the screen: twice the device pixels need twice the photo', () => {
    expect(sizeToFill({ width: 300, height: 300 }, landscape, 1, 'cover')).toBe(480);
    expect(sizeToFill({ width: 300, height: 300 }, landscape, 2, 'cover')).toBe(960);
  });

  it('takes the largest copy for a place larger than it', () => {
    expect(sizeToFill({ width: 1600, height: 1000 }, landscape, 2, 'cover')).toBe(FULL_SIZE);
  });

  it('takes a middle copy for a place not laid out yet', () => {
    expect(sizeToFill({ width: 0, height: 0 }, landscape, 2, 'cover')).toBe(960);
  });
});
