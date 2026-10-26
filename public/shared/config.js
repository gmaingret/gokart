// Data shared by the TV and the phone controller.

export const DRIVERS = [
  { id: 'blaze', name: 'Blaze', color: '#e8322f', accent: '#ffd23f' },
  { id: 'wave', name: 'Wave', color: '#2f7de8', accent: '#ffffff' },
  { id: 'fern', name: 'Fern', color: '#33b249', accent: '#f4f1de' },
  { id: 'sunny', name: 'Sunny', color: '#f5c518', accent: '#3d2c8d' },
  { id: 'plum', name: 'Plum', color: '#8e44c9', accent: '#f6d6ff' },
  { id: 'tango', name: 'Tango', color: '#ff8a1e', accent: '#1d1d1d' },
  { id: 'bubbles', name: 'Bubbles', color: '#ff6fb5', accent: '#ffffff' },
  { id: 'frost', name: 'Frost', color: '#d9e4ee', accent: '#2b6cb0' },
];

export const TRACK_NAMES = [
  'Sunny Circuit', 'Dune Dash', 'Frosty Peaks', 'Neon Night', 'Autumn Woods',
  'Beach Bay', 'Lava Castle', 'Candy Land', 'Jungle Ruins', 'Cosmic Way',
];

export const ITEMS = {
  banana: { label: 'Banana', icon: '🍌' },
  green: { label: 'Green Shell', icon: '🟢' },
  red: { label: 'Red Shell', icon: '🔴' },
  mushroom: { label: 'Mushroom', icon: '🍄' },
  triple: { label: 'Triple Mushroom', icon: '🍄' },
  star: { label: 'Star', icon: '⭐' },
  lightning: { label: 'Lightning', icon: '⚡' },
};

export const CC_OPTIONS = [50, 100, 150];
export const MAX_RACERS = 8;
export const POINTS = [15, 12, 10, 8, 6, 4, 2, 1];

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
