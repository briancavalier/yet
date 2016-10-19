import { pending } from './FutureValue'
import { killBoth, neverKill } from './kill'
import * as F from './fn'

// run :: Task a -> (KillFunc, FutureValue a)
// Execute a Task that will produce a result.  Returns a function to
// kill the in-progress Task and a FutureValue representing the
// eventual result.
export const runTask = task => {
  const futureValue = pending()
  const kill = task.run(Date.now, new SetFutureValue(futureValue))
  return [kill, futureValue]
}

// task :: ((a -> ()) -> Kill) -> Task a
// Create a Task that will produce a result by running a function
export const task = run =>
  new Task(resolver, run)

// of :: a -> Task a
// Create a Task whose result is x
export const of = x =>
  new Task(just, x)

// race :: Task a -> Task a -> Task a
// Given two Tasks, return a Task equivalent to the one that produces a
// value earlier, and kill the other Task.
export const race = (t1, t2) =>
  new Task(raceTasks, { t1, t2 })

// lift2 :: (a -> b -> c) -> Task a -> Task b -> Task c
// Combine the results of 2 tasks
export const lift2 = (abc, ta, tb) =>
  lift2With(F.lift2, abc, ta, tb)

const lift2With = (apply, abc, ta, tb) =>
  new Task(lift2Tasks, { apply, abc, ta, tb })

// Task type
// A composable unit of async work that produces a FutureValue
export class Task {
  constructor (runTask, state) {
    this.runTask = runTask
    this.state = state
  }

  static of (x) {
    return of(x)
  }

  of (x) {
    return of(x)
  }

  static empty () {
    return neverTask
  }

  empty () {
    return neverTask
  }

  map (ab) {
    return new Task(mapTask, { ab, task: this })
  }

  ap (tfab) {
    return lift2(F.apply, tfab, this)
  }

  chain (atb) {
    return new Task(chainTask, { atb, task: this })
  }

  concat (t2) {
    return lift2With(F.apply2, F.concat, this, t2)
  }

  extend (tab) {
    return new Task(extendTask, { tab, task: this })
  }

  run (now, action) {
    return this.runTask(now, action, this.state)
  }

  toString () {
    return `Task { runTask: ${this.runTask}, state: ${this.state} }`
  }
}

const neverTask = new (class NeverTask extends Task {
  constructor () {
    super(undefined, undefined)
  }

  map (ab) {
    return this
  }

  ap (tfab) {
    return this
  }

  chain (atb) {
    return this
  }

  concat (t) {
    return this
  }

  extend (tab) {
    return this
  }

  run (now, action) {
    return neverKill
  }

  toString () {
    return 'NeverTask {}'
  }
})()

// a Task whose result is already known
const just = (now, action, x) =>
  action.react(0, x)

// Run a callback-accepting function to produce a result
const resolver = (now, action, run) =>
  run(x => action.react(now(), x))

class SetFutureValue {
  constructor (futureValue) {
    this.futureValue = futureValue
  }

  react (t, x) {
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
  const unlessKilled = new UnlessKilled(action)
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

const lift2Tasks = (now, action, { apply, abc, ta, tb }) => {
  // TODO: find a better way
  // Kinda gross: closing over too much and allocating 2 objects
  let count = 2
  const check = t =>
    --count === 0 && action.react(t, apply(abc, a.value, b.value))

  const a = new LiftVar(check)
  const b = new LiftVar(check)

  return killBoth(ta.run(now, a), tb.run(now, b))
}

// mutable container to hold task results for in-flight
// liftN operations
class LiftVar {
  constructor (check) {
    this.check = check
    this.value = undefined
  }

  react (t, x) {
    this.value = x
    return this.check(t)
  }
}

const extendTask = (now, action, { tab, task }) =>
  task.run(now, new Extend(tab, action))

class Extend {
  constructor (tab, action) {
    this.tab = tab
    this.action = action
  }

  react (t, x) {
    const tab = this.tab
    return this.action.react(t, tab(of(x)))
  }
}
