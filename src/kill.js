class KillWith {
  constructor (kill, key) {
    this._kill = kill
    this.key = key
  }

  kill () {
    this._kill(this.key)
  }
}

export const killWith = (kill, key) => new KillWith(kill, key)

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

export const killBoth = (kill1, kill2) => new KillBoth(kill1, kill2)
