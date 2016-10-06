// FP & Typeclass delegation helpers

export const compose = (g, f) =>
  x => g(f(x))

export const map = (f, a) =>
  a && typeof a.map === 'function' ? a.map(f) : f(a)

export const lift2 = (f, a, b) =>
  ap(map(a => b => f(a, b), a), b)

export const ap = (ab, a) =>
  typeof ab.ap === 'function' ? ab.ap(a)
    : typeof ab === 'function' ? x => ab(x)(a(x))
      : ab.reduce((acc, f) => concat(acc, map(f, a)), [])

export const apply = (f, a) =>
  f(a)

export const concat = (a, b) =>
  a.concat(b)
