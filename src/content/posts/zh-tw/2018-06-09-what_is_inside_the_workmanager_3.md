---
title: "What is inside the WorkManager - Part 3"
date: "2018-06-09"
---

WorkManager提供了`beginWith()`和`then()`，來將Worker串連。於是這次將分析將著重在其背後的流程，詳細使用方式，請參考官方文件的[Chained Tasks](https://developer.android.com/topic/libraries/architecture/workmanager#chained)章節。

### How does the WorkManager chain the Works?

我們從一個簡單的範例出發，用`beginWith()`開啟一個Worker，然後用`then()`再連結一個Worker：

```java
WorkManager.getInstance()
    .beginWork(OneTimeWorkRequest.from(WorkA.class))
    .then(OneTimeWorkRequest.from(WorkB.class))
    .enqueue()
```

如預期的，一樣會走到WorkManagerImpl：

```Java
// In WorkManagerImpl
@Override
public WorkContinuation beginWith(@NonNull List<OneTimeWorkRequest> work) {
    return new WorkContinuationImpl(this, work);
}
```

再次走到WorkContinuationImpl的contructor，由Part1可知這邊單純只是把Worker和WorkManagerImpl包入WorkContinuationImpl。於是我們再看到`then()`，也就是`WorkContinuationImpl.then()`：

```Java
// In WorkContinuationImpl
@Override
public WorkContinuation then(List<OneTimeWorkRequest> work) {
    return new WorkContinuationImpl(mWorkManagerImpl, mName, ExistingWorkPolicy.KEEP, 
                                    work, Collections.singletonList(this));
}
```

沒做特別的事情，僅僅是將剛剛得到的WorkContinuationImpl再包一層WorkContinuationImpl，並使用相同的WorkManager和Worker。

於是在這先總結一下目前WorkContinuationImpl內含的結構：

```
WorkContinuationImplB {
	WorkRequestB {
        WorkSpecB {
            WorkerA
        }
	}
    parents = WorkContinuationImplA {        
    	WorkRequestA {
        	WorkSpecA {
                WorkerA
        	}
        }
        parents = null
    }
}
```

接著走到`WorkContinuationImpl.enqueue()`，根據Part1的介紹，這邊直接帶到`EnqueueRunnable.run()`：

```Java
// In EnqueueRunnable
@Override
public void run() {
    ...
    boolean needsScheduling = addToDatabase();
    if (needsScheduling) {
        scheduleWorkInBackground();
    }
}
```

然後走到`addToDatabase()`：

```Java
// In EnqueueRunnable
public boolean addToDatabase() {
    ...
    try {
        boolean needsScheduling = processContinuation(mWorkContinuation);
        ...
        return needsScheduling;
    } 
    ...
}
```

再走到`processContinuation()`：

```Java
// In EnqueueRunnable
private static boolean processContinuation(@NonNull WorkContinuationImpl workContinuation) {
    boolean needsScheduling = false;
    List<WorkContinuationImpl> parents = workContinuation.getParents();
    if (parents != null) {
        for (WorkContinuationImpl parent : parents) {
            ...
            if (!parent.isEnqueued()) {
                needsScheduling |= processContinuation(parent);
            } 
            ...
        }
    }
    needsScheduling |= enqueueContinuation(workContinuation);
    return needsScheduling;
}
```

透過我們得到的WorkContinuationImplB，可以知道`parents`是含有WorkRequestA的WorkContinuationImplA，所以進入`processContinuation()`的遞迴第二層。

而WorkContinuationImplA的`parents`是空的，所以就和Part1一樣，這邊會從WorkContinuationImplA提出WorkSpecA，放入WorkSpec資料庫，然後回傳true。

接著回到遞迴第一層，得到`needScheduling`目前為true。接著看到`enqueueContinuation()`：

```Java
// In EnqueueRunnable
private static boolean enqueueContinuation(@NonNull WorkContinuationImpl workContinuation) {
    Set<String> prerequisiteIds = WorkContinuationImpl.prerequisitesFor(workContinuation);
    boolean needsScheduling = enqueueWorkWithPrerequisites(
            workContinuation.getWorkManagerImpl(),
            workContinuation.getWork(),
            prerequisiteIds.toArray(new String[0]),
            workContinuation.getName(),
            workContinuation.getExistingWorkPolicy());

    workContinuation.markEnqueued();
    return needsScheduling;
}
```

先看到`prerequisitesFor()`：

```Java
// In WorkContinuationImpl
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public static Set<String> prerequisitesFor(WorkContinuationImpl continuation) {
	...
    List<WorkContinuationImpl> parents = continuation.getParents();
    if (parents != null && !parents.isEmpty()) {
        for (WorkContinuationImpl parent : parents) {
            preRequisites.addAll(parent.getIds());
        }
    }
    return preRequisites;
}
```

由於WorkContinuationImplB的`parents`不為空，也就是WorkContinuationImplA，所以`getId()`會回傳WorkContinuationImplA的所有WorkRequest的Id，也就是WorkRequestA的Id，同時也是WorkSpecA的Id。

接著回到EnqueueRunnable的`enqueueWorkWithPrerequisites()`，在這一樣僅列出沒被跳過的主要部分：

```Java
// In EnqueueRunnable
private static boolean enqueueWorkWithPrerequisites(WorkManagerImpl workManagerImpl, @NonNull List<? extends WorkRequest> workList, String[] prerequisiteIds, String name, ExistingWorkPolicy existingWorkPolicy) {
    ...
    WorkDatabase workDatabase = workManagerImpl.getWorkDatabase();
    
    boolean hasPrerequisite = (prerequisiteIds != null && prerequisiteIds.length > 0);
    ...
    if (hasPrerequisite) {
        ...
        for (String id : prerequisiteIds) {
            WorkSpec prerequisiteWorkSpec = workDatabase.workSpecDao().getWorkSpec(id);
            ...
            State prerequisiteState = prerequisiteWorkSpec.state;
            hasCompletedAllPrerequisites &= (prerequisiteState == SUCCEEDED);
            ...
        }
    }
	...
    boolean needsScheduling = false;
    for (WorkRequest work : workList) {
        WorkSpec workSpec = work.getWorkSpec();

        if (hasPrerequisite && !hasCompletedAllPrerequisites) {
            ...
            workSpec.state = BLOCKED;
        } 
        ...
        workDatabase.workSpecDao().insertWorkSpec(workSpec);

        if (hasPrerequisite) {
            for (String prerequisiteId : prerequisiteIds) {
                Dependency dep = new Dependency(work.getStringId(), prerequisiteId);
                workDatabase.dependencyDao().insertDependency(dep);
            }
        }
        ...
    }
    return needsScheduling;
}
```

我們知道`prerequisiteIds`內的Id同時也是WorkSpec的Id，所以會先從資料庫中取出對應的WorkSpec，並檢查其狀態，也就是WorkSpecA的狀態。

WorkSpecA剛剛才被放進資料庫，還沒開始被運行，所以其狀態不會是SUCCESS，於是`hasCompletedAllPrerequisites`就為false。這也讓WorkSpecB在被取出後，直接被設定成BLOCK。

接著將WorkSpecB的Id與`prerequisiteId`內的Id，也就是WorkSpecA的Id，透過Dependency類別包裝，並另外放入Dependency專屬的資料庫中。

這邊回傳的會是false，但是因為`needSchedulinge`已經是true，所以遞迴走完`processContinuation`會得到true，並繼續往下執行`scheduleWorkInBackground()`。

透過Part1的分析，可以知道`scheduleWorkInBackground()`之後，會取出狀態是ENQUEUED的WorkSpec，這邊就是WorkSpecA，並透過`WorkerWrapper.run()`將WorkerA實體化並執行，最後走到`handleResult()`：

```Java
// In WorkWrapper
private void handleResult(Worker.WorkerResult result) {
    switch (result) {
        case SUCCESS: {
            ...
            setSucceededAndNotify();
            ...
        }
        ...
    }
}
```

在WorkSpecA執行成功的情況下，會再到`setSucceededAndNotify()`:

```Java
// In WorkWrapper
private void setSucceededAndNotify() {
	...
    try {
        mWorkSpecDao.setState(SUCCEEDED, mWorkSpecId);
        ...
        // Unblock Dependencies and set Period Start Time
        long currentTimeMillis = System.currentTimeMillis();
        List<String> dependentWorkIds = mDependencyDao.getDependentWorkIds(mWorkSpecId);
        for (String dependentWorkId : dependentWorkIds) {
            if (mDependencyDao.hasCompletedAllPrerequisites(dependentWorkId)) {
                ...
                mWorkSpecDao.setState(ENQUEUED, dependentWorkId);
                mWorkSpecDao.setPeriodStartTime(dependentWorkId, currentTimeMillis);
            }
        }
        ...
    }
    ...
    // This takes of scheduling the dependent workers as they have been marked ENQUEUED.
    Schedulers.schedule(mWorkDatabase, mSchedulers);
}	
```

這裡依序先做了幾件事：

* 把當前的WorkSpec狀態標記成SUCCEEDED。
* 透過前面提過的Dependency資料庫，呼叫`getDependentWorkIds()`取得WorkSpecB的Id。
* 再透過`hasCompletedAllPrerequisites()`交叉比對Dependency和WorkSpec資料庫。
* 如果前一步驟得到true，代表WorkSpecA已經被正確執行。如此就可以將WorkSpecB標記成ENQUEUED。
* 最後，再次呼叫`Schedulers.schedule()`，如此已經被設定成ENQUEUED的WorkSpecB就會進入執行的流程。

總的來說，整個流程可以被簡化如下：

* 建立WorkerA，並當成參數建立WorkerRequestA，並透過WorkerA建立WorkSpecA。
* 建立WorkerB，並當成參數建立WorkerRequestB，並透過WorkerB建立WorkSpecB。
* 透過`beginWith()`和`then()`建立前後關係。
* 將WorkSpecAB放入資料庫。
* 在適當時機先取出WorkSpecA來執行WorkA，WorkSpecB在資料庫中等待。
* WorkA執行完後取出WorkSpecB來執行WorkB。

#### output/input

串連Worker的另一重點，就是傳遞參數，根據官方的介紹，傳遞參數的方式是先使用Data類別將結果以key-value形式存入，然後在透過`setOutputData()`將Data存在Worker內：

```Java
// In Worker
public final void setOutputData(@NonNull Data outputData) {
    mOutputData = outputData;
}
```

這裡繼續使用前面的範例，在WorkerA被成功執行後，會走到的最後一個函式`setSucceededAndNotify()`：

```Java
// In WorkWrapper
private void setSucceededAndNotify() {
    ...
    try {
        ...
        Data output = mWorker.getOutputData();
        mWorkSpecDao.setOutput(mWorkSpecId, output);
        ...
    } 
    ...
}
```

在這透過`getOutputData()`將剛剛放入的Data取出，然後跟著WorkSpecA的Id放入資料庫。如此在WorkerB準備被實體化並執行前： 

```Java
// In WorkWrapper
@WorkerThread
@Override
public void run() {
    ...
    InputMerger inputMerger = InputMerger.fromClassName(mWorkSpec.inputMergerClassName);
    ...
    List<Data> inputs = new ArrayList<>();
    inputs.add(mWorkSpec.input);
    inputs.addAll(mWorkSpecDao.getInputsFromPrerequisites(mWorkSpecId));
    input = inputMerger.merge(inputs);
    ...    
    Extras extras = new Extras(input,               
                               mWorkTagDao.getTagsForWorkSpecId(mWorkSpecId),
                               mRuntimeExtras,
                               mWorkSpec.runAttemptCount);
    mWorker = workerFromWorkSpec(mAppContext, mWorkSpec, extras);
}
```

在這透過WorkSpecB重新從資料庫找回Data，再透過InputMerger與WorkSpecB本身的輸入合併，變成WorkSpecB的實際輸入。

### What's more

#### combine()

WorkManager除了使用上面介紹的函示來做串連，已經串連好的Worker鏈，也可以透過`combine()`進行串聯，如此就可以從單一的Worker，取得不同Worker鏈執行後的結果。

背後的實作方式並不複雜，在這直接先從簡單的範例出發：假設現在有兩個已經如前面所述，透過`beginWith()`和`then()`產生的Worker鏈，並且用`combine()`再次串連。

則實際上的實作如下：

```java
WorkContinuation.combine(WorkChain1, WorkChain2)
```

直接從`combine()`開始看：

```Java
// In WorkContinuation
public static WorkContinuation combine(@NonNull WorkContinuation... continuations) {
    return combine(Arrays.asList(continuations));
}

public static WorkContinuation combine(@NonNull List<WorkContinuation> continuations) {
    ...
    return continuations.get(0).combineInternal(null, continuations);
}
```

走到`combineInternal`，也就是`WorkContinuationImpl.combineInternal()`：

```Java
// In WorkContinuationImpl
@Override
protected WorkContinuation combineInternal(@Nullable OneTimeWorkRequest work, @NonNull List<WorkContinuation> continuations) {
    if (work == null) {
        work = new OneTimeWorkRequest.Builder(CombineContinuationsWorker.class)
                    .setInputMerger(ArrayCreatingInputMerger.class)
                    .build();
    }

    List<WorkContinuationImpl> parents = new ArrayList<>(continuations.size());
    for (WorkContinuation continuation : continuations) {
        parents.add((WorkContinuationImpl) continuation);
    }

    return new WorkContinuationImpl(mWorkManagerImpl, null, ExistingWorkPolicy.KEEP, 
                                    Collections.singletonList(work), parents);
    }
}
```

先跳過CombineContinuationsWorker的部分，直接往下看。在這看到外面傳入的WorkChain1和WorkChain2被放入`parents`，然後包到一個新的WorkContinuationImpl內。簡單列出結構如下：

```java
WorkContinuationImpl {
    CombineContinuationsWorker, 
    parents = [
    	WorkChain1,
        WorkChain2
    ]
}
```

從前面的介紹可以知道，`parents`會先被執行，所以WorkChain1和WorkChain2會分別跑一次前面介紹的流程，然後開始同步從頭執行。

不過因為是同步，所以不能保證Worker鏈執行的順序，只有Worker鏈中的Worker會依照順序執行。

最後執行完兩個Worker鏈，才會再執行CombineContinuationsWorker：

```Java
// In CombineContinuationsWorker
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public class CombineContinuationsWorker extends Worker {
    @Override
    public @NonNull WorkerResult doWork() {
        setOutputData(getInputData());
        return WorkerResult.SUCCESS;
    }
}
```

並沒有做什麼事，純粹只是一個為了符合整體架構，同時又可以統整Worker鏈的輸出。當然，`combine()`還是有衍伸的函示，可以自行輸入WorkRequese，來調整整合上游結果的方式。

