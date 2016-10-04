(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.briancavalier_yet = global.briancavalier_yet || {})));
}(this, (function (exports) { 'use strict';

// Typeclass delegation helpers

var map$2$1 = function (f, a) { return a && typeof a.map === 'function' ? a.map(f) : f(a); };

var lift2$1 = function (f, a, b) { return ap$1(map$2$1(function (a) { return function (b) { return f(a, b); }; }, a), b); };

var ap$1 = function (ab, a) { return ab && typeof ab.ap === 'function' ? ab.ap(a) : ab(a); };

var apply = function (f, a) { return f(a); };

// at :: Time -> a -> FutureValue t a
// Create a new FutureValue whose value arrived at time t
var at = function (t, x) { return new FutureValue(t, x); };

// pending :: () -> FutureValue t a
// Create a new FutureValue whose value hasn't yet arrived
var pending = function () { return at(Infinity, undefined); };

// Conceptually, a FutureValue is a value that becomes known
// at a specific time (the temperature outside next Tuesday at 5pm).
// Neither the time nor value can be known until the time occurs.
// Mechanically, here, it's a write-once, immutable container for a
// (time, value) pair, that allows zero or more awaiters.
var FutureValue = function FutureValue(time, value) {
  this.time = time;
  this.value = value;
  this.action = undefined;
  this.length = 0;
};

FutureValue.prototype.map = function map$1 (f) {
  return map$1$1(f, this);
};

FutureValue.prototype.write = function write (t, x) {
  setFuture(t, x, this);
  return this;
};

var Never = function Never() {
  this.time = Infinity;
  this.value = undefined;
};

Never.prototype.map = function map$2 (f) {
  return this;
};

Never.prototype.write = function write (t, x) {
  throw new Error('Can\'t set never');
};

var never = new Never();

var map$1$1 = function (f, future) { return future.time < Infinity ? at(future.time, map$2$1(f, future.value)) : mapFuture(f, future, pending()); };

function mapFuture(f, future, futureResult) {
  when(new Map(f, futureResult), future);
  return futureResult;
}

var Map = function Map(f, future) {
  this.f = f;
  this.future = future;
};

Map.prototype.run = function run (ref) {
    var time = ref.time;
    var value = ref.value;

  this.future.write(time, map$2$1(this.f, value));
};

// Return a FutureValue that is equivalent to the earlier of
// two FutureValue
var earliest = function (breakTie, fv1, fv2) { return fv1.time === Infinity && fv2.time === Infinity ? raceFutureWith(breakTie, fv1, fv2, pending()) // both pending
: earliestOf(breakTie, fv1, fv2); }; // one isn't pending

var raceFutureWith = function (breakTie, fv1, fv2, futureResult) {
  var race = new Race(breakTie, fv1, fv2, futureResult);
  when(race, fv1);
  when(race, fv2);
  return futureResult;
};

var earliestOf = function (breakTie, fv1, fv2) { return fv1.time === fv2.time ? breakTie(fv1, fv2) ? fv1 : fv2 : fv1.time < fv2.time ? fv1 : fv2; };

var Race = function Race(breakTie, fv1, fv2, future) {
  this.breakTie = breakTie;
  this.fv1 = fv1;
  this.fv2 = fv2;
  this.future = future;
};

Race.prototype.run = function run (fv) {
  var ref = earliestOf(this.breakTie, this.fv1, this.fv2);
    var time = ref.time;
    var value = ref.value;
  this.future.write(time, value);
};

// Add an action to the awaiters for the provided future
// or execute it immediately if the future's value is known
function when(action, future) {
  if (future.time < Infinity) {
    action.run(future);
  }if (future.action === undefined) {
    future.action = action;
  } else {
    future[future.length++] = action;
  }
}

// Run all the awaiting actions when a future value is set
function runActions(future) {
  future.action.run(future);
  future.action = undefined;

  for (var i = 0; i < future.length; ++i) {
    future[i].run(future);
    future[i] = undefined;
  }
}

// Set the time and value of a future, triggering all awaiters
function setFuture(t, x, future) {
  if (future.time < Infinity) {
    throw new Error('future already set');
  }

  future.time = t;
  future.value = x;

  if (future.action === undefined) {
    return;
  }

  runActions(future);
}

// Create a kill that will call the provided kill function
// with the provided key.
// const timer = killWith(clearTimeout, setTimeout(timerFunc, ms))
// timer.kill() // timerFunc won't be called
var killWith = function (kill, key) { return new KillWith(kill, key); };

var KillWith = function KillWith(kill, key) {
  this._kill = kill;
  this.key = key;
};

KillWith.prototype.kill = function kill () {
  this._kill(this.key);
};

// Combine two kills into a new one that kills both
var killBoth = function (kill1, kill2) { return new KillBoth(kill1, kill2); };

var KillBoth = function KillBoth(kill1, kill2) {
  this.kill1 = kill1;
  this.kill2 = kill2;
};

KillBoth.prototype.kill = function kill () {
  this.kill1.kill();
  this.kill2.kill();
};

var neverKill = {
  kill: function kill() {}
};

// task :: ((a -> ()) -> Kill) -> Task a
// Create a Task that will produce a result by running a function
var task = function (run) { return new Task(resolver, run); };

// run :: Task a -> (KillFunc, FutureValue a)
// Execute a Task that will produce a result.  Returns a function to
// kill the in-progress Task and a FutureValue representing the
// eventual result.
var runTask = function (task) {
  var futureValue = pending();
  var kill = task.run(Date.now, new SetFutureValue(futureValue));
  return [kill, futureValue];
};

// race :: Task a -> Task a -> Task a
// Given two Tasks, return a Task equivalent to the one that produces a
// value earlier, and kill the other Task.
var race = function (t1, t2) { return new Task(raceTasks, { t1: t1, t2: t2 }); };

// lift2 :: (a -> b -> c) -> Task a -> Task b -> Task c
// Combine the results of 2 tasks
var lift2$$1 = function (abc, ta, tb) { return new Task(lift2Tasks, { abc: abc, ta: ta, tb: tb }); };

// Task type
// A composable unit of async work that produces a FutureValue
var Task = function Task(runTask, state) {
  this.runTask = runTask;
  this.state = state;
};

Task.prototype.map = function map (ab) {
  return new Task(mapTask, { ab: ab, task: this });
};

Task.prototype.ap = function ap (tfab) {
  return lift2$$1(apply, tfab, this);
};

Task.prototype.chain = function chain (atb) {
  return new Task(chainTask, { atb: atb, task: this });
};

Task.prototype.run = function run (now, action) {
  return this.runTask(now, action, this.state);
};

// Run a callback-accepting function to produce a result
var resolver = function (now, action, run) { return run(function (x) { return action.react(now(), x); }); };

var SetFutureValue = function SetFutureValue(futureValue) {
  this.futureValue = futureValue;
};

SetFutureValue.prototype.react = function react (t, x) {
  return this.futureValue.write(t, x);
};

// A Task whose value is the mapped result of another Task
var mapTask = function (now, action, ref) {
  var ab = ref.ab;
  var task = ref.task;

  return task.run(now, new Mapped(ab, action));
};

var Mapped = function Mapped(ab, action) {
  this.ab = ab;
  this.action = action;
};

Mapped.prototype.react = function react (t, x) {
  return this.action.react(t, map$2$1(this.ab, x));
};

// Task that appends more work to another Task, taking the
// previous Task's output as input
var chainTask = function (now, action, ref) {
  var atb = ref.atb;
  var task = ref.task;

  var unlessKilled = new UnlessKilled(action);
  return killBoth(unlessKilled, task.run(now, new Chained(now, atb, unlessKilled)));
};

var Chained = function Chained(now, atb, action) {
  this.now = now;
  this.atb = atb;
  this.action = action;
};

Chained.prototype.react = function react (t, x) {
  var atb = this.atb;
  return atb(x).run(this.now, this.action);
};

var UnlessKilled = function UnlessKilled(action) {
  this.action = action;
};

UnlessKilled.prototype.react = function react (t, x) {
  return this.action.react(t, x);
};

UnlessKilled.prototype.kill = function kill () {
  this.action = emptyAction;
};

var emptyAction = {
  react: function react(t, x) {}
};

var raceTasks = function (now, action, ref) {
  var t1 = ref.t1;
  var t2 = ref.t2;

  var r1 = new Raced(action);
  var r2 = new Raced(action);
  r2.kill = t1.run(now, r1);
  r1.kill = t2.run(now, r2);

  return killBoth(r1.kill, r2.kill);
};

var Raced = function Raced(action) {
  this.kill = neverKill;
  this.action = action;
};

Raced.prototype.react = function react (t, x) {
  this.kill.kill();
  this.action.react(t, x);
};

var lift2Tasks = function (now, action, ref) {
  var abc = ref.abc;
  var ta = ref.ta;
  var tb = ref.tb;

  // TODO: find a better way
  // Kinda gross: closing over too much and allocating 2 objects
  var count = 2;
  var check = function (t) { return --count === 0 && action.react(t, lift2$1(abc, a.value, b.value)); };

  var a = new LiftVar(check);
  var b = new LiftVar(check);

  return killBoth(ta.run(now, a), tb.run(now, b));
};

// mutable container to hold task results for in-flight
// liftN operations
var LiftVar = function LiftVar(check) {
  this.check = check;
  this.value = undefined;
};

LiftVar.prototype.react = function react (t, x) {
  this.value = x;
  return this.check(t);
};

exports.task = task;
exports.runTask = runTask;
exports.race = race;
exports.lift2 = lift2$$1;
exports.pending = pending;
exports.earliest = earliest;
exports.killWith = killWith;
exports.killBoth = killBoth;

Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=index.js.map
