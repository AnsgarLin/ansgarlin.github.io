---
title: "Basic Concept"
updated: "2019-04-04"
---

This is the first article in the series and only use for introducing the basic concepts. The operators will be introduced in individual articles.

Generally, a whole RxJava chain will be composite in the following operators:

* Create the data source: `create()`
* Decide which thread to send data: `subscribeOn()`
* Decide which thread to execute the operators: `observeOn()`
* Subscribe Observable: `subscribe()`

There may be more operators in one kind, here we only focus on the main one.

By using the above operators, we can give a simple sample like below:

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

The whole process is using `create()` to create a data source, sending an Integer on a new thread and accepting the number in the Android main thread.

Now that's beginning from introducing the process of connecting operators.

### Connect with each other

#### Create()

```java
.create(new ObservableOnSubscribe<Integer>() {
  @Override
  public void subscribe(ObservableEmitter<Integer> e) throws Exception {
    e.onNext(0);
  }
})
```

In `create()`:

```java
// In Observable
public static <T> Observable<T> create(ObservableOnSubscribe<T> source) {
  return RxJavaPlugins.onAssembly(new ObservableCreate<T>(source));
}
```

The ObservableOnSubscribe is the one we new, then pass it into ObservableCreate.

```java
// In ObservableCreate
public ObservableCreate(ObservableOnSubscribe<T> source) {
  this.source = source;
}
```

Nothing special in the constructor, just wrap the ObservableOnSubscribe into the ObservableCreate.

#### SubscribeOn()

```java
.subscribeOn(Schedulers.newThread())
```

From the chapter above, we know that create()` will return an ObservableCreate, so we can change the code like below:

```java
ObservableCreate.subscribeOn(Schedulers.newThread())
```

In the `subscribeOn()`:

```java
// In Observable
public final Observable<T> subscribeOn(Scheduler scheduler) {
  return RxJavaPlugins.onAssembly(new ObservableSubscribeOn<T>(this, scheduler));
}
```

Not only the Scheduler but also "this" is wrapped into ObservableSubscribeOn, and base on the previous code we can tell the "this" is ObservableCreate.

```java
// In ObservableSubscribeOn
public ObservableSubscribeOn(ObservableSource<T> source, Scheduler scheduler) {
  super(source);
  this.scheduler = scheduler;
}
```

So here we can give our first concept:

* **Every Observable's constructor is to wrap the upstream Observable.**

#### ObservableOn()

```java
.observeOn(AndroidSchedulers.mainThread())
```

In `observeOn()`:

```java
// In Observable
public final Observable<T> observeOn(Scheduler scheduler, boolean delayError) {
  return observeOn(scheduler, delayError, bufferSize());
}

public final Observable<T> observeOn(Scheduler scheduler, boolean delayError, int bufferSize) {
  return RxJavaPlugins.onAssembly(new ObservableObserveOn<T>(this, scheduler, delayError, bufferSize));
}
```

From the previous introduce we know that we can get an ObservableObserveOn, which include the Schedule of the Android main thread and the Observable, ObservableSubscribeOn, from the upstream.

Here we finish the process of connecting operators. Because Observable will be wrapped one by one during the process, so we can show the architecture of the ObservableObserveOn like below:

```java
ObservableObserveOn {
  source = ObservableSubscribeOn {
    source = ObservableCreate {
      source = ObservableOnSubscribe
    }
  }
}
```

### Subscribe to Observable

#### subscribe()

```java
.subscribe(new Consumer<String>() {
  @Override 
  public void accept(String s) throws Exception { }
});
```

In `subscribe()`:

```java
// In Observable
public final Disposable subscribe(Consumer<? super T> onNext) {
  return subscribe(onNext, Functions.ON_ERROR_MISSING, Functions.EMPTY_ACTION, Functions.emptyConsumer());
}

public final Disposable subscribe(Consumer<? super T> onNext, Consumer<? super Throwable> onError, Action onComplete, Consumer<? super Disposable> onSubscribe) {
  LambdaObserver<T> ls = new LambdaObserver<T>(onNext, onError, onComplete, onSubscribe);
  subscribe(ls);
  return ls;
}

public final void subscribe(Observer<? super T> observer) {
  ...
  observer = RxJavaPlugins.onSubscribe(this, observer);
  subscribeActual(observer); 
  ...
}

