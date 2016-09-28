// Create a kill that will call the provided kill function
// with the provided key.
// const timer = killWith(clearTimeout, setTimeout(timerFunc, ms))
// timer.kill() // timerFunc won't be called
export const killWith = (kill, key) => new KillWith(kill, key)

class KillWith {
  constructor (kill, key) {
    this._kill = kill
    this.key = key
  }

  kill () {
    this._kill(this.key)
  }
}

// Combine two kills into a new one that kills both
export const killBoth = (kill1, kill2) => new KillBoth(kill1, kill2)

class KillBoth {
  constructor (kill1, kill2) {
    this.kill1 = kill1
    this.kill2 = kill2
  }

  kill () {
    this.kill1.kill()
    this.kill2.kill()
  }
}

