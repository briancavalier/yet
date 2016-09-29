import { emptyFutureValue } from './FutureValue'

// Create a future that will receive its value by running a function
export const future = run => new Resolver(run)

// Execute the underlying task that will produce the future's value
// Provide a function to consume the future's eventual value once
// it is computed
export const fork = future => future.run(Date.now, passthrough)

// Base Future, provides default implementations for future API
// Specializations may provide optimized implementations of these
class Future {
  map (f) {
    return new Map(f, this)
  }
}

// Run a task (callback-accepting function) to produce a Future value
class Resolver extends Future {
  constructor (run) {
    super()
    this._run = run
  }

  run (now, action) {
    const futureValue = emptyFutureValue()
    const kill = this._run(x => runResolver(futureValue, now, action, x))
    return { kill, futureValue }
  }
}

const runResolver = (future, now, action, x) =>
  action.react(emptyFutureValue().setFuture(now(), x))
    .when(({ time, value }) => future.setFuture(time, value))

const passthrough = {
  react (fv) {
    return fv
  }
}

// A Future whose value is the fmapped value of another Future
class Map extends Future {
  constructor (ab, future) {
    super()
    this.ab = ab
    this.future = future
  }

  run (now, action) {
    return this.future.run(now, new Mapped(this.ab, action))
  }
}

class Mapped {
  constructor (ab, reaction) {
    this.ab = ab
    this.reaction = reaction
  }

  react (fv) {
    return this.reaction.react(fv.map(this.ab))
  }
}
