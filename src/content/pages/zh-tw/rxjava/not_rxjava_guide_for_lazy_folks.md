---
title: "(Transcription) NotRxJava guide for lazy folks"
updated: "2019-04-04"
---
[origin]: https://yarikx.github.io/NotRxJava/

### Note

_This is only a transcription_
* _For English reader, please check the [origin article][origin] which is written by Yaroslav Heriatovych._

這是一篇個人紀錄，由原文翻譯而來。如欲閱讀細節，請至原文網站。

### Cat App

讓我們用實例來做開場

問題概述:

> 我們有一個現成的webservice，提供完整的api可以依照query來取得網路中有關貓的照片。  
> 每一張照片都會有一個整數來代表其可愛的程度。  
>
> 我們的app則會進行以下三個步驟：
> 1. 取得一個貓的照片的List
> 2. 依照可愛值選出最可愛的那張
> 3. 儲存到本地的資料庫

清楚了嗎？那我們就來開始吧！

#### Model and API

首先先建立一個簡單的Cat類別來記錄每一張照片和可愛值：

```java 
public class Cat implements Comparable<Cat>{
    Bitmap image;
    int cuteness;

    @Override
    public int compareTo(Cat another) {
        return Integer.compare(cuteness, another.cuteness);
    }
}
```

然後我們有一個現成的cat-sdk.jar提供api：

```java
public interface Api {
    List<Cat> queryCats(String query);
    Uri store(Cat cat);
}
```

最後將業務邏輯包裝再獨立的`CatsHelper`中：

```java
public class CatsHelper {

    Api api;

    public Uri saveTheCutestCat(String query){
        List<Cat> cats = api.queryCats(query);
        Cat cutest = findCutest(cats);
        Uri savedUri = api.store(cutest);
        return savedUri;
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

完成！多輕鬆簡單！`saveTheCutestCat`只做了幾件事：選擇適當的函示，給予參數，然後取得結果。
然後我們只要等他執行結束即可。

看起來非常簡單卻又很實用，現在讓我們來思考其他更進階的問題。

#### Composition

當我們使用三個函式來組成`saveTheCutestCat`時，這些函式就像樂高一樣：我們將其一個個連起來，也就是將一個函式的結果，傳入下一個函式。

#### Error propagation

組成一個函式的好處是可以用更有效的方式處理錯誤訊息。任何一個函式都可能出錯，並丟出任何訊息，但在Java裡我們不用獨立處理每一個錯誤訊息，只要透過try/catch機制即可：

```java
try{
    List<Cat> cats = api.queryCats(query);
    Cat cutest = findCutest(cats);
    Uri savedUri = api.store(cutest);
    return savedUri;
} catch (Exception e) {
    e.printStackTrace()
    return someDefaultValue;
}
```
在這個實作中我們可以處理任何執行中產生的錯誤訊息，或者也可以將錯誤訊息傳遞到下一個步驟（也就是不要有try/catch）。

#### Go Async

但是我們生活在一個真實的世界中，在真實世界中我們並不可能等函式執行完畢，尤其是像Android更是需要處理非同步機制。

以`OnClickListener`為例，我們使用這個callback來處理點擊事件，但可想而知這不能被放在一個會阻塞的執行緒中，所以其勢必是非同步處理的。

所以讓我們來嘗試修改成非同步吧！

##### Async network call

假設我們的query是透過一個非阻塞的HTTP api來執行，則我們的api則都得用非同步的callback來重新設計：

```java
public interface Api {
    interface CatsQueryCallback {
        void onCatListReceived(List<Cat> cats);
        void onError(Exception e);
    }


    void queryCats(String query, CatsQueryCallback catsQueryCallback);

    Uri store(Cat cat);
}
```

如此我們就有非同步的api，且透過`CatsQueryCallback`來取得結果。

相對的，`CatsHelper`也需要做一些調整：

```java
public class CatsHelper {

    public interface CutestCatCallback {
        void onCutestCatSaved(Uri uri);
        void onQueryFailed(Exception e);
    }

    Api api;

