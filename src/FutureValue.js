import * as F from './fn'

// Conceptually, a FutureValue is a value that becomes known
// at a specific time (the temperature outside next Tuesday at 5pm).
// Neither the time nor value can be known until the time arrives.
// Mechanically, it's a write-once, immutable container for a
// (time, value) pair, that allows zero or more awaiters.
export class FutureValue {
  constructor (time, value) {
    this.time = time
    this.value = value
    this._action = undefined
    this._length = 0
  }

  static of (x) {
    return of(x)
  }

  of (x) {
    return of(x)
  }

  static empty () {
    return never
  }

  empty () {
    return never
  }

  concat (fv) {
    return lift2(F.concat, this, fv)
  }

  or (fv) {
    return earliest(preferLeft, this, fv)
  }

  map (f) {
    return map(f, this)
  }

  extend (f) {
    return extend(f, this)
  }

  toString () {
    return `${this.constructor.name} { time: ${this.time}, value: ${this.value} }`
  }

  write (t, x) {
    setFuture(t, x, this)
    return this
  }
}

// pending :: () -> FutureValue t a
// Create a new FutureValue whose value isn't known yet
export const pending = () => at(Infinity, undefined)

// at :: Time -> a -> FutureValue t a
// Create a new FutureValue whose value arrived at time t
const at = (t, x) => new FutureValue(t, x)

// of :: a -> FutureValue a
// Create a FutureValue whose value has always been known to be x
const of = x => at(0, x)

export const never = new (class Never extends FutureValue {
  constructor () {
    super(Infinity, undefined)
  }

  concat (fv) {
    return this
  }

  or (fv) {
    return fv
  }

  map (f) {
    return this
  }

  extend (f) {
    return this
  }

  write (t, x) {
    throw new Error('Can\'t write never')
  }
})()

const lift2 = (f, fv1, fv2) =>
  fv1.time < Infinity && fv2.time < Infinity
    ? at(Math.max(fv1.time, fv2.time), f(fv1.value, fv2.value))
    : whenLift2(f, fv1, fv2, pending())

const whenLift2 = (f, fv1, fv2, futureResult) => {
  const awaitBoth = new AwaitBoth(f, fv1, fv2, futureResult)
  when(awaitBoth, fv1)
  when(awaitBoth, fv2)
  return futureResult
}

class AwaitBoth {
  constructor (f, fv1, fv2, future) {
    this.count = 2
    this.f = f
    this.future = future
    this.fv1 = fv1
    this.fv2 = fv2
  }

  run (fv) {
    if(--this.count === 0) {
      const f = this.f
      this.future.write(fv.time, f(this.fv1.value, this.fv2.value))
    }
  }
}

const map = (f, future) =>
  future.time < Infinity
    ? at(future.time, F.map(f, future.value))
    : mapWhen(f, future, pending())

function mapWhen (f, future, futureResult) {
  when(new Map(f, futureResult), future)
  return futureResult
}

class Map {
  constructor (f, future) {
    this.f = f
    this.future = future
  }

  run ({ time, value }) {
    this.future.write(time, F.map(this.f, value))
  }
}

const extend = (f, future) =>
  future.time < Infinity
    ? at(future.time, f(future))
    : extendWhen(f, future, pending())

function extendWhen (f, future, futureResult) {
  when(new Extend(f, futureResult), future)
  return futureResult
}

class Extend {
  constructor (f, future) {
    this.f = f
    this.future = future
  }

  run (fv) {
    const f = this.f
    this.future.write(fv.time, f(fv))
  }
}

// Return a FutureValue that is equivalent to the earlier of
// two FutureValue
export const earliest = (breakTie, fv1, fv2) =>
  fv1.time === Infinity && fv2.time === Infinity
    ? earliestWhen(breakTie, fv1, fv2, pending()) // both pending
    : earliestOf(breakTie, fv1, fv2) // one isn't pending

const earliestWhen = (breakTie, fv1, fv2, futureResult) => {
  const race = new Earliest(breakTie, fv1, fv2, futureResult)
  when(race, fv1)
  when(race, fv2)
  return futureResult
}

const earliestOf = (breakTie, fv1, fv2) =>
  fv1.time === fv2.time
    ? breakTie(fv1, fv2) ? fv1 : fv2
    : fv1.time < fv2.time ? fv1 : fv2

const preferLeft = () => true

class Earliest {
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
function when (action, future) {
  if (future.time < Infinity) {
    action.run(future)
  } if (future._action === undefined) {
    future._action = action
  } else {
    future[future._length++] = action
  }
}

// Run all the awaiting actions when a future value is set
function runActions (future) {
  future._action.run(future)
  future._action = undefined

  for (let i = 0; i < future._length; ++i) {
    future[i].run(future)
    future[i] = undefined
  }
}

// Set the time and value of a pending future, triggering all awaiters
function setFuture (t, x, future) {
  if (future.time < Infinity) {
    throw new Error('FutureValue already written')
  }

  future.time = t
  future.value = x

  if (future._action === undefined) {
    return
  }

  runActions(future)
}
