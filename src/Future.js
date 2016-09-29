import { emptyFutureValue } from './FutureValue'
import * as F from './fn'

// Create a future that will receive its value by running a function
export const future = run => new Resolver(run)

// Execute the underlying task that will produce the future's value
// Provide a function to consume the future's eventual value once
// it is computed
export const run = future => {
  const futureValue = emptyFutureValue()
  const kill = future.run(Date.now, new SetFutureValue(futureValue))
  return { kill: () => kill.kill(), futureValue }
}

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
    return this._run(x => action.react(now(), x))
  }
}

class SetFutureValue {
    constructor (futureValue) {
      this.futureValue = futureValue
    }
    react(t, x) {
      return this.futureValue.write(t, x)
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

  react (t, x) {
    return this.reaction.react(t, F.map(this.ab, x))
  }
}
