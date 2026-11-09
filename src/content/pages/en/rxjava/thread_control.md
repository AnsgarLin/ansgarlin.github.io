---
title: "Thread Control"
updated: "2019-04-04"
---

Thread controlling is one of the specialists of RaJava. By switching time spend process to the other thread, we can avoid the effections on the react time of the screen. 

There are two methods which are used to do the thread controlling in RxJava: `subscribeOn()` and `observeOn()`. Accrofding to the "Basic Concept", we know that `subscribeOn()` is reponsible to decide the thread to send data, and `observeOn()` is used to decide on which thread the operator will be executed.

It's suggested to read "Basic Concept" before continuing on the ariticle. There are concepts that already introduce in "Basic Concept" and will be used in this article.

> [Basic Concept](basic_concept.html)

Here are the example we will use, which is the same as "Basic Concept":

```java
Observable.create(new ObservableOnSubscribe<Integer>() {
  @Override
  public void subscribe(ObservableEmitter<Integer> e) throws Exception {
    e.onNext(0);
  }
})
  .subscribeOn(Schedulers.newThread())
  .observeOn(AndroidSchedulers.mainThread())
  .subscribe(new Consumer<String>() {
    @Override 
    public void accept(String s) throws Exception { }
  });
```
### subscribeOn()

When using `subscribeOn()`, we need to pass the Scheduler into it and get an ObservableSubscribeOn:

```Java
.subscribeOn(Schedulers.newThread())
```

And the Scheduler will be used in `subscribeActual()`:

```java
// In ObservableSubscribeOn
public void subscribeActual(final Observer<? super T> s) {
  final SubscribeOnObserver<T> parent = new SubscribeOnObserver<T>(s);
  s.onSubscribe(parent);
  parent.setDisposable(scheduler.scheduleDirect(new SubscribeTask(parent)));
}
```

The SubscribeTask can be seen as a Runnable.

In `scheduleDirect()`:

```java
// Scheduler
public Disposable scheduleDirect(@NonNull Runnable run, long delay, @NonNull TimeUnit unit) {
  final Worker w = createWorker();
  final Runnable decoratedRun = RxJavaPlugins.onSchedule(run);
  DisposeTask task = new DisposeTask(decoratedRun, w);
  w.schedule(task, delay, unit);
  return task;
}
```

Use `createWorker()` to get a Worker, and get passed into DisposeTask with the Runnable from outside, which is the SubscribeTask:

```java
// In DisposeTask
DisposeTask(Runnable decoratedRun, Worker w) {
  this.decoratedRun = decoratedRun;
  this.w = w;
}
```

There are only assignments In the constrouctor of DisposeTask, so DisposeTask is only for wrapping the SubscribeTask and the Worker together.

Then we look back to the `subscribe()` of Worker. Because there is no implementation of `schedule()` in Worker, we need to trace back to the `createWorker()`:

```java
// In Scheduler
public abstract Worker createWorker();
```

Turn out the `createWorker()` of Scheduler is also an abstract method. So we need to look what kind of Schedule that we use, which is the parameter that we use when calling `subscribeOn()`, `Schedulers.newThread()`：

```java
// In Schedulers
public static Scheduler newThread() {
  return RxJavaPlugins.onNewThreadScheduler(NEW_THREAD);
}
```

The NEW_THREAD will be NewThreadScheduler in the end, the detail will be introduced in the final chapter.

Continue on the `createWorker()`, we can find its implementation in the NewThreadScheduler:

```java
// In NewThreadScheduler
public Worker createWorker() {
  return new NewThreadWorker(threadFactory);
}
```

In NewThreadWorker：

```java
// In NewThreadWorker
private final ScheduledExecutorService executor;
public NewThreadWorker(ThreadFactory threadFactory) {
  executor = SchedulerPoolFactory.create(threadFactory);
}
```

NewThreadWorker will use the ThreadFactory to create a ScheduledExecutorService, which is the ScheduledThreadPoolExecutor, and implement the `subedule()`:

```java
// In NewThreadWorker
public Disposable schedule(@NonNull final Runnable action, long delayTime, @NonNull TimeUnit unit) {
  ...
  return scheduleActual(action, delayTime, unit, null);
}

public ScheduledRunnable scheduleActual(final Runnable run, long delayTime, @NonNull TimeUnit unit, @Nullable DisposableContainer parent) {
  Runnable decoratedRun = RxJavaPlugins.onSchedule(run);
  ScheduledRunnable sr = new ScheduledRunnable(decoratedRun, parent);

  ...
  if (delayTime <= 0L) {
    f = executor.submit((Callable<Object>)sr);
  } else { 
    f = executor.schedule((Callable<Object>)sr, delayTime, unit);    
  }
  ...
}
```

```java
// In ScheduleRunnable
public ScheduledRunnable(Runnable actual, DisposableContainer parent) {
  this.actual = actual;
  this.lazySet(0, parent);
}
```

The Runnable, which is DisposeTask, will be wrapped into ScheduledRunnable. And get executed by the executor, which is the ScheduledExecutorService.

