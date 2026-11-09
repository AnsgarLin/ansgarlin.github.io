---
title: "Overview"
updated: "2019-04-04"
---
[official_observable]: http://reactivex.io/documentation/observable.html
[official_single]: http://reactivex.io/documentation/single.html
[official_subject]: http://reactivex.io/documentation/subject.html
[official_schedule]: http://reactivex.io/documentation/scheduler.html
[official_tutorial]: http://reactivex.io/tutorials.html
[official_operator]: http://reactivex.io/documentation/operators.html
[wiki_reactive_programming]: https://en.wikipedia.org/wiki/Reactive_programming
[wiki_functional_programming]: https://en.wikipedia.org/wiki/Functional_programming

### What is RxJava ?

引用官方的[文件][official_observable]內的一段話來總括：

> In ReactiveX, many instructions may execute in parallel and their results are later captured, in arbitrary order, by “Observers”.

透過ReactiveX，每一行指令將被同步執行，而執行的結果將被Observer依序取得。

> You define a mechanism for retrieving and transforming the data, in the form of an “Observable”.

而透過Observable，可以建立一套串連各種處理資料的機制。

> And subscribe an observer to it, at which point the previously-defined mechanism fires into action.

透過Observer來訂閱Observable，來將兩者串連並啟動之前所設計好的機制。

簡而言之，ReactiveX是一種反向思維，不同於一般語言的模式：透過呼叫函式取得結果、儲存結果然後對這結果進行處理；任何一個連接點皆是變數。而是由函式出發，中間不透過變數儲存結果，而且接續下一個函式，形成由一連串函式組成的處理機制。

以下章節將注重在RxJava所需的基礎概念，而非如何使用RxJava，如需要可直接至官方的[教學資源][official_tutorial]中找尋相關文章。

### Functional Reactive Programming (FRP)

在使用之前，必須要先理解兩個設計概念：Reactive Programming和Functional Programming。集合兩者，才是RxJava最後顯現出來的形式。

#### Reactive Programming

根據[Wiki][wiki_reactive_programming]的描述，Reactive Programming代表一段程式碼和結果是彼此連動的。取用wiki內的範例來說：

> a = b + c

在Imperative Programming中，a在b + c執行後就被賦予一個值，且這個值在b或c後並不會改變。而在Reactive Programming中，a的值會隨著b或c的值改變。

#### Functional Programming

根據[Wiki][wiki_functional_programming]的描述，Functional Programming代表的是將程式碼包裝成數學函式，取用前面的範例來說則變成：

> a = f ( b )

可以看到b + c被包裝成數學函式，所以a跟b的關係就變成唯一。不論執行幾次，給予相同的b則會得到相同的a。也因此避免了任何與函式內操作無關的狀況，例如：執行狀態改變、修改參數，來影響結果。

另外一特點是：函式具有first-class的特性，也就是其可以被賦值，也可以當作參數或回傳值。因此，Functional Programming大多是表達式。

總結一下，可以想像得到，FRP就是整合了兩者的特性，因此前面的範例就會變成：

> a = f ( b ) + f ( c )

a依然會跟著b或c的變化而變動，但同時一組b或c所產生的結果也是唯一的。

### How to think in RxJava ?

接著將來探討在使用RxJava時，需要使用怎樣的思維，才能組裝出合理的操作機制。但在那之前，先帶過以下幾個主要的名詞：

> Observable
> Observer
> Subscribe

#### [Observable][official_observable]

Observable代表資料源，一個可"被觀察"的對象。透過RxJava提供的各式各樣[Operator][official_operator]，可以串連各種不同的資料源，分別或共同進行各式各樣的轉換。

如果用數字來代表Observable的各種情形，可以區分成以下幾個情形：

> 0 -> 沒資料  
> 1 -> 有一筆資料  
> -1 -> 出現錯誤

#### Observer

