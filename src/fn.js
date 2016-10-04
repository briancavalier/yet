// Typeclass delegation helpers

export const map = (f, a) =>
  a && typeof a.map === 'function' ? a.map(f) : f(a)

export const lift2 = (f, a, b) =>
  ap(map(a => b => f(a, b), a), b)

export const ap = (ab, a) =>
  ab && typeof ab.ap === 'function' ? ab.ap(a) : ab(a)

export const apply = (f, a) => f(a)
