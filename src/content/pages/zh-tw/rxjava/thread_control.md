---
title: "Thread控制"
updated: "2019-04-04"
---

Thread控制是RxJava的特點之一，透過切換thread，可以將耗時的操作透過特定的thread執行。如此不只避免干擾到畫面的反應時間，擁有專屬的thread來執行操作，也可降低整體所需時間。

在RxJava中控制thread的僅有兩個函式：`subscribeOn()` 和 `observeOn()`。由"基本概念"的那篇文章中可以知道，`subscribeOn()`負責決定資料送出的thread；`observeOn()`控制執行operator的thread。

建議可先看過"基本概念"再來接續閱讀，因為以下會用到"基本概念"內的觀念。

> [基本概念](basic_concept.html)

以下將繼續引用"基本概念"內的範例程式碼：

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

在使用`subscribeOn()`時，需要傳入Scheduler，並得到ObservableSubscribeOn：

```Java
.subscribeOn(Schedulers.newThread())
```

而這Scheduler會在`subscribeActual()`被呼叫時使用：

```java
// In ObservableSubscribeOn
public void subscribeActual(final Observer<? super T> s) {
  final SubscribeOnObserver<T> parent = new SubscribeOnObserver<T>(s);
  s.onSubscribe(parent);
  parent.setDisposable(scheduler.scheduleDirect(new SubscribeTask(parent)));
}
```

這邊的SubscribeTask可直接當成單純的Runnable。

看進去`scheduleDirect()`：

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

在此先用`createWorker()`取得Worker，然後與外部傳進來的Runnable，也就是SubscribeTask，一起傳入DisposeTask：

```java
// In DisposeTask
DisposeTask(Runnable decoratedRun, Worker w) {
  this.decoratedRun = decoratedRun;
  this.w = w;
}
```

在DisposeTask的constructor沒做其他事，所以DisposeTask用來將SubscribeTask再做一層包裝。

接著再回到Worker的`subscribe()`，但由於Worker沒有實作`schedule()`，需要往前看到`createWorker()`：

```java
// In Scheduler
public abstract Worker createWorker();
```

結果Scheduler的`createWorker()`也是一個抽象函式，因此再往前追朔到Scheduler的實際類別，也就是我們呼叫`subscribeOn()`時傳入的參數`Schedulers.newThread()`：

```java
// In Schedulers
public static Scheduler newThread() {
  return RxJavaPlugins.onNewThreadScheduler(NEW_THREAD);
}
```

這裡的NEW_THREAD最後會是NewThreadScheduler，詳細過程會在最後的章節介紹。

接續之前的`createWorker()`，從NewThreadScheduler可以找到實作：

```java
// In NewThreadScheduler
public Worker createWorker() {
  return new NewThreadWorker(threadFactory);
}
```

看進去NewThreadWorker：

```java
// In NewThreadWorker
private final ScheduledExecutorService executor;
public NewThreadWorker(ThreadFactory threadFactory) {
  executor = SchedulerPoolFactory.create(threadFactory);
}
```

NewThreadWorker會透過傳入的ThreadFactory建立一個ScheduledExecutorService，也是ScheduledThreadPoolExecutor，並且實作`subedule()`：

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

外部傳入的Runnable，也就是DisposeTask，會再被包進ScheduledRunnable，然後交由executor，也就是ScheduledExecutorService來傳入`submit()`或是`schedule()`執行。

到此，我們先來看一下ScheduledRunnable的結構：

```java
ScheduledRunnable {
  actual = DisposeTask {
    decoratedRun = SubscribeTask {
      parent = SubscribeOnObserver
    }
  }
}
```

接著，我們來看當ScheduledRunnable被執行時的過程：

```java
// In ScheduledRunnable
public void run() {
  ...
  actual.run();
  ...
}
```

直接使用actual，也就是DisposeTask來呼叫`run()`：

```java
// In DisposeTask
public void run() {
  ...
  decoratedRun.run();
  ...
}
```

再用decoratedRun，也就是SubscribeTask來呼叫`run()`：

```java
// In SubscribeTask
public void run() {
  source.subscribe(parent);
}
```

這邊讓我們來回想一下"基礎概念"內提到的兩個觀念：

* **任何Observable的constructor，都是將上游的Observable包起來**。


* **任何Observer的constructor，都是將下游的Observer包起來。**

所以，這邊的source就是上游的operator，而parent就是下游傳上來的Observer。

因為這個`subscribe()`的操作是在Runnable裡面，並由NewThreadWorker自帶的ScheduledExecutorService執行。從這個點開始，任何上游的operator的`subscribe()`都是在NewThread內進行。

這邊可以給出一個觀念：

- **原始碼中，Worker呼叫`schedule()`的位置，就是切換thread的起點。**

可以推斷的是，最後我們宣告的ObservableOnSubscribe的`subscribe()`，裡面的`e.onNext()`也是在NewThread內執行。

另外，如果多次使用`subscribeOn()`，則會使thread由下而上一路切換，因此這邊有另一觀念：

