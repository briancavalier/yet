import { pending, when, FutureValue } from './FutureValue'
import { killBoth, killWith, neverKill } from './kill'
import * as F from './fn'

// run :: Task a -> [Kill, FutureValue a]
// Execute a Task that will produce a result.  Returns a function to
// kill the in-progress Task and a FutureValue representing the
// eventual result.
export const runTask = task => {
  const { kill, futureValue } = task.run(Date.now)
  return [kill, futureValue]
}

// task :: ((a -> ()) -> Kill) -> Task a
// Create a Task that will produce a result by running a function
export const task = run =>
  new Task(resolver, run)

// of :: a -> Task a
// Create a Task whose result is x
export const of = x =>
  new Task(just, FutureValue.of(x))

// race :: Task a -> Task a -> Task a
// Given two Tasks, return a Task equivalent to the one that produces a
// value earlier, and kill the other Task.
export const race = (t1, t2) =>
  new Task(raceTasks, { t1, t2 })

// lift2 :: (a -> b -> c) -> Task a -> Task b -> Task c
// Combine the results of 2 tasks
export const lift2 = (abc, ta, tb) =>
  new Task(lift2Tasks, { abc, ta, tb })

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

  static never () {
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
    return new Task(concatTasks, { t1: this, t2 })
  }

  extend (tab) {
    return new Task(extendTask, { tab, task: this })
  }

  run (now, action) {
    return this.runTask(now, this.state)
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

// NOTE: These implementations prefer simplicity and
// being obviously correct over efficiency.  If efficiency
// becomes an issue, Task could be switched to a more
// efficient implementation that doesn't avoids creating
// intermediate FutureValues internally.

// a Task whose result is already known
const just = (now, x) =>
  ({ kill: neverKill, futureValue: x })

// Run a callback-accepting function to produce a result
const resolver = (now, run) => {
  const futureValue = pending()
  const kill = run(x => futureValue.write(now(), x))
  return { kill, futureValue }
}

// A Task whose value is the mapped result of another Task
const mapTask = (now, { ab, task }) => {
  const { kill, futureValue } = task.run(now)
  return { kill, futureValue: futureValue.map(ab) }
}

// Task that appends more work to another Task, taking the
// previous Task's output as input
const chainTask = (now, { atb, task }) => {
  const { kill, futureValue } = task.run(now)
  const next = futureValue.extend(({ value }) => atb(value).run(now))
  return { kill: killBoth(kill, killWith(killWhen, next)), futureValue: next.chain(extractFutureValue) }
}

const extractFutureValue = ({ futureValue }) => futureValue
const killWhen = (future) => when(killFuture, future)
const killFuture = {
  run: fv => fv.value.kill.kill()
}

const raceTasks = (now, { t1, t2 }) => {
  const { kill: k1, futureValue: f1 } = t1.run(now)
  const { kill: k2, futureValue: f2 } = t2.run(now)

  return { kill: killBoth(k1, k2), futureValue: f1.or(f2) }
}

const concatTasks = (now, { t1, t2 }) => {
  const { kill: k1, futureValue: f1 } = t1.run(now)
  const { kill: k2, futureValue: f2 } = t2.run(now)

  return { kill: killBoth(k1, k2), futureValue: f1.concat(f2) }
}

const lift2Tasks = (now, { abc, ta, tb }) => {
  const { kill: ka, futureValue: fa } = ta.run(now)
  const { kill: kb, futureValue: fb } = tb.run(now)

  return { kill: killBoth(ka, kb), futureValue: F.lift2(abc, fa, fb) }
}

const extendTask = (now, { tab, task }) => {
  const { kill, futureValue } = task.run(now)
  return { kill, futureValue: futureValue.map(Task.of).map(tab) }
}
