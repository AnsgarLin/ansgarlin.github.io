---
title: "groupBy()"
updated: "2019-04-04"
---

依照[官方文件](http://reactivex.io/documentation/operators/groupby.html)的介紹，其用於將上游的資料，依照給與的分類函示做判斷後，個別建立不同的Observable送出。

### Usage

使用時必須要給予一個判斷用的函示：

```Java
Observable.fromIterable(list).groupBy(new Function<Object, Integer>() {                    
    @Override
    public Integer apply(Object object) throws Exception {
        return object.hashCode();
    }
}).subscribe(new Consumer<GroupedObservable<Integer, Object>>() {
    @Override
    public void accept(GroupedObservable<Integer, Object> integerObjectGroupedObservable) throws Exception {
        // Do something
    }
});
```

- 每一次`groupBy()`從上游取得Object。
- 判斷其hashCode。
- 並用hashCode當作Key來建立新的GroupedObservable。

透過`getKey()`，GroupedObservable可以知道其所對應的key值。

### How

接著來看其運作原理，首先看到最基礎的`groupBy()`：

```Java
// In Observable
public final <K> Observable<GroupedObservable<K, T>> groupBy(Function<? super T, ? extends K> keySelector) {
    return groupBy(keySelector, (Function)Functions.identity(), false, bufferSize());
}

public final <K, V> Observable<GroupedObservable<K, V>> groupBy(Function<? super T, ? extends K> keySelector, Function<? super T, ? extends V> valueSelector, boolean delayError, int bufferSize) {
    ...
    return RxJavaPlugins.onAssembly(new ObservableGroupBy<T, K, V>(this, keySelector, valueSelector, bufferSize, delayError));
}
```

最後與下游Observable連結的是一個ObservableGroupBy：

```Java
// In ObservableGroupBy
public ObservableGroupBy(ObservableSource<T> source, Function<? super T, ? extends K> keySelector, Function<? super T, ? extends V> valueSelector, int bufferSize, boolean delayError) {
    super(source);
    this.keySelector = keySelector;
    ...
}

@Override
public void subscribeActual(Observer<? super GroupedObservable<K, V>> t) { source.subscribe(new GroupByObserver<T, K, V>(t, keySelector, valueSelector, bufferSize, delayError));
}
```

其他參數並不是必要，所以這邊不詳細解讀。在這所看到的外部變數`keySelector`，就是我們前面提到，用來將上游資料分類的函式。

然後在subscribe階段，此函式又被包裝進了GroupByObserver，在其中有一內部變數groups，用來存放key和其對應的GroupedObservable。

接著在收到上游資料時走到`onNext()`：

```Java
// In ObservableGroupBy.GroupByObserver
final Map<Object, GroupedUnicast<K, V>> groups;

@Override
public void onNext(T t) {
    K key;
    try {
        key = keySelector.apply(t);
    } catch (Throwable e) {
        ...
    }

    Object mapKey = key != null ? key : NULL_KEY;
    GroupedUnicast<K, V> group = groups.get(mapKey);
    if (group == null) {
        ...
        group = GroupedUnicast.createWith(key, bufferSize, this, delayError);
        groups.put(mapKey, group);
        ...
        actual.onNext(group);
    }

    V v;
    try {
        v = ObjectHelper.requireNonNull(valueSelector.apply(t), "The value supplied is null");
    } catch (Throwable e) {
        ...
    }

    group.onNext(v);
}
```

這邊依照順序有以下幾個步驟：

* 透過keySelector取得key。
* 查看groups是否已經有相對應的GroupedUnicast。沒有的話會建立一個，然後先將新的GroupedUnicast往下游送出。所以我們在下游Observer收到的GroupedObservable其實就是GroupedUnicast。
* 透過valueSelector判斷當前資料是否需要，預設的valueSelector會直接回傳相同的資料。
* 最後用GroupedUnicast送出資料。

如此就達到將資料分流送出的目的。

最後來看一下GroupedUnicast，這是ObservableGroupBy的內部類：

```Java
// In ObservableGroupBy
static final class GroupedUnicast<K, T> extends GroupedObservable<K, T> {
    final State<T, K> state;
    
    public static <T, K> GroupedUnicast<K, T> createWith(K key, int bufferSize, GroupByObserver<?, K, T> parent, boolean delayError) {
        State<T, K> state = new State<T, K>(bufferSize, parent, key, delayError);
        return new GroupedUnicast<K, T>(key, state);
    }

    protected GroupedUnicast(K key, State<T, K> state) {
        super(key);
        this.state = state;
    }
    ...
    public void onNext(T t) {
        state.onNext(t);
    }
    ...
}
```

GroupedUnicast本身也是Observable，GroupedObservable，所以下游Observer接到後可以與其他Observable串連。

而key也會被存起來，所以下游才可取得對應的key：

```Java
// In GroupedObservable
public abstract class GroupedObservable<K, T> extends Observable<T> {
    final K key;
    protected GroupedObservable(@Nullable K key) {
        this.key = key;
    }
}
```

在資料流進來時，GroupedUnicast是傳給State處理，這邊我們僅列出`onNext()`部分：

```Java
// In ObservableGroupBy
static final class State<T, K> extends AtomicInteger implements Disposable, ObservableSource<T> {
    public void onNext(T t) {
        queue.offer(t);
        drain();
    }
        
    void drain() {
        ...
        Observer<? super T> a = actual.get();
        for (;;) {
            if (a != null) {
                for (;;) {
                    boolean d = done;
                    T v = q.poll();
                    boolean empty = v == null;
                    ...
                    if (empty) {
                        break;
                    }
                    a.onNext(v);
                }
            }
            ...
        }
    }
}
```

首先State會將資料放入一佇列，然後用無限迴圈一個個取出往下游傳送。

### What's more

#### Use with take() 

有時我們會限制每一個分流所需取用的上限，於是我們會在取得的GroupedObservable，也就是GroupedUnicast後接上`take()`，此時要注意一個現象：

* **`take()`會在達到指定條件後，主動關閉上游Observable，這會促使GroupedUnicast從GroupByObserver的groups中移除。如此下一次收到相同key時，GroupByObserver會再建立新的GroupedObservable。**

舉例如下：

```Java
Observable.fromIterable(new ArrayList<Integer>(9)).groupBy(new Function<Integer, Boolean>() {                    
    @Override
    public Boolean apply(Integer integer) throws Exception {
        return integer.isOdd();
    }
}).flatMap(new Function<GroupedObservable<Boolean, Integer>, ObservableSource<Integer>>() {
    int groupIdx = 0;
    @Override
    public ObservableSource<Integer> apply(GroupedObservable<Boolean, Integer> integerObjectGroupedObservable) throws Exception {
        Log.d("GroupByTest", "GroupedObservable " + groupIdx + " is created");
        groupIdx++;
        return integerRecentBrowsedClusterGroupedObservable.take(3);
    }
})
```

假設來源總共會有9個整數，而預期會依照基偶數被分流成2個GroupedObservable，但我們每個分流只取3個，則預期印出的結果如下：

```Java
D/GroupByTest: GroupedObservable 0 is created
D/GroupByTest: GroupedObservable 1 is created
```

但其實結果會如下：

```Java
D/GroupByTest: GroupedObservable 0 is created
D/GroupByTest: GroupedObservable 1 is created
D/GroupByTest: GroupedObservable 2 is created
```

##### How

首先看到我們傳下去的GroupedUnicast在subscribe階段時，會走到`GroupedUnicast.subscribeActual()`：

```Java
// In ObservableGroupBy.GroupedUnicast
@Override
protected void subscribeActual(Observer<? super T> observer) {
    state.subscribe(observer);
}
```

這邊的observer，就是下游傳上來的TakeObserver，再看到`State.subscribe()`：

```Java
// In ObservableGroupBy.State
@Override
public void subscribe(Observer<? super T> s) {
    ...
    s.onSubscribe(this);
    ...
}
```

State將自己又傳給了TakeObserver：

```Java
// In ObservableTake.TakeObserver
@Override
public void onSubscribe(Disposable s) {
    ...
    subscription = s;
    ...
}
```

TakeObserver將其存成subscription，而後當達到數量上限時，會執行`onComplete()`：

```Java
// In ObservableTake.TakeObserver
@Override
public void onComplete() {
    ...
    subscription.dispose();
    ...
}
```

於是又走回到了State：

```Java
// In ObservableGroupBy.State
@Override
public void dispose() {
    if (cancelled.compareAndSet(false, true)) {
        ...
        parent.cancel(key);
    }
}
```

這個parent直接看原始碼可知就是GroupByObserver：

```Java
// In ObservableGroupBy.GroupByObserver
public void cancel(K key) {
    Object mapKey = key != null ? key : NULL_KEY;
    groups.remove(mapKey);
    ...
}
```

到此GroupByObserver派生出來的GroupedUnicast在`take()`的條件滿足後，被主動從佇列中移除。如此下次同一個key再出現時，GroupByObserver將無法找到對應的GroupedUnicast，於是就會新增一個。