- **`subscribeOn()`只有離源頭最近的有效。**

### observeOn()

接著來談`observeOn()`如何進行thread的控制，跟`subscribeOn()`一樣，使用時需要傳入Scheduler：

```java
.observeOn(AndroidSchedulers.mainThread())
```

而這Scheduler會在`subscribeActual()`被呼叫時使用：

```java
// In ObservableObserveOn
protected void subscribeActual(Observer<? super T> observer) {
  ...
  Scheduler.Worker w = scheduler.createWorker();
  source.subscribe(new ObserveOnObserver<T>(observer, w, delayError, bufferSize));
  ...
}
```

傳進去的Worker會在ObserveOnObserver的`schedule()`內使用：

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

根據前述關於Worker的新觀念，我們可推斷這邊的`schedule()`就是切換thread的起點。

而`worker.schedule()`又是`onNext()`呼叫`schedule()`而來，因此`observeOn()`是在資料傳遞時切換thread。也因此如果多次使用，其只會影響下游的operator的thread，於是有以下觀念：

* **`observeOn()`可多次使用並且有效。**

### Going to deeper

到這我們介紹了`subscribeOn`和`observeOn()`透過Scheduler控制thread的方法及內部流程，其中沒有直接針對thread的操作。

於是這裡遇到的問題是：**那thread是在哪裡和哪時被建立並且啟動的？**

由於thread是透過Scheduler控制，所以可以確定在Scheduler尚未指定前，一定沒有啟動任何新的thread，因此我們可以猜測合理的時機要不在一開始就啟動，不然就是要使用前啟動，也就是以下兩種狀況：

* 指定Scheduler時。

* Scheduler的Worker呼叫`schedule()`時。

#### 指定Scheduler時

在Android實作中，`observeOn()`一般來說都是main thread，一定是已經啟動的，所以我們用`subscribeOn()`來做範例：

```java
.subscribeOn(Schedulers.newThread())
```

```java
// In Schedulers
public static Scheduler newThread() {
  return RxJavaPlugins.onNewThreadScheduler(NEW_THREAD);
}
```

這裏直接使用了一個靜態變數NEW_THREAD，再看到與NEW_THREAD相關的程式碼：

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

我們可以看到有一個靜態的constructor，可知這邊就是整個流程起點：

* 將NewThreadTask傳給`initNewThreadScheduler()。`
* NewThreadTask的`call()`會被執行。
* 將`NewThreadHolder.Default`，即是NewThreadScheduler取出並指定給NEW_THREAD。

接著我們再看到NewThreadScheduler的constructor：

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

到此完成建立並回傳Scheduler的流程，其中沒有任何啟動thread的機制。代表在指定Scheduler的同時啟動thread的假設並不成立，接著我們在看另一個假設。

#### Scheduler的Worker呼叫`schedule()`時

前面的章節可以知道，`Worker.schedule()`最後會使用ScheduledThreadPoolExecutor的`submit()`或`schedule()`：

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

不論是`submit()`或是`schedule()`都會走到`delayedExecute()`。接著，在正常的情況下會走到`ensurePrestart()`：

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
從`ensurePrestart()`走到`addWorker()`，然後看到一個ThreadPoolExecutor內部類別Worker，其建構式用到ThreadFactory呼叫`newThread()`。

根據前面的內容可以知道，NewThreadScheduler透過`createWorker()`建立NewThreadWorker時，會傳入靜態變數THREAD_FACTORY，同時也是RxThreadFactory。

此ThreadFactory會再ScheduledThreadPoolExecutor。因此，呼叫`getThreadFactory().newTherad()`，就是`RxThreadFactory.newThread()`：

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

**在這我們終於看到Thread被建立**，用的是Thread的constructor：

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

Thread的constructor內只有設定一些相關的值，並透過ThreadGroup呼叫`addUnstarted()`，根據`addUnstarted()`的comment，裡面只是用於通知ThreadGroup有新的Thread要加入，但還不會改變已執行中的Thread列表。

回到`addWorker()`，最後用傳回的Thread呼叫`start()`：

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

在這就透過ThreadGroup的`add()`先通知剛加入的Thread即將啟動，並將其加入已啟動的Thread列表。然後透過底層來執行Thread的`run()`，**到這邊thread算是正式被啟用**：

```java
// In Thread
public void run() {
  if (target != null) {
    target.run();
  }
}
```

此時的`run()`就是已經在新的Thread上執行。

這邊的target，是在Thread建立時傳入的一個外部Runnable，往回可以到ThreadPoolExecutor.Worker的constructor：

```java
// In ThreadPoolExecutor.Worker
this.thread = getThreadFactory().newThread(this);
```

所以target就是Worker本身，於是再看到Worker的`run()`：

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

繞了一大圈，在這邊我們看到task被執行的部分，這task就是我們在透過Scheduler呼叫`scheduleDirect()`時傳入的DisposeTask。

到此我們終於確定Scheduler所控制的Thread的建立和啟動的時機，最後來總結整個啟動的過程如下：

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


