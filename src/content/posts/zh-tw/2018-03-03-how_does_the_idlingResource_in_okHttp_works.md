---
title: "How Does The IdlingResource Works?"
date: "2018-03-03"
---

根據Espresso針對IdlingResource的介紹：

> Represents a resource of an application under test which can cause asynchronous background work to happen during test execution (e.g. an intent service that processes a button click). By default, Espresso synchronizes all view operations with the UI thread as well as AsyncTasks; however, it has no way of doing so with "hand-made" resources. In such cases, test authors can register the custom resource via IdlingRegistry and Espresso will wait for the resource to become idle prior to executing a view operation. 

簡言之，Espresso內建有偵測android必有的UI thread，以及AsyncTask所產生的thread的Idle狀態。但如果是自己產生的thread則無法被偵測，於是在原本的做法可能會用`sleep()`來等待，不過這是官方不建議的做法。

在[官方文件](https://developer.android.com/training/testing/espresso/idling-resource.html#identify-when-needed)內有列出幾個不建議的解法：

> * 使用Thread.sleep()：不只會拉長測試時間，也因需要延遲的時間無法預測，造成不同的機器依然會無法完成測試。
>
>
> * 使用失敗時重跑的機制：就像while迴圈一樣，重複執行只會產生多餘的效能損耗。
> * 使用CountDownLatch：使用thread來等待thread，會造成不必要的程式複雜度。

正確的解法應該是透過Espresso提供的IdlingResource相關的類別，或是透過繼承來實作專屬的IdlingResource，在使用註冊機制讓Espresso主動去檢查相關的resource。

詳細作法和注意事項請在[官方文件](https://developer.android.com/training/testing/espresso/idling-resource.html#create-own)查閱，這邊將以介紹IdlingResource的運作機制為主。

在自訂IdlingResource並使用時，必須要滿足以下兩個條件：

* 註冊自訂IdlingResource。
* 確認Idle狀態的機制。

### 註冊自訂IdlingResource

在測試的步驟執行前，先使用`IdlingRegistry.getInstance().register`來將自訂的IdlingResource註冊。

在執行如`onView`的函式時，會執行`IdlingResourceRegistry.sync()`，並將所有註冊過的IdlingResource傳入。

```Java
// In IdlingResourceRegistry
public void sync(final Iterable<IdlingResource> resources, final Iterable<Looper> loopers) {
  ...
  List<IdlingResource> resourcesToUnRegister = new ArrayList<>();
  for (IdlingState oldState : idlingStates) {
    if (null == resourcesToRegister.remove(oldState.resource.getName())) {
      // This resource is no longer used.
      resourcesToUnRegister.add(oldState.resource);
    } /* Else we already have this IR, so ignore. */
  }
  
  unregisterResources(resourcesToUnRegister);
  registerResources(Lists.newArrayList(resourcesToRegister.values()));
}
```

如果先前已經註冊的IdlingResource並沒有存在於新的IdlingResource列表中的話，就會被取消註冊。然後重新在註冊新的這些。

```Java
// In IdlingResourceRegistry
public boolean registerResources(final List<? extends IdlingResource> resourceList) {
  ...
  if (!duplicate) {
    IdlingState is = new IdlingState(resource, handler);
    idlingStates.add(is);
    is.registerSelf();
  }   
}
```

這邊再將IdlingResource一個個包裝成IdlingState，然後呼叫`registerSelf()`

```Java
// In IdlingResourceRegistry.IdlingState
private void registerSelf() {
  // on main, once at initialization.
  resource.registerIdleTransitionCallback(this);
  idle = resource.isIdleNow();
}
```

呼叫到`registerIdleTransitionCallback()`，這是在繼承IdlingResource時，需要實作的一個函式。

```Java
// OkHttp3IdlingResource
@Override
public void registerIdleTransitionCallback(ResourceCallback callback) {
  this.callback = callback;
}
```

如此自訂的IdlingResource可以在這取得對應的IdlingState，能用來與`IdlingResourceRegistry`溝通。

> IdlingResourceRegistry是Espresso用來監控所有自訂的IdlingResource的類別。

### 確認Idle狀態的機制

IdlingResourceRegistry確認IdlingResource狀態的方式，有分被動和主動兩種：

##### 主動

IdlingResourceRegistry會在必要時輪詢所有已註冊的IdlingResource：

```java
// In IdlingResourceRegistry
boolean allResourcesAreIdle() {
    checkState(Looper.myLooper() == looper);
    for (IdlingState is : idlingStates) {
        if (is.idle) {
            // ensure resource has not gone busy.
            is.idle = is.resource.isIdleNow();
        }
        if (!is.idle) {
            return false;
        }
    }
    return true;
}
```

因此每個IdlingResource都會被要求實作`isIdleNow()`，給予當前IdlingResource是否Idle的自我診斷。

##### 被動

透過`registerIdleTransitionCallback`取得的IdlingState來呼叫`onTransitionToIdle()`可以通知IdlingResourceRegistry當前的IdlingResource已經結束任務：

```Java
// In IdlingResourceRegistry
@Override
public void onTransitionToIdle() {
    // from app code - unknown thread
    Message m = handler.obtainMessage(DYNAMIC_RESOURCE_HAS_IDLED);
    m.obj = this;
    handler.sendMessage(m);
}

private class Dispatcher implements Handler.Callback {
    public boolean handleMessage(Message m) {
        switch (m.what) {
            case DYNAMIC_RESOURCE_HAS_IDLED:
                handleResourceIdled(m);
                break;
                ...
        }
        return true;
    }

    private void handleResourceIdled(Message m) {
        IdlingState is = (IdlingState) m.obj;
        is.idle = true;
        boolean unknownResource = true;
        boolean allIdle = true;
        for (IdlingState state : idlingStates) {
            allIdle = allIdle && state.idle;
            ...
        }
        ...
        if (allIdle) {
            try {
                idleNotificationCallback.allResourcesIdle();
            } finally {
                deregister();
            }
        }
    }
}
```

其作法是發出一個message，然後handler接到message後會呼叫到`handleResourceIdled()`，裡面會再輪詢一次所有IdlingResource的狀態，如此就可以在IdlingResource變Idle時，即時更新所有IdlingResource的狀態。

##### 主動+被動

以[OkHttp3IdlingResource](https://github.com/JakeWharton/okhttp-idling-resource/blob/050a41ef358dda4c61c1c4ed17ec22948f81bedd/src/main/java/com/jakewharton/espresso/OkHttp3IdlingResource.java#L25)為例，是在建立時傳入HttpClient的[Dispatcher](https://github.com/square/okhttp/blob/master/okhttp/src/main/java/okhttp3/Dispatcher.java)。

Dispatcher也可以取得目前仍在執行的任務數量：

```Java
// In OkHttp3IdlingResource
@Override public boolean isIdleNow() {
    return dispatcher.runningCallsCount() == 0;
}
```

在Dispatcher加上Callback，就可在HttpClient完成操作時即時收到通知，並同時通知IdlingResourceRegistry：

```java
// In OkHttp3IdlingResource
dispatcher.setIdleCallback(new Runnable() {
	@Override public void run() {
    	ResourceCallback callback = OkHttp3IdlingResource.this.callback;
        if (callback != null) {
            callback.onTransitionToIdle();
        }
    }
});
```

### 總結

綜合以上分析，我們可以將IdlingResource的機制簡單分成以下幾個步驟：

1. 透過`IdlingRegistry.getInstance().register`註冊。
2. 註冊後在`registerIdleTransitionCallback()`取得IdlingResource對應的`IdlingState`，完成雙向連結。
3. IdlingResourceRegistry主動呼叫`isIdleNow()`來詢問，或是呼叫`onTransitionToIdle()`由IdlingResource主動告知已進入Idle狀態。