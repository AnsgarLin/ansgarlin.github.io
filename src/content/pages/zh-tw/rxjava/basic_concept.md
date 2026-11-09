---
title: "基本概念"
updated: "2019-04-04"
---

此篇為本系列的第一篇，用於建立一些基本概念，其餘operator會獨立在不同篇章介紹。

一般來說，一個完整的RxJava chain會由以下幾種operator組成：

* 建立源頭的：`create()`
* 決定送出資料的thread：`subscribeOn()`
* 決定operator執行時的thread：`observeOn()`
* 訂閱Observable：`subscribe()`

注意以上種類所含的operator可能不只一種，這邊為了簡化問題只列出最主要。

由上述的operator，我們可以給出一個簡單的例子如下：

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

整個流程不難理解，就是用`create()`建立一個資料源，然後在新的thread上送出一個數字0，然後在Android的main thread接收。

接著我們先從operator互相串接的過程開始介紹。

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

進去`create()`後如下：

```java
// In Observable
public static <T> Observable<T> create(ObservableOnSubscribe<T> source) {
  return RxJavaPlugins.onAssembly(new ObservableCreate<T>(source));
}
```

接收的ObservableOnSubscribe就是我們建立的，然後將其傳入ObservableCreate。

```java
// In ObservableCreate
public ObservableCreate(ObservableOnSubscribe<T> source) {
  this.source = source;
}
```

傳進去後沒做特別的事情，就是把ObservableOnSubscribe包進去ObservableCreate。

#### SubscribeOn()

```java
.subscribeOn(Schedulers.newThread())
```

從前面可知`create()`會回傳一個ObservableCreate，因此這邊也可以表示如下：

```java
ObservableCreate.subscribeOn(Schedulers.newThread())
```

接著看進去`subscribeOn()`：

```java
// In Observable
public final Observable<T> subscribeOn(Scheduler scheduler) {
  return RxJavaPlugins.onAssembly(new ObservableSubscribeOn<T>(this, scheduler));
}
```

包進去ObservableSubscribeOn的除了Scheduler還有this。由前述的程式碼可知道this就是ObservableCreate。

```java
// In ObservableSubscribeOn
public ObservableSubscribeOn(ObservableSource<T> source, Scheduler scheduler) {
  super(source);
  this.scheduler = scheduler;
}
```

綜合ObservableCreate的constructor，在這可以建立第一個觀念：

* **任何Observable的constructor，都是將上游的Observable包起來。**

#### ObservableOn()

```java
.observeOn(AndroidSchedulers.mainThread())
```

看進去`observeOn()`：

```java
// In Observable
public final Observable<T> observeOn(Scheduler scheduler, boolean delayError) {
  return observeOn(scheduler, delayError, bufferSize());
}

public final Observable<T> observeOn(Scheduler scheduler, boolean delayError, int bufferSize) {
  return RxJavaPlugins.onAssembly(new ObservableObserveOn<T>(this, scheduler, delayError, bufferSize));
}
```

由前面介紹可知最後會得到一個ObservableObserveOn，其中包含著代表Android main thread的Scheduler和上游的Observable，也就是ObservableSubscribeOn。

到此完成operator的串接，由於Observable在串接過程中是一層包一層，所以最後得到的ObservableObserveOn可以用以下的結構表示：

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

看進去`subscribe()`：

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

在外部定義的Consumer，傳入後被包進去LambdaObserver，再傳入`subscribeActual()`。Observable的`subscribeActual()`需要被子類實作，推斷這裡的`subscribeActual()`是ObservableObserveOn的：

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

>  *Worker部分跟thread的操作有關，將在其獨立的篇章介紹。*

藉由前章最後的結構圖，可以推斷這裡的source是ObservableSubscribeOn。所以我們在這將前面得到的LambdaObserver包進去ObserveOnObserver。

綜合Observer的constructor，這有第二個觀念：

* **任何Observer的constructor，都是將下游的Observer包起來。**

ObservableSubscribeOn並沒有實作`subscribe()`，所以回到父類Observable的`subscribe()`，再走回ObservableSubscribeOn的`subscribeActual()`。

接著是第三個觀念：

* **任何Observable的`subscribe()`都會走回自己的`subscribeActual()`。**

接著看到ObservableSubscribeOn的`subscribeActual()`：

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

> *Scheduler在這邊進行thread切換的原理可查看[Thread控制](thread_control.html)。*

上游的ObserveOnObserver包進去SubscribeOnObserver，接著放入SubscribeTask並透過Scheduler執行。

到這邊，應可知道source就是ObservableCreate，而`subscribe()`會帶到ObservableCreate的`subscriberActual()`：

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

這邊的source就是ObservableOnSubscribe，也就是我們一開始宣告給`create()`的：

```java
new ObservableOnSubscribe<Integer>() {
  @Override
  public void subscribe(ObservableEmitter<Integer> e) throws Exception {
    e.onNext(0);
  }
}
```

和Observable一樣，Observer也是層層包裝。所以拿來呼叫`onNext()`的ObservableEmitter，也就是CreateEmitter的結構如下：

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

接續上個章節最後一段程式碼，我們用ObservableEmitter，也就是CreateEmitter呼叫`onNext()`：

```Java
// In CreateEmitter
public void onNext(T t) {
  ...
  observer.onNext(t);
  ...
}
```

對照上個章節最後的結構，可以知道這個Observer就是SubscribeOnObserver：

```java
// In SubscribeOnObserver
public void onNext(T t) {
  actual.onNext(t);
}
```

沒做什麼事情，直接將資料傳遞到下游的Observer，也就是ObserveOnObserver：

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

最後執行到`a.onNext()`，這邊的a等於actual，也就是LambdaObserver：

```java
// In LambdaObserver
public void onNext(T t) {
  ...
  onNext.accept(t);
  ...
}
```

這邊的`onNext()`就是我們宣告的Consumer：

```java
new Consumer<String>() {
  @Override 
  public void accept(String s) throws Exception { }
}
```

最後的第四個觀念：

* **資料傳遞的方式是從上到下**。

### Conclusion

整合目前所建立的觀念如下：

* **任何Observable的constructor，都是將上游的Observable包起來**。
* **任何Observer的constructor，都是將下游的Observer包起來。**
* **任何Observable的`subscribe()`都會走回自己的`subscribeActual()`**。
* **資料傳遞的方式是從上到下**。

這些觀念是之後在分析operator時，可用來避免被source或actual之類會不斷重複的字眼所搗亂，如此可以專注在operator的邏輯的不同之處。

