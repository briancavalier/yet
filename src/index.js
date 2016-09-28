import { killWith, killBoth } from './kill'

// Base Future, provides default implementations for future API
// Specializations may provide optimized implementations of these
class Future {
  map (f) {
    return new Map(f, this)
  }

  chain (f) {
    return new Chain(f, this)
  }

  ap (fab) {
    return new Ap(fab, this)
  }
}

// A Future whose value is already known
class Known extends Future {
  constructor (value) {
    super()
    this.value = value
  }

  run (action) {
    return action.react(this.value)
  }
}

// A Future whose value is the fmapped value of another Future
class Map extends Future {
  constructor (ab, future) {
    super()
    this.ab = ab
    this.future = future
  }

  run (action) {
    return this.future.run(new Mapped(this.ab, action))
  }
}

class Mapped {
  constructor (ab, reaction) {
    this.ab = ab
    this.reaction = reaction
  }

  react (x) {
    return this.reaction.react(_map(this.ab, x))
  }
}

// A Future which continues the work of another
class Chain extends Future {
  constructor (afb, future) {
    super()
    this.afb = afb
    this.future = future
  }

  run (r) {
    return this.future.run(new Chained(this.afb, r))
  }
}

class Chained {
  constructor (afb, reaction) {
    this.afb = afb
    this.reaction = reaction
  }

  react (x) {
    const afb = this.afb
    return afb(x).run(this.reaction)
  }
}

// Run a task (callback-accepting function) to produce a Future value
class Resolver extends Future {
  constructor (run) {
    super()
    this._run = run
  }

  run (action) {
    return this._run(x => action.react(x))
  }
}

class Handler {
  constructor (f) {
    this.f = f
  }

  react (x) {
    const f = this.f
    return f(x)
  }
}

// A Future value equivalent to the earlier of two others
class Race extends Future {
  constructor (f1, f2) {
    super()
    this.f1 = f1
    this.f2 = f2
  }

  run (action) {
    return new Raced(this.f1, this.f2, action).kill
  }
}

class Raced {
  constructor (f1, f2, reaction) {
    this.reaction = reaction
    this.kill = killBoth(f1.run(this), f2.run(this))
  }

  react (x) {
    this.kill.kill()
    return this.reaction.react(x)
  }
}

class Ap extends Future {
  constructor (fab, fa) {
    super()
    this.fab = fab
    this.fa = fa
  }

  run (action) {
    let count = 2
    const check = () =>
      --count === 0 ? action.react(_ap(ab.value, a.value)) : undefined

    const ab = new ApVar(check)
    const a = new ApVar(check)

    return killBoth(this.fab.run(ab), this.fa.run(a))
  }
}

// mutable placeholder for aggregating parallel futures
class ApVar {
  constructor (check) {
    this.value = undefined // mutable
    this.check = check
  }

  react (x) {
    this.value = x
    this.check()
  }
}

export const future = run => new Resolver(run)
export const of = x => new Known(x)

export const fork = (f, future) => future.run(new Handler(f))

export const delay = (ms, x) =>
  future(fulfill => killWith(clearTimeout, setTimeout(fulfill, ms, x)))

export const race = (f1, f2) => new Race(f1, f2)

export const ap = (fab, fa) => new Ap(fab, fa)

const _map = (f, a) =>
  a && typeof a.map === 'function' ? a.map(f) : f(a)

const _ap = (ab, a) =>
  a && typeof a.ap === 'function' ? a.ap(ab) : ab(a)
