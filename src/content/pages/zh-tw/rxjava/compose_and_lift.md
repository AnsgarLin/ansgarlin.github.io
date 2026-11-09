---
title: "compose() & lift()"
updated: "2019-04-04"
---

在使用RxJava實作的過程中，會經常遇到以下兩個情形：

* 相同的operator組合重複出現
* 相同的資料操作邏輯重複出現

剛好RxJava本身也有提供自訂operator的方式，對應上面情形如下：

* compose()
* lift()

以下將舉例介紹別分析其原理。

### compose()

在官方介紹中，其被定義為[Transformation Operator](https://github.com/ReactiveX/RxJava/wiki/Implementing-Your-Own-Operators#transformational-operators)，用來將多個operator封裝。以下引用[Don't break the chain: use RxJava's compose() operator](http://blog.danlew.net/2015/03/02/dont-break-the-chain/)中使用的範例。

試想在使用RxJava時，最終都得使用`observeOn()`和`subscribeOn()`。如果將這兩個operator封裝，並大量複用的話會變成如下：

```Java
<T> Observable<T> applySchedulers(Observable<T> observable) {  
    return observable.subscribeOn(Schedulers.io())
        .observeOn(AndroidSchedulers.mainThread());
}

applySchedulers(Observable.from(someSource).map(data -> manipulate(data)))
    .subscribe(data -> doSomething(data));
```

可以看得出來這完全打破RxJava可以串連operator的好處。

透過`compose()`我們可以將`applySchedulers()`修改如下：

```Java
private <T> ObservableTransformer<T, T> applySchedulers() {
    return new ObservableTransformer<T, T>() {
        @Override
        public ObservableSource<T> apply(Observable<T> upstream) {
            return upstream.subscribeOn(Schedulers.io())
                .observeOn(AndroidSchedulers.mainThread());
        }
    };
}
```

如此就可以不打破鏈結，達到使用`observeOn()`和`subscribeOn()`的目的：

```Java
Observable.from(someSource)  
    .map(data -> manipulate(data))
    .compose(applySchedulers())
    .subscribe(data -> doSomething(data));
```

> 如果是用JDK 7或更舊的版本編譯，需要改成`this.<Type>applySchedulers()`。

且`applySchedulers()`本身並不依賴任何外部的參數，可以被重複使用在各個情境內。

#### How

接著來看`compose()`是如何實作來達到接續串聯的效果，首先看到原始碼內容：

```Java
// In Observable
public final <R> Observable<R> compose(ObservableTransformer<? super T, ? extends R> composer) {
    return wrap(((ObservableTransformer<T, R>) ObjectHelper.requireNonNull(composer, "composer is null")).apply(this));
}
```

意外的沒做很多事情，只是透過傳入的composer轉換成ObservableTransformer後執行`apply()`，接著再看到ObservableTransformer： 

```Java
// In ObservableTransformer
/**
 * Applies a function to the upstream Observable and returns an ObservableSource with
 * optionally different element type.
 * @param upstream the upstream Observable instance
 * @return the transformed ObservableSource instance
 */
@NonNull
ObservableSource<Downstream> apply(@NonNull Observable<Upstream> upstream);
```

由註解就很明顯地說出`apply()`的用途：承先啟後，將上游的Observable處理後，再傳出一個Observable，才能將鏈結延續下去。

綜合前面的分析，如果要使用`compose()`，必須要有以下幾個條件：

* **繼承ObservableTransformer，並實作`apply()`**
* **不論`apply()`內容為何，必須要回傳Observable。**
* **必須要使用傳入的Observable作為起點向下串連。**

#### What's more

`compose()`畢竟只是固定的operator組合，通常不需要重複建立新的ObservableTransformer，所以範例中ObservableTransformer的部分可以抽出如下：

```Java
final ObservableTransformer schedules = new ObservableTransformer() {
    @Override
    public ObservableSource apply(Observable upstream) {
        return upstream.subscribeOn(Schedulers.io())
            .observeOn(AndroidSchedulers.mainThread());
    }
};
```

如此我們就有一個可以一直複用的ObservableTransformer，最後再把`applySchedulers()`修改：

```Java
private <T> ObservableTransformer<T, T> applySchedulers() {
    return schedules;
}
```

>  此函式看起來有些多餘，但如此可避免直接使用`schedules`時，還要指定型態，如果型態名稱複雜則會降低整體可讀性。

### lift()

在官方介紹中，其被定義為[Sequence Operators](https://github.com/ReactiveX/RxJava/wiki/Implementing-Your-Own-Operators#sequence-operators)，用在資料流的操作。以下我們用[Switch-case and If-else blocks in Rx-Java streams](https://www.linkedin.com/pulse/switch-case-if-else-blocks-rx-java-streams-ahmed-adel/)當作範例來說明。

試想我們有一個資料流，然後要針對不同類型的資料做對應的操作，則勢必會在operator內使用switch-case或是if-else的方式作分流：

```Java
Observable.fromIterable(list)
    .flatMap(integer -> {
        switch (integer) {
            case 1: return Observable.just("First Odd Number : " + integer);
            case 2: return Observable.just("First Even Number : " + integer);
            default: return Observable.empty();
        }
    }).subscribe(System.out::println);
```

類似的操作可能會在不同的operator鏈結中出現，於是可以用`lift()`將switch-case包裝成一個通用型的observer：

```Java
caseBlocks.put(1, (integer) -> "First Odd Number : " + integer);
caseBlocks.put(2, (integer) -> "First Even Number : " + integer);
Observable.fromIterable(list)
        .lift(new SwitchCaseBreak<>(caseBlocks))
        .subscribe(System.out::println);
```

如此就可以將定義操作和oprator鏈結拆開，保持了整串鏈結的可讀性。同時，由於判斷條件和對應操作已從switch-case分離，使得構成switch-case的元件都可以個別被定義，然後彈性的在不同的情境中複用。

#### How

接著來看`lift()`是如何實作來包裝操作邏輯，首先看到原始碼內容：

```java
// In Observable
public final <R> Observable<R> lift(ObservableOperator<? extends R, ? super T> lifter) {
    ObjectHelper.requireNonNull(lifter, "onLift is null");
    return RxJavaPlugins.onAssembly(new ObservableLift<R, T>(this, lifter));
}
```

用了ObservableLift來包裝傳入的lifter：

```Java
// In ObservableLift
public final class ObservableLift<R, T> extends AbstractObservableWithUpstream<T, R> {
	/** The actual operator. */
	final ObservableOperator<? extends R, ? super T> operator;
    
    public ObservableLift(ObservableSource<T> source, ObservableOperator<? extends R, ? super T> operator) {
        super(source);
        this.operator = operator;
    }

    @Override
    public void subscribeActual(Observer<? super R> s) {
        Observer<? super T> observer;
        try {
            observer = ObjectHelper.requireNonNull(operator.apply(s), "Operator " + operator + " returned a null Observer");
        } 
        ...
        source.subscribe(observer);
    }
}
```

一般來說，`subscribeActual()`的內容只有一行，用來將上下游的Observer串連，如ObservableMap：

```Java
// In ObservableMap
@Override
public void subscribeActual(Observer<? super U> t) {
    source.subscribe(new MapObserver<T, U>(t, function));
}
```

> 如尚未熟悉Operator之間串連的原理，可以參閱基本概念章節。

而ObservableLift內多出來的部分，則是用傳入的operator來呼叫`apply()`，並傳入下游的Observer：

```Java
// In ObservableOperator
/**
 * Applies a function to the child Observer and returns a new parent Observer.
 * @param observer the child Observer instance
 * @return the parent Observer instance
 * @throws Exception on failure
 */
@NonNull
Observer<? super Upstream> apply(@NonNull Observer<? super Downstream> observer) throws Exception;
```

由註解可以知道，就是將下游的Observer再做一層打包，產生新的Observer。

實作`apply()`的方式就是：

* 建立新的Observer

* 並實作其中`onNext()`等含式

如此就能在資料流在往下傳之前，進行一些額外的操作，簡單示意如下：

```Java
.lift(new ObservableOperator<Object, String>() {
    @Override
    public Observer<? super String> apply(final Observer<? super Object> observer) throws Exception {
        return new Observer<List<UIModel>>() {
            ...
            @Override
            public void onNext(List<UIModel> uiModels) {
                // Some implement
                observer.onNext();
            }
            ...
        }
    }
}
```

綜合前面的分析，如果要使用`lift()`，必須要有以下幾個條件：

- **繼承ObservableOperator，並實作`apply()`**
- **不論`apply()`內容為何，必須要回傳Observer。**
- **如在`apply()`內新增自訂的Observer，必須要在各函示最後使用傳入的Observer呼叫對應的函示，如`onNext()`。**

