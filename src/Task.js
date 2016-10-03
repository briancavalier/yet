import { pending } from './FutureValue'
import { killBoth, neverKill } from './kill'
import * as F from './fn'

// task :: ((a -> ()) -> Kill) -> Task a
// Create a Task that will produce a result by running a function
export const task = run =>
  new Task(resolver, run)

// run :: Task a -> FutureValue a
// Execute a Task that will produce a result.  Returns a FutureValue
// representing the eventual result.
export const run = task => {
  const futureValue = pending()
  const kill = task.run(Date.now, new SetFutureValue(futureValue))
  return [() => kill.kill(), futureValue]
}

// race :: Task a -> Task a -> Task a
// Given two Tasks, return a Task equivalent to the one that produces a
// value earlier, and kill the other Task.
export const race = (t1, t2) =>
  new Task(raceTasks, { t1, t2 })

// Base Task, provides default implementations of Task API
// Specializations may provide optimized implementations of methods
class Task {
  constructor (runTask, state) {
    this.runTask = runTask
    this.state = state
  }

  map (ab) {
    return new Task(mapTask, { ab, task: this })
  }

  chain (atb) {
    return new Task(chainTask, { atb, task: this })
  }

  run (now, action) {
    return this.runTask(now, action, this.state)
  }
}

// Run a callback-accepting function to produce a result
const resolver = (now, action, run) =>
  run(x => action.react(now(), x))

class SetFutureValue {
    constructor (futureValue) {
      this.futureValue = futureValue
    }

    react(t, x) {
      return this.futureValue.write(t, x)
    }
}

// A Task whose value is the mapped result of another Task
const mapTask = (now, action, { ab, task }) =>
  task.run(now, new Mapped(ab, action))

class Mapped {
  constructor (ab, action) {
    this.ab = ab
    this.action = action
  }

  react (t, x) {
    return this.action.react(t, F.map(this.ab, x))
  }
}

// Task that appends more work to another Task, taking the
// previous Task's output as input
const chainTask = (now, action, { atb, task }) => {
  const unlessKilled = new UnlessKilled(action);
  return killBoth(unlessKilled, task.run(now, new Chained(now, atb, unlessKilled)))
}

class Chained {
  constructor (now, atb, action) {
    this.now = now
    this.atb = atb
    this.action = action
  }

  react (t, x) {
    const atb = this.atb
    return atb(x).run(this.now, this.action)
  }
}

class UnlessKilled {
  constructor (action) {
    this.action = action
  }

  react (t, x) {
    return this.action.react(t, x)
  }

  kill () {
    this.action = emptyAction
  }
}

const emptyAction = {
  react (t, x) {}
}

const raceTasks = (now, action, { t1, t2 }) => {
  const r1 = new Raced(action)
  const r2 = new Raced(action)
  r2.kill = t1.run(now, r1)
  r1.kill = t2.run(now, r2)

  return killBoth(r1.kill, r2.kill)
}

class Raced {
  constructor (action) {
    this.kill = neverKill
    this.action = action
  }

  react (t, x) {
    this.kill.kill()
    this.action.react(t, x)
  }
}