    public void saveTheCutestCat(String query, CutestCatCallback cutestCatCallback){
        api.queryCats(query, new Api.CatsQueryCallback() {
            @Override
            public void onCatListReceived(List<Cat> cats) {
                Cat cutest = findCutest(cats);
                Uri savedUri = api.store(cutest);
                cutestCatCallback.onCutestCatSaved(savedUri);
            }

            @Override
            public void onQueryFailed(Exception e) {
                cutestCatCallback.onError(e);
            }
        });
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

現在我們的api都是非同步的，所以`saveTheCutestCat`就不能回傳值，而必須要回傳在外部提供的callback之中。

更進一步，如果我們所有的api都是非同步的，例如我們使用非同步的IO來執行儲存的動作：

```java
public interface Api {
    interface CatsQueryCallback {
        void onCatListReceived(List<Cat> cats);
        void onQueryFailed(Exception e);
    }

    interface StoreCallback{
        void onCatStored(Uri uri);
        void onStoreFailed(Exception e);
    }


    void queryCats(String query, CatsQueryCallback catsQueryCallback);

    void store(Cat cat, StoreCallback storeCallback);
}
```

然後再修改一下我們的`CatsHelper`：

```java
public class CatsHelper {

    public interface CutestCatCallback {
        void onCutestCatSaved(Uri uri);
        void onError(Exception e);
    }

    Api api;

    public void saveTheCutestCat(String query, CutestCatCallback cutestCatCallback){
        api.queryCats(query, new Api.CatsQueryCallback() {
            @Override
            public void onCatListReceived(List<Cat> cats) {
                Cat cutest = findCutest(cats);
                api.store(cutest, new Api.StoreCallback() {
                    @Override
                    public void onCatStored(Uri uri) {
                        cutestCatCallback.onCutestCatSaved(uri);
                    }

                    @Override
                    public void onStoreFailed(Exception e) {
                        cutestCatCallback.onError(e);
                    }
                });
            }

            @Override
            public void onQueryFailed(Exception e) {
                cutestCatCallback.onError(e);
            }
        });
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

讓我們重新來檢視一下原本的程式，有比之前的好嗎？沒有！即使做的事情依然相同，但整個巢狀結構更加的複雜了。

一層纏繞一層的結果，我們的操作已經失去原本的彈性，且錯誤訊息將不會自動外傳而需要透過`onStoreFailed`或`onQueryFailed`來處理。

這樣會增加閱讀的難度嗎？當然會！

#### The end?

所以？我們就這樣卡在callback hell了嗎？

繫好你的安全帶，我們準備開始來修正這問題了！

### To the better world!

#### Generic callback

如果我們仔細地來看之前的callback，可以發現以下幾個共通點：

1. 都有一個傳遞結果用的函示(`onCutestCatSaved`, `onCatListReceived`, `onCatStored`)。
2. 大部分（在這例子中是全部）都有一個處理錯誤訊息的函示 (`onError`, `onQueryFailed`, `onStoreFailed`)。

因此我們可以宣告一個通用的callback來取代，但由於一般來說無法替換api的名稱，所以需要將api做一層包裝。

以下就是用來取代的callback：

```java
public interface Callback<T> {
    void onResult(T result);
    void onError(Exception e);
}
```

並用`ApiWrapper`包裝原本的api：

```java
public class ApiWrapper {
    Api api;

    public void queryCats(String query, Callback<List<Cat>> catsCallback){
        api.queryCats(query, new Api.CatsQueryCallback() {
            @Override
            public void onCatListReceived(List<Cat> cats) {
                catsCallback.onResult(cats);
            }

            @Override
            public void onQueryFailed(Exception e) {
                catsCallback.onError(e);
            }
        });
    }

    public void store(Cat cat, Callback<Uri> uriCallback){
        api.store(cat, new Api.StoreCallback() {
            @Override
            public void onCatStored(Uri uri) {
                uriCallback.onResult(uri);
            }

            @Override
            public void onStoreFailed(Exception e) {
                uriCallback.onError(e);
            }
        });
    }
}
```

最後，在修正一下我們的`CatsHelper`:

```java
public class CatsHelper{

    ApiWrapper apiWrapper;

    public void saveTheCutestCat(String query, Callback<Uri> cutestCatCallback){
        apiWrapper.queryCats(query, new Callback<List<Cat>>() {
            @Override
            public void onResult(List<Cat> cats) {
                Cat cutest = findCutest(cats);
                apiWrapper.store(cutest, cutestCatCallback);
            }

            @Override
            public void onError(Exception e) {
                cutestCatCallback.onError(e);
            }
        });
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

藉由將最外面傳入的callback，直接導入我們另外包裹的api中，可以減少一層之前所看到的巢狀結構。

但還可以更好嗎？當然！

#### You gotta keep it separated

我們再來看到這些代表非同步處理的函示(`queryCats`, `store` and resulting `saveTheCutestCat`)。這些函示都遵循著相同的模式：一個輸入外加一個callback，就如同大部分的非同步操作一樣。因此我們可以嘗試將這兩個分開，函式變成只接受一個輸入，然後回傳一個有接受callback傳入的函式的物件。

讓我們來試試看這想法有沒有幫助。

假設我們需要回傳一個暫時性物件來用於非同步操作，我們必須要先定義出來。讓我們稱這個類別叫做`AsyncJob`：
```java
public abstract class AsyncJob<T> {
    public abstract void start(Callback<T> callback);
}
```

非常單純，函式`start`會接受一個callback為參數，然後開始執行*任務*.

調整`ApiWrapper`：

```java
public class ApiWrapper {
    Api api;

    public AsyncJob<List<Cat>> queryCats(String query) {
        return new AsyncJob<List<Cat>>() {
            @Override
            public void start(Callback<List<Cat>> catsCallback) {
                api.queryCats(query, new Api.CatsQueryCallback() {
                    @Override
                    public void onCatListReceived(List<Cat> cats) {
                        catsCallback.onResult(cats);
                    }

                    @Override
                    public void onQueryFailed(Exception e) {
                        catsCallback.onError(e);
                    }
                });
            }
        };
    }

    public AsyncJob<Uri> store(Cat cat) {
        return new AsyncJob<Uri>() {
            @Override
            public void start(Callback<Uri> uriCallback) {
                api.store(cat, new Api.StoreCallback() {
                    @Override
                    public void onCatStored(Uri uri) {
                        uriCallback.onResult(uri);
                    }

                    @Override
                    public void onStoreFailed(Exception e) {
                        uriCallback.onError(e);
                    }
                });
            }
        };
    }
}
```

目前為止都還很順利。我們完成對`ApiWrapper`的改動。現在我們可以用`AsyncJob`來再任意時間點執行任務。

再對`CatsHelper`進行調整：

```java
public class CatsHelper {

    ApiWrapper apiWrapper;

    public AsyncJob<Uri> saveTheCutestCat(String query) {
        return new AsyncJob<Uri>() {
            @Override
            public void start(Callback<Uri> cutestCatCallback) {
                apiWrapper.queryCats(query)
                        .start(new Callback<List<Cat>>() {
                            @Override
                            public void onResult(List<Cat> cats) {
                                Cat cutest = findCutest(cats);
                                apiWrapper.store(cutest)
                                        .start(new Callback<Uri>() {
                                            @Override
                                            public void onResult(Uri result) {
                                                cutestCatCallback.onResult(result);
                                            }

                                            @Override
                                            public void onError(Exception e) {
                                                cutestCatCallback.onError(e);
                                            }
                                        });
                            }

                            @Override
                            public void onError(Exception e) {
                                cutestCatCallback.onError(e);
                            }
                        });
            }
        };
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

哇，前一個版本似乎比較精簡。那這個版本的好處在哪？是現在我們可以回傳由一堆操作組合而成的`AsyncJob<Uri>`，來組合出更多不同的操作。

不過現在程式碼看起來有點糟糕，讓我們來做些修正。

#### Breaking things

以下是我們理想的資料取得過程：

```
         (async)                 (sync)           (async)
query ===========> List<Cat> -------------> Cat ==========> Uri
       queryCats              findCutest           store
```

接著要做的是將剛寫的程式，切分成上述的幾個步驟。

但在開始之前，讓我們來思考一下：如果一個操作是非同步的，是不是代表接下來的操作都應該是非同步？例如一個取得貓照片的操作是非同步的，接著要找出最可愛的貓也會是非同步操作。

所以我們可以將前面的程式，用`AsyncJob`進行切分：

```java
public class CatsHelper {

    ApiWrapper apiWrapper;

    public AsyncJob<Uri> saveTheCutestCat(String query) {
        AsyncJob<List<Cat>> catsListAsyncJob = apiWrapper.queryCats(query);
        AsyncJob<Cat> cutestCatAsyncJob = new AsyncJob<Cat>() {
            @Override
            public void start(Callback<Cat> callback) {
                catsListAsyncJob.start(new Callback<List<Cat>>() {
                    @Override
                    public void onResult(List<Cat> result) {
                        callback.onResult(findCutest(result));
                    }

                    @Override
                    public void onError(Exception e) {
                        callback.onError(e);
                    }
                });
            }
        };

        AsyncJob<Uri> storedUriAsyncJob = new AsyncJob<Uri>() {
            @Override
            public void start(Callback<Uri> cutestCatCallback) {
                cutestCatAsyncJob.start(new Callback<Cat>() {
                    @Override
                    public void onResult(Cat cutest) {
                        apiWrapper.store(cutest)
                                .start(new Callback<Uri>() {
                                    @Override
                                    public void onResult(Uri result) {
                                        cutestCatCallback.onResult(result);
                                    }

                                    @Override
                                    public void onError(Exception e) {
                                        cutestCatCallback.onError(e);
                                    }
                                });
                    }

                    @Override
                    public void onError(Exception e) {
                        cutestCatCallback.onError(e);
                    }
                });
            }
        };
        return storedUriAsyncJob;
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

整個變更肥，但邏輯更清楚了。沒有過多的巢狀callback，易懂的參數命名（`catsListAsyncJob`, `cutestCatAsyncJob`, `storedUriAsyncJob`）。

看起來好多了，但讓我們再繼續做一些調整：

#### Simple Mapping

現在我需要你看一下剛剛建立的`AsyncJob<Cat> cutestCatAsyncJob`：

```java
AsyncJob<Cat> cutestCatAsyncJob = new AsyncJob<Cat>() {
            @Override
            public void start(Callback<Cat> callback) {
                catsListAsyncJob.start(new Callback<List<Cat>>() {
                    @Override
                    public void onResult(List<Cat> result) {
                        callback.onResult(findCutest(result));
                    }

                    @Override
                    public void onError(Exception e) {
                        callback.onError(e);
                    }
                });
            }
        };
```

整個16行的程式碼，只有一行是有意義的操作（對於我們的邏輯來說）：

```java
findCutest(result)
```

這行程式碼會導致創建出來的`AsyncJob`無法被有效重複使用在其他目的，也無法彈性的傳遞結果和錯誤訊息。

此外，這操作其實也不專屬於某一個Job，所以我們可以將其轉移到別處。

所以要怎麼實作呢？這裡有兩個條件必須要滿足：

1. `AsyncJob`帶有的型別必須是要轉換後的類別。
2. 轉換用的函式

因為我們不能直接將函式當作參數，所以我們需要透過`interface`實作：

```java
public interface Func<T, R> {
    R call(T t);
}
```

非常好理解，`Func`有兩個參數`T`代表原本的類別；`R`代表轉換後的類別。

當我們要將一個`AsyncJob`的結果作轉換時，必須要對內容做搬移，因此這邊設計了一個函式`map`。

用`this`代表原本的`AsyncJob`，將其包裝在新的`AsyncJob`中啟用，並使用傳入的`Func`作轉換，然後我們就可以完成轉換的過程：

```java
public abstract class AsyncJob<T> {
    public abstract void start(Callback<T> callback);

    public <R> AsyncJob<R> map(Func<T, R> func){
        final AsyncJob<T> source = this;
        return new AsyncJob<R>() {
            @Override
            public void start(Callback<R> callback) {
                source.start(new Callback<T>() {
                    @Override
                    public void onResult(T result) {
                        R mapped = func.call(result);
                        callback.onResult(mapped);
                    }

                    @Override
                    public void onError(Exception e) {
                        callback.onError(e);
                    }
                });
            }
        };
    }
}
```

看起來ＯＫ，`CatsHelper`現在看起來會變這樣：

```java
public class CatsHelper {

    ApiWrapper apiWrapper;

    public AsyncJob<Uri> saveTheCutestCat(String query) {
        AsyncJob<List<Cat>> catsListAsyncJob = apiWrapper.queryCats(query);
        AsyncJob<Cat> cutestCatAsyncJob = catsListAsyncJob.map(new Func<List<Cat>, Cat>() {
            @Override
            public Cat call(List<Cat> cats) {
                return findCutest(cats);
            }
        });

        AsyncJob<Uri> storedUriAsyncJob = new AsyncJob<Uri>() {
            @Override
            public void start(Callback<Uri> cutestCatCallback) {
                cutestCatAsyncJob.start(new Callback<Cat>() {
                    @Override
                    public void onResult(Cat cutest) {
                        apiWrapper.store(cutest)
                                .start(new Callback<Uri>() {
                                    @Override
                                    public void onResult(Uri result) {
                                        cutestCatCallback.onResult(result);
                                    }

                                    @Override
                                    public void onError(Exception e) {
                                        cutestCatCallback.onError(e);
                                    }
                                });
                    }

                    @Override
                    public void onError(Exception e) {
                        cutestCatCallback.onError(e);
                    }
                });
            }
        };
        return storedUriAsyncJob;
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

好多了，`AsyncJob<Cat> cutestCatAsyncJob`只需要6行的程式碼，而且巢狀深度只有一層。

#### Advanced mapping

但另一個函式`AsyncJob<Uri> storedUriAsyncJob`依然有點醜。

讓我們來試試看`map`能不能用在這裡：

```java
public class CatsHelper {

    ApiWrapper apiWrapper;

    public AsyncJob<Uri> saveTheCutestCat(String query) {
        AsyncJob<List<Cat>> catsListAsyncJob = apiWrapper.queryCats(query);
        AsyncJob<Cat> cutestCatAsyncJob = catsListAsyncJob.map(new Func<List<Cat>, Cat>() {
            @Override
            public Cat call(List<Cat> cats) {
                return findCutest(cats);
            }
        });

        AsyncJob<Uri> storedUriAsyncJob = cutestCatAsyncJob.map(new Func<Cat, Uri>() {
            @Override
            public Uri call(Cat cat) {
                return apiWrapper.store(cat);
        //      ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ will not compile
        //      Incompatible types:
        //      Required: Uri
        //      Found: AsyncJob<Uri>                
            }
        });
        return storedUriAsyncJob;
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

看起來沒那麼簡單，讓我們修改一下回傳的型別看看：

```java
public class CatsHelper {

    ApiWrapper apiWrapper;

    public AsyncJob<Uri> saveTheCutestCat(String query) {
        AsyncJob<List<Cat>> catsListAsyncJob = apiWrapper.queryCats(query);
        AsyncJob<Cat> cutestCatAsyncJob = catsListAsyncJob.map(new Func<List<Cat>, Cat>() {
            @Override
            public Cat call(List<Cat> cats) {
                return findCutest(cats);
            }
        });

        AsyncJob<AsyncJob<Uri>> storedUriAsyncJob = cutestCatAsyncJob.map(new Func<Cat, AsyncJob<Uri>>() {
            @Override
            public AsyncJob<Uri> call(Cat cat) {
                return apiWrapper.store(cat);
            }
        });
        return storedUriAsyncJob;
        //^^^^^^^^^^^^^^^^^^^^^^^ will not compile
        //      Incompatible types:
        //      Required: AsyncJob<Uri>
        //      Found: AsyncJob<AsyncJob<Uri>>
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

我們只能改成`AsyncJob<AsyncJob<Uri>>`，但這無法通過回傳值的型別判斷。

我們想要將`AsyncJob`減少一層，因為這部分只能算是一個非同步的操作。

接著需要的是一個函式不只是回傳`R`而是回傳`AsyncJob<R>`。這函式會和`map`類似，但最後會將`AsyncJob`拉平，所以我們稱其叫做`flatMap`：

```java
public abstract class AsyncJob<T> {
    public abstract void start(Callback<T> callback);

    public <R> AsyncJob<R> map(Func<T, R> func){
        final AsyncJob<T> source = this;
        return new AsyncJob<R>() {
            @Override
            public void start(Callback<R> callback) {
                source.start(new Callback<T>() {
                    @Override
                    public void onResult(T result) {
                        R mapped = func.call(result);
                        callback.onResult(mapped);
                    }

                    @Override
                    public void onError(Exception e) {
                        callback.onError(e);
                    }
                });
            }
        };
    }

    public <R> AsyncJob<R> flatMap(Func<T, AsyncJob<R>> func){
        final AsyncJob<T> source = this;
        return new AsyncJob<R>() {
            @Override
            public void start(Callback<R> callback) {
                source.start(new Callback<T>() {
                    @Override
                    public void onResult(T result) {
                        AsyncJob<R> mapped = func.call(result);
                        mapped.start(new Callback<R>() {
                            @Override
                            public void onResult(R result) {
                                callback.onResult(result);
                            }

                            @Override
                            public void onError(Exception e) {
                                callback.onError(e);
                            }
                        });
                    }

                    @Override
                    public void onError(Exception e) {
                        callback.onError(e);
                    }
                });
            }
        };
    }
}
```

是的，`flatMap`看起來有點亂，但全部都只在同一處且不會被使用者看到。因此我們的`CatsHelper`變成如下：

```java
public class CatsHelper {

    ApiWrapper apiWrapper;

    public AsyncJob<Uri> saveTheCutestCat(String query) {
        AsyncJob<List<Cat>> catsListAsyncJob = apiWrapper.queryCats(query);
        AsyncJob<Cat> cutestCatAsyncJob = catsListAsyncJob.map(new Func<List<Cat>, Cat>() {
            @Override
            public Cat call(List<Cat> cats) {
                return findCutest(cats);
            }
        });

        AsyncJob<Uri> storedUriAsyncJob = cutestCatAsyncJob.flatMap(new Func<Cat, AsyncJob<Uri>>() {
            @Override
            public AsyncJob<Uri> call(Cat cat) {
                return apiWrapper.store(cat);
            }
        });
        return storedUriAsyncJob;
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

太棒了！現在看起閱讀性更高，且更容易編寫了。

#### Final point

最後再來看一下成果，看起來是不是很熟悉？不然我們將其運用[lambda](https://docs.oracle.com/javase/tutorial/java/javaOO/lambdaexpressions.html)的方式在轉換一次看看：

```java
public class CatsHelper {

    ApiWrapper apiWrapper;

    public AsyncJob<Uri> saveTheCutestCat(String query) {
        AsyncJob<List<Cat>> catsListAsyncJob = apiWrapper.queryCats(query);
        AsyncJob<Cat> cutestCatAsyncJob = catsListAsyncJob.map(cats -> findCutest(cats));
        AsyncJob<Uri> storedUriAsyncJob = cutestCatAsyncJob.flatMap(cat -> apiWrapper.store(cat));
        return storedUriAsyncJob;
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

清楚點了嗎？我覺得這段程式碼與我們一開始的很相似：

```java
public class CatsHelper {

    Api api;

    public Uri saveTheCutestCat(String query){
        List<Cat> cats = api.queryCats(query);
        Cat cutest = findCutest(cats);
        Uri savedUri = api.store(cutest);
        return savedUri;
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

沒錯！就是這樣！邏輯完全相同，語義也完全相同。

那有組合性嗎？當然！
我們組合了非同步操作並且回傳。

錯誤訊息的傳遞呢？當然也有！
所有錯誤會一路傳到最後的callback。

最後...

##[RxJava](https://github.com/ReactiveX/RxJava)

你不需要將這些類別運用到你的專案中。因為我們只是寫了一個簡易的版本，並沒處理線程的問題。

這裡點出一些不同處：

* `AsyncJob<T>`其實就是[`Observable<T>`](http://reactivex.io/documentation/observable.html)且可能會是一連串非單一的物件。
* `Callback<T>`就是[`Observer<T>`](http://reactivex.io/documentation/operators/subscribe.html)且內容就是`onNext(T t)`，`onError(Throwable t)`還有`onCompleted()`來處理一連串操作後的結果。
* `abstract void start(Callback<T> callback)`對應到[`Subscription subscribe(final Observer<? super T> observer)`](http://reactivex.io/RxJava/javadoc/rx/Observable.html#subscribe(rx.Observer))並回傳[`Subscription`](http://reactivex.io/RxJava/javadoc/rx/Subscription.html)來取消。
* 此外還有`map`和`flatMap`，`Observable`等不同的[操作](http://reactivex.io/documentation/operators.html)可以被使用。

以下是一個使用RxJava調整後的版本：

```java
public class ApiWrapper {
    Api api;

    public Observable<List<Cat>> queryCats(final String query) {
        return Observable.create(new Observable.OnSubscribe<List<Cat>>() {
            @Override
            public void call(final Subscriber<? super List<Cat>> subscriber) {
                api.queryCats(query, new Api.CatsQueryCallback() {
                    @Override
                    public void onCatListReceived(List<Cat> cats) {
                        subscriber.onNext(cats);
                    }

                    @Override
                    public void onQueryFailed(Exception e) {
                        subscriber.onError(e);
                    }
                });
            }
        });
    }

    public Observable<Uri> store(final Cat cat) {
        return Observable.create(new Observable.OnSubscribe<Uri>() {
            @Override
            public void call(final Subscriber<? super Uri> subscriber) {
                api.store(cat, new Api.StoreCallback() {
                    @Override
                    public void onCatStored(Uri uri) {
                        subscriber.onNext(uri);
                    }

                    @Override
                    public void onStoreFailed(Exception e) {
                        subscriber.onError(e);
                    }
                });
            }
        });
    }
}

public class CatsHelper {

    ApiWrapper apiWrapper;

    public Observable<Uri> saveTheCutestCat(String query) {
        Observable<List<Cat>> catsListObservable = apiWrapper.queryCats(query);
        Observable<Cat> cutestCatObservable = catsListObservable.map(new Func1<List<Cat>, Cat>() {
            @Override
            public Cat call(List<Cat> cats) {
                return CatsHelper.this.findCutest(cats);
            }
        });
        Observable<Uri> storedUriObservable = cutestCatObservable.flatMap(new Func1<Cat, Observable<? extends Uri>>() {
            @Override
            public Observable<? extends Uri> call(Cat cat) {
                return apiWrapper.store(cat);
            }
        });
        return storedUriObservable;
    }

    private Cat findCutest(List<Cat> cats) {
        return Collections.max(cats);
    }
}
```

你可以看到這段程式碼都用`Observable`取代`AsyncJob`。


### Conclusion
我們用一個簡單的轉換過程，解釋了如何使用抽象類實作非同步操作。這方式可以讓你用像一般函式呼叫一樣將非同步的操作組合起來，並且免除了callback hell，和自己處理錯誤訊息傳遞的麻煩。

到這邊建議你休息一下，思考一下同步和非同步的異同，然後看看這部由Erik Meijer製作的超棒[影片](https://channel9.msdn.com/Events/Lang-NEXT/Lang-NEXT-2014/Keynote-Duality)。

#### Useful Links

* http://reactivex.io/
* https://github.com/ReactiveX/RxJava
* https://github.com/ReactiveX/RxJava/wiki
* http://queue.acm.org/detail.cfm?id=2169076
* https://www.coursera.org/course/reactive
* http://blog.danlew.net/2014/09/15/grokking-rxjava-part-1/