Observer代表接收Observable資料的一方，透過RxJava提供的三大Callback：onNext()、onError()和onComplete()。可以接收Observable處理後的資料，或是在錯誤時做出反應。

#### Subscribe

在RxJava的世界中，Observable和Observer是獨立分開的。也就是就算Observable已經開始發送資料，也不一定有Observer來接收資料，例如Publisher，Observable的其中一種衍生。

但一般來說，Observable皆需要有Observer接收資料，才會開始啟動。而這中間的橋樑，就是Subscribe操作，如下：

> Observable.subscribe ( Observer )

#### The stream of data

由前面簡單帶過的內容可以得到一個結論，Observable的開始和結束是沒有個定性的；它可以透過Observer訂閱啟動，也可以自行啟動。就像水龍頭一般，管線內不論有沒有水在流淌，在沒轉開開關的那一刻，你不會知道有沒有水。與RxJava的名詞對比則如下：

> Data -> 水  
> Observable -> 水管管線  
> Observer -> 你  
> Subscriber -> "轉開"這動作

這邊很明顯表示出會比較複雜的就是水管管線，也就是Observable。

資料就像水一樣，在水管(Observable)中流動。而複雜的資料處理邏輯，就如同複雜的水管網絡。這也帶出了一個思維，必須要在使用RxJava時謹記在心：

> 你是水管工

沒錯，一個水管工，運用RxJava提供的各式水管接頭，接出符合需求的水管網絡(Rx chain)。

有了這概念後，以下提供一個範例來探討如何運用。

#### Situation

首先這邊的情境如下：

> 我們有兩個資料源，資料型態為A和B，且B接在A結束後啟動。A需要和B做整合成C。C經過處理後直接傳遞。每筆C的資料都要轉型成D，但要同時處理。

看起來很冗長，讓我們來將句子做個拆分：

> 我們有兩個資料源，資料型態為A和B，且B接在A結束後啟動。  
> A需要和B做整合成C。  
> C經過處理後直接傳遞。  
> 每筆C的資料都要轉型成D，但要同時處理。

接著去掉一些多餘的字，留下重要的訊息：

> 資料源A和B，B接在A之後  
> A和B整合成C  
> C直接傳遞   
> 每筆C轉成D，同時處理

再抽出動詞：

> 接  
> 整合  
> 傳遞  
> 轉，同時

是否清楚多了？套用前面說的思維，其實重點不在於ABCDE是什麼，而是在於整個水管網絡，何時要開？何時要合？

所以再對應到RxJava的Operator的話：

> 用於串接資料源：concat  
> 用於合併資料：zip  
> 用於傳遞資料：map  
> 用於同時傳遞資料：flatMap

以上就是對於想法上的簡單探討。

### Go into deeper

以下是一些其他與RxJava有關的元件。

#### [Single][official_single]

用法類似於Observable，不同的是Single在使用上是蘊含只會有一筆資料的含義，且一定會出現。否則代表出錯。

如果對照Observable可能發生的情況，則分成以下幾種情形：

> 1 -> 有一筆資料  
> -1 -> 出錯或沒有資料

可以看到，Single是將0的狀況引到-1，而其所對應的錯誤訊息則是`NoSuchElementException`。

#### [Subject][official_subject]

不同於Observable屬於資料源；Subject則代表的是一種接口，用來串接Observable。

做法是將Subject當成Observer來subscribe一個Observable，然後將收到的資料，再次送給另一個Observer。可以看到，當Subject將收到的資料再次送出時，意義上就變成了一個資料源，也就是Observable。

上述資料的傳遞順序如下：

> Observable -> (Observer) Subject = Subject (Observable) -> Observer

目前RxJava提供的Subject有分四種，每種都有不一樣的行為，也可以當成是一種Observable operator的封裝，簡單的對應如下：

> AsyncSubject -> doOnComplete(), doOnError()
> BehaviorSubject -> last()
> PublishSubject -> forEach()
> ReplaySubject -> replay()

