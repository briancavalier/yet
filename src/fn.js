// Typeclass delegation helpers

export const map = (f, a) =>
  a && typeof a.map === 'function' ? a.map(f) : f(a)