protected abstract void subscribeActual(Observer<? super T> observer);
```

The Consumer will be wrapped into the LambdaObserver, then passed into `subscribeActual()`. Because the `subscribeActual()` of the Observable needs to be implemented by the sub-class, we can figure out that the `subscribeActual()` here is belong to the ObservableObserveOn:

```java
// In ObservableObserveOn
protected void subscribeActual(Observer<? super T> observer) {
  if (scheduler instanceof TrampolineScheduler) {
    source.subscribe(observer);
  } else {
    Scheduler.Worker w = scheduler.createWorker();
    source.subscribe(new ObserveOnObserver<T>(observer, w, delayError, bufferSize));
  }
}
```

>  *The Worker is about the thread control, which will be introduced in the independent chapter.*

According to the architecture at the end of the previous chapter, the "source" here is  ObservableSubscribeOn. And the LambdaObserver will be wrapped into the ObserveOnObserver.

Here we have the second concept:

* **Every Observer's constructor is to wrap the downstream Observer.**

ObservableSubscribeOn doesn't implement `subscribe()`, so it calls the `subscribe()` of the Observable. And back to the `subscribeActual()` of the ObservableSubscribeOn.

Here comes the third concept:

* **Every Observable's `subscribe()` will go back to its own `subscribeActual()`.**

Then look into the `subscribeActual()` of the ObservableSubscribeOn:

```java
// In ObservableSubscribeOn
public void subscribeActual(final Observer<? super T> s) {
  final SubscribeOnObserver<T> parent = new SubscribeOnObserver<T>(s);
  s.onSubscribe(parent);
  parent.setDisposable(scheduler.scheduleDirect(new SubscribeTask(parent)));
}

final class SubscribeTask implements Runnable {
  private final SubscribeOnObserver<T> parent;
  SubscribeTask(SubscribeOnObserver<T> parent) {
    this.parent = parent;
  }

  @Override
  public void run() {
    source.subscribe(parent);
  }
}
```

>  *In [Thread Control](thread_control.html), we will introduce how a scheduler controls the thread.*

Here we wrap the ObserveOnObserver from the upstream into the SubscribeOnObserver, then pass it into the SubscribeTask and executes by the Scheduler.

We know that the "source" here is the ObservableCreate, and the `subscribe()` will take us to the `subscriberActual()` of the ObservableCreate:

```java
// In ObservableCreate
protected void subscribeActual(Observer<? super T> observer) {
  CreateEmitter<T> parent = new CreateEmitter<T>(observer);
  observer.onSubscribe(parent);
  ...
  source.subscribe(parent);
  ...
}
```

The "source" here is the ObservableOnSubscribe, which we initialize and pass to `create()`:

```java
new ObservableOnSubscribe<Integer>() {
  @Override
  public void subscribe(ObservableEmitter<Integer> e) throws Exception {
    e.onNext(0);
  }
}
```

Like Observable, the Observers are wrapped one by one. Hense the architecture of the ObservableEmitter, which is the CreateEmitter, will like below:

```java
CreateEmitter {
  SubscribeOnObserver {
    actual = ObserveOnObserver {
      actual = LambdaObserver {
        onNext = Consumer
      }
    }
  }
}
```

### Send data

Continue the code of the previous chapter, we use CreateEmitter to call  `onNext()`:

```Java
// In CreateEmitter
public void onNext(T t) {
  ...
  observer.onNext(t);
  ...
}
```

Reflect the architecture form the previous chapter, we know the Observer is the SubscribeOnObserver:

```java
// In SubscribeOnObserver
public void onNext(T t) {
  actual.onNext(t);
}
```

Nothing special, just passing the data to the downstream Observer, which is the ObserveOnObserver:

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

void drainNormal() {
  ...
  final Observer<? super T> a = actual;
  ...
  a.onNext(v);
  ...
}
```

At `a.onNext()`, the "a" here is actual, which is the LambdaObserver:

```java
// In LambdaObserver
public void onNext(T t) {
  ...
  onNext.accept(t);
  ...
}
```

The final `onNext()` will be the Consumer that we initialize:

```java
new Consumer<String>() {
  @Override 
  public void accept(String s) throws Exception { }
}
```

The fourth concept will be:

* **The direction of data passing is from top to bottom.**

### Conclusion

That's summerize the concepts we mention below:

* **Every Observable's constructor is to wrap the upstream Observable.**
* **Every Observer's constructor is to wrap the downstream Observer.**
* **Every Observable's `subscribe()` will go back to its own `subscribeActual()`.**
* **The direction of data passing is from top to bottom.**

These concepts are used to prevent us from being confused by repeating words like 'source' and 'actual'. So that we can focus on the differences of the operators' logic.