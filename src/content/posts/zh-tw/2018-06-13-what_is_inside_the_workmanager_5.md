---
title: "What is inside the WorkManager - Final"
date: "2018-06-13"
---

在本系列的前四篇，我們從WorkManager初始化流程開始，一路提到基本流程、串接Worker的流程，到Constraints的運作流程，將主要的功能看過了一回。

本篇將是這系列最後一篇，於是來談一個Google開發人員在IO上只用一句話帶過的一件事：

* **Cancal is a best-effort operation**


Best-effort，簡而言之就是盡可能完成，但不保證能達到其原本的用途。代表WorkManage的所有cancel相關的實作，都不能保證一定能正確取消任務。

### Why a Worker can't be canceled immediately?

於是接下來將從簡單的範例出發：

```Java
WorkManager.getInstance().cancelUniqueWork(Worker.name);
```

看到本篇，應該熟知要再看到WorManagerImpl：

```Java
// In WorManagerImpl
@Override
public void cancelUniqueWork(@NonNull String uniqueWorkName) {
    mTaskExecutor.executeOnBackgroundThread(CancelWorkRunnable.forName(uniqueWorkName, this));
}
```

直接透過Executor來執行CancelWorkRunnable。其實看到這邊就知道為什麼事best-effort了，原因是回到WorkManagerImpl的constructor：

```Java
// In WorkManagerImpl
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public WorkManagerImpl(@NonNull Context context, @NonNull Configuration configuration, 
boolean useTestDatabase) {
    ...
    mTaskExecutor = WorkManagerTaskExecutor.getInstance();
    ...
}
```

直接看到WorkManagerTaskExecutor：

```Java
// In WorkManagerTaskExecutor
public class WorkManagerTaskExecutor implements TaskExecutor {
    ...
    private final TaskExecutor mDefaultTaskExecutor = new DefaultTaskExecutor();
    ...
}
```

再看到DefaultTaskExecutor：

```Java
// In DefaultTaskExecutor
public class DefaultTaskExecutor implements TaskExecutor {
    private final ExecutorService mBackgroundExecutor = Executors.newSingleThreadExecutor();
    ...
    @Override
    public void executeOnBackgroundThread(Runnable r) {
        mBackgroundExecutor.execute(r);
    }
}
```

看到熟悉的函式`executeOnBackgroundThread`，和`Executors.newSingleThreadExecutor()`，可知WorkManagerImpl的Executor如果沒有透過外部指定，預設就是異步執行Runnable的Executor一個Worker要被取消，一定要先透過WorkManagerImpl執行，所以在單一Thread的Executor排程下，CancelWorkRunnable勢必會在佇列中等待，而無法立即被觸發來取消對應的Worker。

#### How does the Cancel operation works?

接著來看看cancel怎麼運作的，接續上面的內容，看到`CancelWorkRunnable.forName()`：

```Java
// In CancelWorkRunnable
public static Runnable forName(@NonNull final String name, @NonNull final WorkManagerImpl workManagerImpl) {
    return new CancelWorkRunnable() {
        @WorkerThread
        @Override
        public void run() {
            ...
            List<String> workSpecIds = workSpecDao.getUnfinishedWorkWithName(name);
            for (String workSpecId : workSpecIds) {
                cancel(workManagerImpl, workSpecId);
            }
            ...
            reschedulePendingWorkers(workManagerImpl);
        }
    };
}
```

從資料庫中取出對應的WorkSpec，然後呼叫`cancel()`：

```Java
// In CancelWorkRunnable
void cancel(WorkManagerImpl workManagerImpl, String workSpecId) {
    recursivelyCancelWorkAndDependents(workManagerImpl.getWorkDatabase(), workSpecId);

    Processor processor = workManagerImpl.getProcessor();
    processor.stopAndCancelWork(workSpecId);

    for (Scheduler scheduler : workManagerImpl.getSchedulers()) {
        scheduler.cancel(workSpecId);
    }
}
```

`recursivelyCancelWorkAndDependents()`不再贅述，簡言之就是將所有和WorkSpec直接相關或是間接相關的WorkSpec全都設定是CANCEL。也就是今天如有一個Worker鏈，取消其中一個，會全部一起被取消。

接著呼叫Processor的`stopAndCancelWork()`：

```Java
// In Processor
public synchronized boolean stopAndCancelWork(String id) {
    ...
    mCancelledIds.add(id);
    WorkerWrapper wrapper = mEnqueuedWorkMap.remove(id);
    if (wrapper != null) {
        wrapper.interrupt(true);
        ...
    }
    ...
}
```

這邊將Processor內正在排隊中的Worker刪除，並放入代表已經被取消的列表中。然後呼叫`interrupt()`嘗試停止WorkerWrapper：

```Java
// In WorkerWrapper
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public void interrupt(boolean cancelled) {
    mInterrupted = true;
    // Worker can be null if run() hasn't been called yet.
    if (mWorker != null) {
        mWorker.stop(cancelled);
    }
}

// In Worker
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public final void stop(boolean cancelled) {
    mStopped = true;
    mCancelled = cancelled;
    onStopped(cancelled);
}
```

可看得出這些停止的動作只是設定了一些參數，並沒有主動停止Worker的執行。所以在自訂Worker時，則需要自行判斷是否中斷當前作業。這點其實跟透過自訂的Thread和Runnable，來實作多執行緒一樣，中斷的時機有一部分是自己掌控。

回到前面，最後再看到`scheduler.cancel()`，這裡一樣用GreedyScheduler當例子：

```Java
// In CancelWorkRunnable
@Override
public synchronized void cancel(@NonNull String workSpecId) {
    ...
    mWorkManagerImpl.stopWork(workSpecId);
    removeConstraintTrackingFor(workSpecId);
}
```

在看到`stopWork()`：

```Java
// In WorkManagerImpl
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public void stopWork(String workSpecId) {
    mTaskExecutor.executeOnBackgroundThread(new StopWorkRunnable(this, workSpecId));
}
```

到這CancelWorkRunnable的任務基本上就結束了，最後會透過`reschedulePendingWorkers`再次透過Schedulers啟動資料庫中依然是ENQUEUED的WorkSpec：

```Java
// In CancelWorkRunnable
void reschedulePendingWorkers(WorkManagerImpl workManagerImpl) {
    Schedulers.schedule(
                workManagerImpl.getConfiguration(),
                workManagerImpl.getWorkDatabase(),
                workManagerImpl.getSchedulers());
}
```
#### What's more

最後，我們再來看看最後被啟動的StopWorkRunnable：

```Java
// In StopWorkRunnable
@Override
public void run() {
    ...
    try {
        if (workSpecDao.getState(mWorkSpecId) == State.RUNNING) {
            workSpecDao.setState(State.ENQUEUED, mWorkSpecId);
        }
        boolean isStopped = mWorkManagerImpl.getProcessor().stopWork(mWorkSpecId);
        ...
    }
}
```

實際上，我還無法理解為何要再執行這個Runnable。任何中斷的設定：WorkSpec資料庫和停止WorkWrapper，都已經在`cancel()`執行完畢。初步猜測應是有一些時間差的問題，導致需要再透過Scheduler來確保所有任務有被盡可能的即時停止。

### Summary

到此我們完成初步的分析，但由於查看的版本還只是alpha版，所以這邊只是給出一個初步的概念。離正式版號還有一段距離，可以預期到時還要重新研究，並修改前面的程式片段和分析內容。