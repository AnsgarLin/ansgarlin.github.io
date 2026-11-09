---
title: "Error Handle"
updated: "2019-04-04"
---

RxJava在資料傳遞上給予很大的彈性，但彈性代表在錯誤發生時，影響的層面可能就不僅止於當前的片段。以下將集合一些RxJava處理錯誤的心得。

### Get readable stacktrace

對於RxJava的使用者來說，最頭痛的問題不一定是如何使用，而是當遇到異常中斷時，我們得到的stacktrace：

```Java
Process: com.example.background, PID: 12895
    xxx.OnErrorNotImplementedException: The mapper function returned a null value.
    ...
    Caused by: java.lang.NullPointerException: The mapper function returned a null value.
        at xxx.functions.ObjectHelper.requireNonNull(ObjectHelper.java:39)
        at xxx.ObservableMap$MapObserver.onNext(ObservableMap.java:59)
        at xxx.ObservableScalarXMap$ScalarDisposable.run(ObservableScalarXMap.java:248) 
        at xxx.ObservableJust.subscribeActual(ObservableJust.java:35) 
        at xxx.subscribe(Observable.java:12036) 
        at xxx.ObservableMap.subscribeActual(ObservableMap.java:33) 
        at xxx.subscribe(Observable.java:12036) 
        at xxx.ObservableSubscribeOn$SubscribeTask.run(ObservableSubscribeOn.java:96) 
        at xxx.Scheduler$DisposeTask.run(Scheduler.java:579) 
        at xxx.ScheduledRunnable.run(ScheduledRunnable.java:66) 
        at xxx.ScheduledRunnable.call(ScheduledRunnable.java:57)
        ...
```

完全都是RxJava的內容，跟專案內的程式碼完全無關。而且以上錯誤是由短短的RxJava應用產生：

```Java
Observable.just("A string")
    .map(s -> null)
    .subscribeOn(Schedulers.io())
    .observeOn(AndroidSchedulers.mainThread())
    .subscribe();
```

一個由map回傳null導致的NullException，但得到的錯誤訊息幾乎無法判定在專案內的位置。唯一的方法只有用錯誤訊息的函示使用順序，來得到函示串連的模式，並依此來找從專案內符合的片段。如果這是一個很複雜的應用，那就是一場災難。

RxJava 1.x有`RxJavaHooks.enableAssemblyTracking()`可以解決這樣的問題。不過在2.x後，這樣的功能已經被移出RxJava的核心，並放到另一個衍生的library，[RxJava2Extensions](https://github.com/akarnokd/RxJava2Extensions#debug-support)。

#### Usage

使用上很簡單，只要幾個步驟：

* 在`gradle.build`加入`implementation "com.github.akarnokd:rxjava2-extensions:0.19.5"`。
* 在任何地方，最好是使用RxJava前，加入`RxJavaAssemblyTracking.enable()`。
* 在`onError()`內加入`RxJavaAssemblyException assembled = RxJavaAssemblyException.find(e)`。

在`RxJavaAssemblyTracking`是enable的狀況下，`assembled`應該不會是null，所以就可以透過得到與專案相關的stacktrace：

```
RxJavaAssemblyException: assembled
        at dalvik.system.VMStack.getThreadStackTrace(Native Method)
        at xxx.map(Observable.java:9549)
        at xxx.SelectImageActivity.lambdaonCreate1(SelectImageActivity.java:78)
        at xxx.-$$Lambda$SelectImageActivity$6QwW2Bjb6qceOpZ0ubznbd9RX3c.onClick(lambda)
        ...
```

