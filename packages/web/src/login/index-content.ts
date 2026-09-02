/*
 * The fixed listing behind the sign-in screen.
 *
 * These are NOT the household's recipes and must never be presented as them.
 * The sign-in screen is pre-authentication: it has no session, so it cannot
 * know what is in the book - and a private household's dish names must not be
 * readable by anyone who loads the login URL. This is a fixed set of ordinary
 * home cooking, written as real dishes rather than lorem so the wall reads as
 * a cookbook rather than as filler, and used as texture only. Nothing on the
 * screen counts it or attributes it to the household.
 */

export interface IndexEntry {
  title: string;
  time: string;
}

/** Dish, leader dots, time on the hob - set the way a printed index would. */
export const BACKDROP_INDEX: IndexEntry[] = [
  { title: 'lemon ricotta pasta', time: '24m' },
  { title: 'sunday chicken soup', time: '3h 10m' },
  { title: 'no-knead focaccia', time: '18h' },
  { title: 'black bean tacos', time: '25m' },
  { title: 'roast chicken + potatoes', time: '1h 25m' },
  { title: 'weeknight dal', time: '35m' },
  { title: 'sourdough pancakes', time: '20m' },
  { title: 'braised short ribs', time: '3h 40m' },
  { title: 'smashed cucumber salad', time: '10m' },
  { title: 'shakshuka', time: '30m' },
  { title: 'mushroom risotto', time: '45m' },
  { title: 'banana bread', time: '1h 05m' },
  { title: 'chicken katsu curry', time: '55m' },
  { title: 'miso glazed salmon', time: '22m' },
  { title: 'tomato galette', time: '1h' },
  { title: 'pork ragu', time: '4h' },
  { title: 'cacio e pepe', time: '15m' },
  { title: 'kimchi fried rice', time: '18m' },
  { title: 'green curry', time: '40m' },
  { title: 'apple crumble', time: '50m' },
  { title: 'chili oil noodles', time: '12m' },
  { title: 'roast squash soup', time: '55m' },
  { title: 'buttermilk biscuits', time: '35m' },
  { title: 'beef stew', time: '2h 50m' },
  { title: 'tuna melts', time: '14m' },
  { title: 'spanakopita', time: '1h 20m' },
  { title: 'olive oil chocolate cake', time: '55m' },
  { title: 'lentil bolognese', time: '50m' },
  { title: 'lemon chicken thighs', time: '45m' },
  { title: 'congee', time: '1h 15m' },
  { title: 'potato leek soup', time: '40m' },
  { title: 'sheet-pan sausages', time: '35m' },
  { title: 'gnocchi, brown butter', time: '25m' },
  { title: 'crispy tofu bowls', time: '30m' },
  { title: 'carbonara', time: '18m' },
  { title: 'jerk chicken', time: '1h 10m' },
  { title: 'pesto, freezer batch', time: '15m' },
  { title: 'roast cauliflower', time: '40m' },
  { title: 'birria', time: '5h' },
  { title: 'corn chowder', time: '45m' },
  { title: 'chicken pot pie', time: '1h 30m' },
  { title: 'huevos rancheros', time: '25m' },
  { title: 'mapo tofu', time: '28m' },
  { title: 'pad kra pao', time: '20m' },
  { title: 'coconut rice', time: '22m' },
  { title: 'garlic bread', time: '15m' },
  { title: "sunday sauce + meatballs", time: '3h' },
  { title: 'orzo with feta', time: '25m' },
  { title: 'salmon rice bowls', time: '20m' },
  { title: 'sesame slaw', time: '12m' },
  { title: 'tortilla española', time: '35m' },
  { title: 'chicken shawarma', time: '50m' },
  { title: 'brown butter cookies', time: '40m' },
  { title: 'dutch baby', time: '30m' },
  { title: 'shortcut ramen', time: '45m' },
  { title: 'borscht', time: '1h 40m' },
  { title: 'eggplant parm', time: '1h 15m' },
  { title: 'quiche lorraine', time: '1h 10m' },
  { title: 'quick pickled onions', time: '10m' },
  { title: 'hot honey chicken', time: '40m' },
  { title: 'stuffed peppers', time: '1h' },
  { title: 'laksa', time: '55m' },
  { title: 'skillet cornbread', time: '35m' },
  { title: 'roast pork shoulder', time: '6h' },
  { title: 'chana masala', time: '45m' },
  { title: 'pistachio cake', time: '1h' },
];

/** Split into n roughly equal columns, in order, so each column reads down. */
export function columns<T>(items: T[], count: number): T[][] {
  const size = Math.ceil(items.length / count);
  return Array.from({ length: count }, (_, i) => items.slice(i * size, (i + 1) * size));
}