So far, that's see the strcuture of ScheduledRunnable:

```java
ScheduledRunnable {
  actual = DisposeTask {
    decoratedRun = SubscribeTask {
      parent = SubscribeOnObserver      
    }
  }
}
```

When the ScheduledRunnable get executed:

```java
// In ScheduledRunnable
public void run() {
  ...
  actual.run();
  ...
}
```

The actual, which is DisposeTask will be used to call `run()`:

```java
// In DisposeTask
public void run() {
  ...
  decoratedRun.run();
  ...
}
```

And the decoratedRun, which is SubscribeTask will be used to call `run()`:

```java
// In SubscribeTask
public void run() {
  source.subscribe(parent);
}
```

Here we recall the two concepts in the "Basic Concept":

* **Every Observable's constructor is to wrap the upstream Observable.**
* **Every Observer's constructor is to wrap the downstream Observer.**

So we know that the source here is the operator from the upstream, and the parent is the downstream Observer.

Because the `subscribe()` is in a Runnable, and get executed by the NewThreadWorker's ScheduledExecutorService. Start from this point, every operators' `subscribe()` of the upstream Observerble will be executed on the NewThread.

Here we have another concept:

- **In source code, the timing of a Worker calls `schedule()`, is the timing of thread switching.**

Base on the concept, we can know the `e.onNext()` in the `subscribe()` of the ObservableOnSubscribe is executed on the NewThread.

Beside, if calling `subscribeOn()` more than once, it will swith the thread from bottom to top. In this case, we come out an new concept:

- **For `subscribeOn()`, only the closest one to the source is work.**

### observeOn()

Now we talk about how the `observeOn()` to do the thred controling:

```java
.observeOn(AndroidSchedulers.mainThread())
```

And the Scheduler will be used in the`subscribeActual()`:

```java
// In ObservableObserveOn
protected void subscribeActual(Observer<? super T> observer) {
  ...
  Scheduler.Worker w = scheduler.createWorker();
  source.subscribe(new ObserveOnObserver<T>(observer, w, delayError, bufferSize));
  ...
}
```

The Worker will be used in the `schedule()` of the ObserveOnObserver:

```java
// In ObserveOnObserver
public void onNext(T t) {
  ...
  schedule();
}

void schedule() {
  ...
  worker.schedule(this);
  ...
}
```

According to the concept from the previous content, we know the `schedule()` is the start of thread switching.

We know the `worker.schedule()` is called because  `onNext()` will call to `schedule()`. So the `observeOn()` switches the thread when sending data. If we call the `observeOn()` more than one times, it will only effect on the downstream operators:

* **`observeOn()` can be used multipletime.**

### Going to deeper

We have already introduced how the `subscribeOn` or `observeOn()` control the thread and how they works. But there are no any operations directly to the thread controlling.

So here is the big question: **Where is the thread created and activated?**

Because thread is controlled by the Scheduler, so we can sure that the new thread is not created before the Scheduler is not assigned. Hense we can assume there are two places the Scheduler will create new thread:

* Assign a Scheduler.

* When a Worker of the Scheduler call `schedule()`.

#### Assign a Scheduler

In the implementation of Android, `observeOn()` will generally use Android's main thread, which is already activated. So we use the `subscribeOn()` as example:

```java
.subscribeOn(Schedulers.newThread())
```

```java
// In Schedulers
public static Scheduler newThread() {
  return RxJavaPlugins.onNewThreadScheduler(NEW_THREAD);
}
```

Here we use a constant variable NEW_THREAD. That's look the related code:

```java
// In Schedulers
@NonNull
static final Scheduler NEW_THREAD;
static final class NewThreadHolder {
  static final Scheduler DEFAULT = new NewThreadScheduler();
}

static {
  ...
  NEW_THREAD = RxJavaPlugins.initNewThreadScheduler(new NewThreadTask());
}

public static Scheduler initNewThreadScheduler(@NonNull Callable<Scheduler> defaultScheduler) {
  ...
  return callRequireNonNull(defaultScheduler);
  ...
}

static Scheduler callRequireNonNull(@NonNull Callable<Scheduler> s) {
  ...
  return ObjectHelper.requireNonNull(s.call(), "Scheduler Callable result can't be null");
  ...
}

static final class NewThreadTask implements Callable<Scheduler> {
  @Override
  public Scheduler call() throws Exception {
    return NewThreadHolder.DEFAULT;
  }
}
```

There is a static constructor, we know here must be the start place of the whole process: 

* Pass the NewThreadTask to the `initNewThreadScheduler()`.
* The NewThreadTask's `call()` will be executed.
* Get the `NewThreadHolder.Default`, which is a NewThreadScheduler, and assign to the NEW_THREAD.

In the constructor of the NewThreadScheduler:

```java
// In NewThreadScheduler
static {
  ...
  THREAD_FACTORY = new RxThreadFactory(THREAD_NAME_PREFIX, priority);
}

public NewThreadScheduler() {
  this(THREAD_FACTORY);
}
```

