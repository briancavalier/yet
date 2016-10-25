## Task

A Task is a composable unit of asynchronous work.  You can build a blueprint of asynchronous steps using Task operations like `map` and `chain`, and then run the blueprint using `runTask` to get the Task's result as a FutureValue.

Tasks are:

- Lazy: they only execute when their result is demanded with `runTask`.
- Single-consumer: they don't cache their result: they execute and produce a new result each time you pass them to `runTask`.

Running a Task returns a pair: `[killTask, futureValue]`:

- `killTask :: () -> void`: function to abort the Task.  If called before the Task finishes, `futureValue` will remain pending forever.
- `futureValue :: FutureValue a`: FutureValue representing the Task's result.

## FutureValue

A FutureValue is a value that becomes known at a particular time, for example, when a Task completes.  Once a FutureValue's time and value become known, they are immutable.

In contrast to Tasks, FutureValues are:

- Strict (eager): you don't need to poke a FutureValue for it to receive a value.
- Multi-consumer: they are immutable once set, caching their value and arrival time once known.  You can safely cache FutureValues, give them to multiple consumers, etc.

# API

## Types

- `type Resolver a = ((a -> ()) -> Kill`: function to set a Task's result, and return a Kill that can be used to kill the Task while it is still in flight.
- `type Kill = { kill :: () -> () }`: object with a `kill` method to kill an in-flight Task.

## Task

### runTask

```hs
runTask :: Task a -> [Kill, FutureValue a]
```

Execute a Task.  This forces a Task to execute immediately, returning a `Kill` that can be used to kill the Task, and a `FutureValue` representing the Task's eventual result.

### task
 
```hs
task :: Resolver a -> Task a
```

Create a Task that will produce a result by running a resolver function.

```js
import { task, killWith, runTask } from '@briancavalier/yet'

const t = task(resolve =>  killWith(clearTimeout, setTimeout(resolve, 1000, 'hello world')))
const [killTimeout, futureValue] = runTask(t)
```

### Task.of

```hs
Task.of :: a -> Task a
```

Create a Task whose result is `a`

### Task.never

```hs
Task.never :: () -> Task ()
```

Create a Task that never produces a result

### map

```hs
map :: Task a ~> (a -> b) -> Task b
```

Transform a Task's eventual result.

### ap

```hs
ap :: Task a ~> Task (a -> b) -> Task b
```

Given a Task that will produce a value and a Task that will produce a function, create a Task that will apply the function to the value and produce the result.

### lift2

```hs
lift2 :: (a -> b -> c) -> Task a -> Task b -> Task c
```

Combine two Tasks to produce a new one.

### chain

```hs
chain :: Task a ~> (a -> Task b) -> Task b
```

Create a new Task by chaining more work onto an existing one.  The provided function takes the original Task's result as input and returns a new Task.

### or

```hs
or :: Task a ~> Task a -> Task a
```

Given two Tasks, return a Task equivalent to the one that produces a result earlier, automatically killing the Task that loses the race.  Prefers the first Task when the two produce their results simultaneously.

### concat

```hs
concat :: Semigroup a => Task a ~> Task a -> Task a
```

Concatenate two semigroup values produced by the provided Taskss.

```js
const t = Task.of([1,2,3])
  .concat(Task.of([4,5,6])) //> [1,2,3,4,5,6]
```

### extend

```hs
extend :: Task a ~> (Task a -> b) -> Task b
```

Apply a function to a Task's representation at the instant the Task produces a result.

## FutureValue

### map

```hs
map :: FutureValue a ~> (a -> b) -> FutureValue b
```

Map over a value in the future.

### ap

```hs
ap :: FutureValue a ~> FutureValue (a -> b) -> FutureValue b
```

Apply a future function to a future value.

### or

```hs
or :: FutureValue a ~> FutureValue a -> FutureValue a
```

Return a FutureValue that is equivalent to the earlier of two FutureValues, preferring the first if the FutureValues are simultaneous.

### earliest

```hs
earliest :: (FutureValue a -> FutureValue a -> FutureValue a) -> FutureValue a -> FutureValue a -> FutureValue a
```

Return a FutureValue that is equivalent to the earlier of two FutureValues. If the two FutureValues are simultaneous, the provided tie breaker function is used to pick a winner.

### concat

```hs
concat :: Semigroup a => FutureValue a ~> FutureValue a -> FutureValue a
```

Concatenate two semigroup values in the future.

```js
FutureValue.of([1,2,3])
  .concat(FutureValue.of([4,5,6])) //> [1,2,3,4,5,6]
```

### extend

```hs
extend :: FutureValue a ~> (FutureValue a -> b) -> Task b
```

Apply a function to a FutureValue's representation at the time the FutureValue becomes known.

## Kill

### killWith :: (a -> ()) -> a -> Kill

Helper to create a Kill instance whose `kill` method calls the provided function with the provided state.

```js
const killTimeout = killWith(clearTimeout, setTimeout(x => console.log(x), 1000, 'Hi!'))

killTimeout.kill() // Hi! is never logged
```

### killBoth :: Kill -> Kill -> Kill

Combine two Kills into one that kills both.

```js
const killTimeout1 = killWith(clearTimeout, setTimeout(x => console.log(x), 1000, 'Hello'))
const killTimeout2 = killWith(clearTimeout, setTimeout(x => console.log(x), 2000, 'World'))

const killTimeouts = killBoth(killTimeout1, killTimeout2)

killTimeouts.kill() // Neither Hello nor World will be logged
```
