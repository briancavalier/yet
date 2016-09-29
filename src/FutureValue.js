// Create a new FutureValue whose value arrived at time t
export const at = (t, x) => new FutureValue(t, x)

// Create a new FutureValue whose value hasn't yet arrived
export const emptyFutureValue = () => at(Infinity, undefined)

// Conceptually, a FutureValue is a value that becomes known
// at a specific time (the temperature outside next Tuesday at 5pm).
// Neither the time nor value can be known until the time occurs.
// Mechanically, here, it's a write-once, immutable container for a
// (time, value) pair, that allows zero or more awaiters.
class FutureValue {
  constructor(time, value) {
    this.time = time
    this.value = value
    this.action = undefined
    this.length = 0
  }

  map(f) {
    return map(f, this)
  }

  setFuture(t, x) {
    setFuture(t, x, this)
    return this
  }
}

class Never {
  constructor() {
    this.time = Infinity
    this.value = undefined
  }

  map(f) {
    return this
  }

  setFuture(t, x) {
    throw new Error('Can\'t set never')
  }
}

export const never = new Never()

export const map = (f, future) =>
  future.time < Infinity ? at(future.time, _map(f,future.value))
    : mapFuture(f, future, emptyFutureValue())

function mapFuture(f, p, future) {
  when(new Map(f, future), p)
  return future
}

class Map {
  constructor(f, future) {
    this.f = f
    this.future = future
  }

  run({ time, value }) {
    this.future.setFuture(time, _map(this.f, value))
  }
}

export const copyFrom = (from, to) =>
  when(new CopyFrom(to), from)

class CopyFrom {
  constructor (future) {
    this.future = future
  }

  run({ time, value }) {
    this.future.setFuture(time, value)
  }
}

function when(action, f) {
  if(f.time < Infinity) {
    action.run(f)
  } if (f.action === undefined) {
    f.action = action
  } else {
    f[f.length++] = action
  }
}

function runActions(f) {
  f.action.run(f)
  f.action = undefined

  for (let i = 0; i < f.length; ++i) {
    f[i].run(f)
    f[i] = undefined
  }
}

function setFuture(t, x, f) {
  if(f.time < Infinity) {
    throw new Error('future already set')
  }

  f.time = t
  f.value = x

  if(f.action === undefined) {
    return
  }

  runActions(f)
}

// Typeclass delegation helpers
const _map = (f, a) =>
  a && typeof a.map === 'function' ? a.map(f) : f(a)