This is the whole process of creating and assigning a Scheduler, but still there is no any machenism about creating thread. So the first assumption is not valid, that's continue on the other assimption.

#### When a Worker of the Scheduler call schedule()

From the previous chapter, `Worker.schedule()` will use the `submit()` or `schedule()` of the ScheduledThreadPoolExecutor:

```java
// In ScheduledThreadPoolExecutor
public Future<?> submit(Runnable task) {
  return schedule(task, 0, NANOSECONDS);
}

public ScheduledFuture<?> schedule(Runnable command, long delay, TimeUnit unit) {
  ...
  RunnableScheduledFuture<Void> t = decorateTask(command, new ScheduledFutureTask<Void>(command, null, triggerTime(delay, unit), sequencer.getAndIncrement()));
  delayedExecute(t);
  ...
}

private void delayedExecute(RunnableScheduledFuture<?> task) {
  ...
  super.getQueue().add(task);
  ...
  ensurePrestart()
}
```

No matter the `submit()` or `schedule()`, both of them will end up at `delayedExecute()`. And continue on  `ensurePrestart()`:

```java
// In ThreadPoolExecutor
void ensurePrestart() {
  ...
  addWorker(null, true);
  ...
}

private final class Worker {
  Worker(Runnable firstTask) {
    setState(-1); // inhibit interrupts until runWorker
    this.firstTask = firstTask;
    this.thread = getThreadFactory().newThread(this);
  }
}

private boolean addWorker(Runnable firstTask, boolean core) {
  ...
  w = new Worker(firstTask);
  ...
  final Thread t = w.thread;
  ...
  t.start();
}
```
From `ensurePrestart()` to `addWorker()`, here we see an inner class Worker of the ThreadPoolExecutor, which will use the ThreadFactory to call the `newThread()` in its constructor.

Base on previous content, the THREAD_FACTORY, which is RxThreadFactory, will be passed into the NewThreadWorker when the NewThreadScheduler try to create one.

The ThreadFactory will be passed to the ScheduledThreadPoolExecutor. `getThreadFactory().newThread()` is actually `RxThreadFactory.newThread()`:

```java
// In RxThreadFactory
public Thread newThread(Runnable r) {
  ...
  Thread t = nonBlocking ? new RxCustomThread(r, name) : new Thread(r, name);
  ...
}

static final class RxCustomThread extends Thread implements NonBlockingThread {
  RxCustomThread(Runnable run, String name) {
    super(run, name);
  }
}
```

**Here we finally see a Thread is created**, which use the constructor of the Thread:

```java
// In Thread
public Thread(Runnable target, String name) {
  init(null, target, name, 0);
}

private void init(ThreadGroup g, Runnable target, String name, long stackSize) {
  Thread parent = currentThread();
  if (g == null) {
    g = parent.getThreadGroup();
  }
  g.addUnstarted();
  this.group = g;
  this.target = target;
  this.priority = parent.getPriority();
  this.daemon = parent.isDaemon();
  ...
}
```

There are only assignments in the constructor of Thread, and use ThreadGroup to call the `addUnstarted()`. Bsed on the comment of the `addUnstarted()` in the Java document, the purpose is to notify the ThreadGroup about new thread, not to change the list of on-going thread.

Back to `addWorker()`, call the `start()` of Thread in the end:

```java
// In Thread
public synchronized void start() {
  ...
  group.add(this);
  ...
  nativeCreate(this, stackSize, daemon);
  ...
}
```

Here use `add()` of the ThreadGroup to notify the new Thread is about to be activated, and add into on-going Thread list. Then execute `run()` of the Thread with a native function, **the thread is finally activated until now**: 

```java
// In Thread
public void run() {
  if (target != null) {
    target.run();
  }
}
```

Now the `run()` is runned on the new thread.

The target is a Runnable from outside when the Thread is created, which can be traced back to the ThreadPoolExecutor.Worker's constructor：

```java
// In ThreadPoolExecutor.Worker
this.thread = getThreadFactory().newThread(this);
```

The target is the Worker itself, so that's continue on the `run()` of Worker:

```java
// In ThreadPoolExecutor.Worker
public void run() {
  runWorker(this);
}

final void runWorker(Worker w) {
  ...
  while (task != null || (task = getTask()) != null) {
    ...
    task.run();
    ...
  }
}
```

Go a long way around, here we see the part of executing the task. The task is the DisposeTask that is passed when calling the `scheduleDirect()`.

At the end we finally confirm the timing of creating and activating thread, and the whole process is:

```java
ObservableSubscribeOn.subscribeActual
-> Scheduler.scheduleDirect
-> Worker.schedule
-> ScheduledThreadPoolExecutor.schedule
-> ScheduledThreadPoolExecutor.delayExecute
-> ThreadPoolExecutor.ensurePrestart
-> ThreadPoolExecutor.addWorker {
	 w = new Worker(firstTask) {
     	   Thread thread = getThreadFactory().newThread()            
         };
     final Thread t = w.thread;
     t.start();
   }
```


