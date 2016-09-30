import * as F from './fn'

// at :: Time -> a -> FutureValue t a
// Create a new FutureValue whose value arrived at time t
export const at = (t, x) => new FutureValue(t, x)

// pending :: () -> FutureValue t a
// Create a new FutureValue whose value hasn't yet arrived
export const pending = () => at(Infinity, undefined)

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

  write(t, x) {
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

  write(t, x) {
    throw new Error('Can\'t set never')
  }
}

export const never = new Never()

export const map = (f, future) =>
  future.time < Infinity ? at(future.time, F.map(f,future.value))
    : mapFuture(f, future, pending())

function mapFuture(f, future, futureResult) {
  when(new Map(f, futureResult), future)
  return futureResult
}

class Map {
  constructor(f, future) {
    this.f = f
    this.future = future
  }

  run({ time, value }) {
    this.future.write(time, F.map(this.f, value))
  }
}

// Return a FutureValue that is equivalent to the earlier of
// two FutureValue
export const earliest = (breakTie, fv1, fv2) =>
  fv1.time === Infinity && fv2.time === Infinity
    ? raceFutureWith(breakTie, fv1, fv2, pending()) // both pending
    : earliestOf(breakTie, fv1, fv2) // one isn't pending

const raceFutureWith = (breakTie, fv1, fv2, futureResult) => {
  const race = new Race(breakTie, fv1, fv2, futureResult)
  when(race, fv1)
  when(race, fv2)
  return futureResult
}

const earliestOf = (breakTie, fv1, fv2) =>
  fv1.time === fv2.time
    ? breakTie(fv1, fv2) ? fv1 : fv2
    : fv1.time < fv2.time ? fv1 : fv2

class Race {
  constructor (breakTie, fv1, fv2, future) {
    this.breakTie = breakTie
    this.fv1 = fv1
    this.fv2 = fv2
    this.future = future
  }

  run (fv) {
    const { time, value } = earliestOf(this.breakTie, this.fv1, this.fv2)
    this.future.write(time, value)
  }
}

// Add an action to the awaiters for the provided future
// or execute it immediately if the future's value is known
function when(action, future) {
  if(future.time < Infinity) {
    action.run(future)
  } if (future.action === undefined) {
    future.action = action
  } else {
    future[future.length++] = action
  }
}

// Run all the awaiting actions when a future value is set
function runActions(future) {
  future.action.run(future)
  future.action = undefined

  for (let i = 0; i < future.length; ++i) {
    future[i].run(future)
    future[i] = undefined
  }
}

// Set the time and value of a future, triggering all awaiters
function setFuture(t, x, future) {
  if(future.time < Infinity) {
    throw new Error('future already set')
  }

  future.time = t
  future.value = x

  if(future.action === undefined) {
    return
  }

  runActions(future)
}