其他更詳細的解釋，可以直接看官方的文件。

值得一提的是，因為Subject可以送出資料，代表也可以直接將資料給予Subject。就像是在水管上鑿個洞，而你可以直接從洞口將水倒入。

簡單的表示方法如下：

```Java
Subject subject = new Subject()  
subject.onNext(data)
```

如此Subject之後接的Observable就會接到資料，詳細用法可以看官方電子書的[Subject](http://www.introtorx.com/Content/v1.0.10621.0/02_KeyTypes.html#Subject)章節。

#### [Scheduler][official_schedule]

透過Scheduler，RxJava可以控制你Observable的operator要在哪個thread上進行。而用來切換thread的函式有兩個：`observableOn`和`subscribeOn`。

##### observableOn

用來控制接下來的Observable operator是在哪個thread上執行。

##### subscribeOn

用來控制資料源要在哪個thread上被發出。

相同的，我們引入前面提到的思維來比喻，Observable就像水管，水管被設置在涵管中，所以thread就是涵管。而一個都市內的涵管則不止一條，彼此間互相串接。而連接處就等同於`observerOn`，將水管從一個涵管走到另一個涵管，也就是將thread切到另一個thread。水從水源走到各家各戶，中間會經過很多涵管，所以`observerOn`可以被重複使用。

與之相對的，`subscribeOn`等同於決定水被送出時，其水管所在的涵管。因為水源只能從一個地方出發，所以`subscribeOn`無法被重複使用，即使重複使用，也只有最接近源頭的有效。

#### Disposable

這是一個RxJava2才有的應用類，取代RxJava1的Subscription。在RxJava中有各式不同的Disposable，詳細可以看官方電子書的[Disposable](http://www.introtorx.com/Content/v1.0.10621.0/20_Disposables.html#Disposables)章節。

Disposable主要在不需要接收資訊時，透過`dispose()`來將中斷接收，就像是一個水龍頭開關。但是將水龍頭關上，不代表水不會流過，所以整個RxJava chain的operator依然會繼續運作，只是Subscriber不會收到資料，也就是`OnNext()`不會再被呼叫。舉例如下：

```java
Disposable disposable = Observable.just(1, 2)
	.map { i -> Log.d("In map: " + i) }
	.doOnNext { i -> Log.d("In doOnNext: " + i) }
```

在執行一次`doNoNext`後呼叫`dispose()`，預期的結果應該如下：

```java
In map: 1
In doOnNext: 1
// Call dispose() from out side, and nothing will be log after.
```

但實際上卻是如下：

```java
In map: 1
In doOnNext: 1
// Call dispose() from out side
In map: 2
// No doOnNext: 2
```

因此在這種情形下，就必須在執行期間自行判斷dispose的狀態。因此我們將`map`做一些改動如下：

```java
Disposable disposable = Observable.just(1, 2)
	.map { i -> isDispose() ? return : Log.d("In map: " + i) }
	.doOnNext { i -> Log.d("In doOnNext: " + i) }
```

如此就會印出我們所預期的log。

#### Memory Leak

不過，由於Disposable只是一個水閥的角色，即使呼叫`dispose()`也無法解決memory leak的問題。舉例如下：

```java
Disposable disposable = Observable.just(1).subscribe(new Consumer() {
  @Override
  public void accept() throws Exception {
    // Do something
  }
})
```

可以看到，我們建出來的`Consumer`就是典型的Anoymous inner class。所以這就造成了reference cycle，將使Activity退出後可能無法被回收。

在RxJava的operator中，有一個`onTerminateDetach`，擷取Javadoc的註釋：

> Nulls out references to the upstream producer and downstream Observer if the sequence is terminated or downstream calls dispose().

意思就是，透過這個operator，Observable會在被`dispose()`後主動切開資料源和Subscriber的連接，從而達到解開reference cycle的目的。


#### Appendix

這裡節錄一些跟主要章節沒直接相關的資訊。
