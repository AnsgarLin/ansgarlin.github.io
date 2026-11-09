---
title: "What is inside the WorkManager - Part 1"
date: "2018-05-23"
---
Google在Google I/O 2018大會上，公佈了WorkManager，用於處理要被確保執行的任務，例如檔案傳輸，並將其歸類在未來預設的架構內。

WorkManager並不是用來取代AsyncTask這些原本用於處理背景任務的類別，如果是app關閉就不需要的背景任務，就不適合用WorkManager實作。

本系列第一篇將著重在WorkManager的執行流程，如需要知道詳細的使用方式，可以直接參閱[官方文件](https://developer.android.com/topic/libraries/architecture/workmanager)。

以下將從一個簡單的範例出發：

```java
WorkManager.getInstance().enqueue(OneTimeWorkRequest.from(Work.class));
```

### 執行流程

#### 建立WorkRequest

首先從`OneTimeWorkRequest.from()`取得一個OneTimeWorkRequest的List，用目前的範例程式碼來看，List內只會有一個OneTimeWorkRequest。

原始碼內的OneTimeWorkRequest沒有多少內容，直接看到其繼承的WorkRequest：

```java
// In WorkRequest
protected WorkRequest(@NonNull UUID id, @NonNull WorkSpec workSpec, @NonNull Set<String> tags) {
    mId = id;
    mWorkSpec = workSpec;
    mTags = tags;
}
```

而不論WorkRequest，都是透過各自的Builder建立：

```java
// In OneTimeWorkRequest.Builder
public Builder(@NonNull Class<? extends Worker> workerClass) {
    super(workerClass);
    mWorkSpec.inputMergerClassName = OverwritingInputMerger.class.getName();
}

// In WorkRequest.Builder
public Builder(@NonNull Class<? extends Worker> workerClass) {
    mId = UUID.randomUUID();
    mWorkSpec = new WorkSpec(mId.toString(), workerClass.getName());
    addTag(workerClass.getName());
}
```

要注意的重點在於WorkSpec，其用於記錄各種參數，如id、執行狀態、延遲時間等等，同時也是屬於Room的model。

於是，在這要先點出一個重點：

* **在WorkManager的整個流程中，任何我們自訂的任務(Work)，都是以WorkSpec形式存在。**

透過WorkSpec的constructor，可知WorkSpec的至少會有的設定，就是UUID和外部傳入的Work類別，且預設就是ENQUEUED狀態：

```java
// In WorkSpec
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
@Entity(indices = {@Index(value = {"schedule_requested_at"})})
public class WorkSpec {
    private static final String TAG = "WorkSpec";
    public static final long SCHEDULE_NOT_REQUESTED_YET = -1;

    @ColumnInfo(name = "id")
    @PrimaryKey
    @NonNull
    public String id;
    
    @ColumnInfo(name = "state")
    @NonNull
    public State state = ENQUEUED;
    ...
}
```

#### 交由WorkManager

`WorkManager.getInstance()`取得的是WorkManagerImpl，所以`WorkManager.getInstance().enqueue()`其實是`WorkManagerImpl.enqueue()`：

```java
// In WorkManagerImpl
@Override
public void enqueue(@NonNull List<? extends WorkRequest> workRequests) {
    new WorkContinuationImpl(this, workRequests).enqueue();
}
```

WorkManagerImpl將baseWork，也就是前面的OneTimeWorkRequest list，一起包入WorkContinuationImpl：

```java
// In WorkContinuationImpl
WorkContinuationImpl(@NonNull WorkManagerImpl workManagerImpl, @NonNull List<? extends WorkRequest> work) {
    this(workManagerImpl, null, ExistingWorkPolicy.KEEP, work, null);
}

WorkContinuationImpl(@NonNull WorkManagerImpl workManagerImpl, String name, ExistingWorkPolicy existingWorkPolicy, @NonNull List<? extends WorkRequest> work, @Nullable List<WorkContinuationImpl> parents) {
    mWorkManagerImpl = workManagerImpl;
    mName = name;
    ...
    mWork = work;
    mParents = parents;
    mIds = new ArrayList<>(mWork.size());
    mAllIds = new ArrayList<>();
    ...
}
```

由最後走到的constructor，可以知道目前在WorkContinuationImpl內的變數，只有`mWorkManagerImpl`和`mWork`有值。**為了之後閱讀順暢，可以先將這些參數目前的狀態記著。**

回到正題，包入WorkContinuationImpl後，在走到`WorkContinuationImpl.enqueue()`：

```Java
// In WorkContinuationImpl
@Override
public void enqueue() {
    if (!mEnqueued) {
        mWorkManagerImpl.getTaskExecutor()
            .executeOnBackgroundThread(new EnqueueRunnable(this));
        } 
    ...
}
```

透過函式名稱，可以推測是透過mWorkManagerImpl取得的Executor，來將EnqueueRunnable放在背景執行。而在這，WorkContinuationImpl又會再被包入EnqueueRunnable：

```java
// In EnqueueRunnable
public class EnqueueRunnable implements Runnable {
    ...
    public EnqueueRunnable(@NonNull WorkContinuationImpl workContinuation) {
        mWorkContinuation = workContinuation;
    }
    ...
}
```

在這先描繪一下目前整個包裝的架構：

```java
EnqueueRunnable {
    WorkContinuationImpl {
        mWorkManagerImpl,
        mWork = [
            WorkRequest {
            	WorkSpec
            }
        ]
    }
}
```

#### 任務分配

承上，接著就是執行`EnqueueRunnable.run()`：

```java
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

接著要到重點流程了，首先會走到`addToDatabase()`：

```java
// In EnqueueRunnable
@VisibleForTesting
public boolean addToDatabase() {
    WorkManagerImpl workManagerImpl = mWorkContinuation.getWorkManagerImpl();
    WorkDatabase workDatabase = workManagerImpl.getWorkDatabase();
    workDatabase.beginTransaction();
    try {
        boolean needsScheduling = processContinuation(mWorkContinuation);
        workDatabase.setTransactionSuccessful();
        return needsScheduling;
    } finally {
        workDatabase.endTransaction();
    }
}
```

這裡從WorkManagerImpl取出一個WorkDatabase，可以推測就是用於存放WorkSpec，如此呼應與前面所說，WorkSpec是屬於Room的model。

由前一個程式碼片段知道此函式必須回傳true，才會走到`scheduleWorkInBackground()`。所以再深入看到`processContinuation()`：

```java
// In EnqueueRunnable
private static boolean processContinuation(@NonNull WorkContinuationImpl workContinuation) {
	boolean needsScheduling = false;
    List<WorkContinuationImpl> parents = workContinuation.getParents();
    if (parents != null) {
    	...
    }
    needsScheduling |= enqueueContinuation(workContinuation);
    return needsScheduling;
}
```

由前面WorkContinuationImpl剛建立時的狀態，可知`getParent()`必為null。於是直接看到`enqueueContinuation`：

```java
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

在走到`enqueueWorkWithPrerequisites()`，由於裡面進行很多處理，所以只列出以目前傳入的參數，沒有被跳過的主要部分：

```Java
// In EnqueueRunnable
private static boolean enqueueWorkWithPrerequisites(WorkManagerImpl workManagerImpl, @NonNull List<? extends WorkRequest> workList, String[] prerequisiteIds, String name, ExistingWorkPolicy existingWorkPolicy) {
    ...
    boolean needsScheduling = false;
    for (WorkRequest work : workList) {
        WorkSpec workSpec = work.getWorkSpec();
        ...
		workSpec.periodStartTime = currentTimeMillis;
        ...
        if (workSpec.state == ENQUEUED) {
            needsScheduling = true;
        }
        workDatabase.workSpecDao().insertWorkSpec(workSpec);
    }
    return needsScheduling;
}
```

到這看到一開始建立的OneTimeWorkRequest的WorkSpec被取出來，然後存入WorkSpec專屬的資料庫。

另外，因為WorkSpec預設狀態是ENQUEUED，所以這邊回傳的`needsScheduling`就是true。如此接回前面的程式碼，接著走到`scheduleWorkInBackground()`：

```java
// In EnqueueRunnable
public void scheduleWorkInBackground() {
    WorkManagerImpl workManager = mWorkContinuation.getWorkManagerImpl();
    Schedulers.schedule(
        workManager.getConfiguration(),
        workManager.getWorkDatabase(),
        workManager.getSchedulers());
}
```

這邊看到WorkManagerImpl透過`getSchedulers()`來取得適合的Scheduler：

```Java
// In WorkManagerImpl
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public @NonNull List<Scheduler> getSchedulers() {
    // Initialized at construction time. So no need to synchronize.
    if (mSchedulers == null) {
        mSchedulers = Arrays.asList(
                Schedulers.createBestAvailableBackgroundScheduler(mContext),
                new GreedyScheduler(mContext, this));
    }
    return mSchedulers;
}
```

Scheduler主要用於將收到的任務進行排程，並啟動執行任務的流程。

這邊`createBestAvailableBackgroundScheduler()`會取得SystemJobScheduler、FirebaseJobScheduler或是SystemAlarmScheduler其中一種。所以`getSchedulers()`至少會取得兩種Scheduler。

回到`schedule()`：

```Java
// In Schedulers
public static void schedule(@NonNull WorkDatabase workDatabase, List<Scheduler> schedulers) {
    WorkSpecDao workSpecDao = workDatabase.workSpecDao();
    List<WorkSpec> eligibleWorkSpecs = workSpecDao.getEligibleWorkForScheduling(
        configuration.getMaxSchedulerLimit());
    scheduleInternal(workDatabase, schedulers, eligibleWorkSpecs);
}
```

這邊先透過`getEligibleWorkForScheduling`從資料庫取得WorkSpec：

```SQL
@Query("SELECT * from workspec WHERE " + "state=" + WorkTypeConverters.StateIds.ENQUEUED 
       ...)
List<WorkSpec> getEligibleWorkForScheduling();
```

依照規則就是把所有狀態是ENQUEUED的WorkSpec取出，接著走到`scheduleInternal()`：

```Java
// In Schedulers
private static void scheduleInternal(@NonNull WorkDatabase workDatabase, List<Scheduler> schedulers, List<WorkSpec> workSpecs) {
    ...
    long now = System.currentTimeMillis();
    WorkSpecDao workSpecDao = workDatabase.workSpecDao();
    // Mark all the WorkSpecs as scheduled.
    // Calls to Scheduler#schedule() could potentially result in more schedules
    // on a separate thread. Therefore, this needs to be done first.
    workDatabase.beginTransaction();
    try {
        for (WorkSpec workSpec : workSpecs) {
            workSpecDao.markWorkSpecScheduled(workSpec.id, now);
        }
        workDatabase.setTransactionSuccessful();
    } finally {
        workDatabase.endTransaction();
    }
    WorkSpec[] eligibleWorkSpecsArray = workSpecs.toArray(new WorkSpec[0]);
    // Delegate to the underlying scheduler.
    for (Scheduler scheduler : schedulers) {
        scheduler.schedule(eligibleWorkSpecsArray);
    }
}
```
由於取得的Scheduler不只一個，所以在將WorkSpec交給Scheduler之前，需要在資料庫先標記成已經進入Scheduler的排程之中。這是因為系統中可能同時有多個Thread呼叫到`Schdulers.schedule()`，如此可以避免同一個WorkSpec被重複使用。

#### 任務排程

標記後就透過`Scheduler.schedule()`來傳入所有的WorkSpec，在這直接看`GreedyScheduler.schedule()`：

```Java
// In GreedyScheduler
@Override
public synchronized void schedule(WorkSpec... workSpecs) {
    int originalSize = mConstrainedWorkSpecs.size();

    for (WorkSpec workSpec : workSpecs) {
        if (workSpec.state == State.ENQUEUED && !workSpec.isPeriodic() &&
            workSpec.initialDelay == 0L) {
                ...
                mWorkManagerImpl.startWork(workSpec.id);   
            	...
        }
        ...
    }
}
```

由於我們的範例沒有設定任何起動條件，所以會直接走到`startWork()`：

```Java
// In WorkManagerImpl
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public void startWork(String workSpecId) {
    startWork(workSpecId, null);
}

@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public void startWork(String workSpecId, RuntimeExtras runtimeExtras) {
    mTaskExecutor.executeOnBackgroundThread(
        new StartWorkRunnable(this, workSpecId, runtimeExtras));
}
```

將WorkManagerImpl連同WorkSpec的id包進去一個StartWorkRunnable，並再度透過Executor執行後，Scheduler和EnqueueRunnable的任務就結束了。

#### 任務執行

理論上，在沒有其他任務的情況下，StartWorkRunnable應該會立即被執行，於是接著再看到`StartWorkRunnable.run()`：

```Java
// In StartWorkRunnable
public void run() {
    mWorkManagerImpl.getProcessor().startWork(mWorkSpecId, mRuntimeExtras);
}
```

裡面是透過Processor來呼叫`startWork()`，到這StartWorkRunnable的任務結束。

而Processor顧名思義，是用來執行任務的類別，並擁有自己的Executor。如此可推測以下兩件事：

* 在Processor內執行的Runnable任務，是執行在不同的Thread上。
* 一開始建立的Worker會在這裡實體化：

```Java
// In Processor
public synchronized boolean startWork(String id) {
    return startWork(id, null);
}

public synchronized boolean startWork(String id, RuntimeExtras runtimeExtras) {
    // Work may get triggered multiple times if they have passing constraints and new work with those constraints are added.
    if (mEnqueuedWorkMap.containsKey(id)) {
        ...
    }

    WorkerWrapper workWrapper = new WorkerWrapper.Builder(
        mAppContext, mConfiguration, mWorkDatabase, id)
            .withListener(this)
            .withSchedulers(mSchedulers)
            .withRuntimeExtras(runtimeExtras)
            .build();
    mEnqueuedWorkMap.put(id, workWrapper);
    mExecutor.execute(workWrapper);
    ...
}
```

這裡使用了WorkerWrapper再次將各種執行Worker所需要的參數打包，並透過Executor執行，於是直接看到`WorkerWrapper.run()`：

```Java
// In WorkerWrapper
@WorkerThread
@Override
public void run() {
    ...
    mWorkSpec = mWorkSpecDao.getWorkSpec(mWorkSpecId);
    ...
    if (mWorker == null) {
        mWorker = workerFromWorkSpec(mAppContext, mWorkSpec, input, mRuntimeExtras);
    }

    if (mWorker == null) {
        ...
        setFailedAndNotify();
        return;
    }
	...
	if (trySetRunning()) {
    	...
        Worker.Result result;
        try {
            result = mWorker.doWork();
        } catch (Exception | Error e) {
            result = Worker.Result.FAILURE;
        }
        
        try {
            ...
            State state = mWorkSpecDao.getState(mWorkSpecId);
            if (state == RUNNING) {
                handleResult(result);
            } 
            ...
        }
	...
}
```

如預期的，經過一連串防止重複執行的判斷後，就會依序執行以下幾個步驟：

* 透過`workerFromWorkSpec()`將WorkSpec轉換成Worker。
* 在`trySetRunning()`內將資料庫內的WorkSpec設定成RUNNING。
* 呼叫`doWork()`，也就是執行我們自訂的任務。
* 取得執行結果，呼叫`handleResult()`將資料庫內的WorkSpec設定成SUCCESS，還有執行相關的收尾操作。


### 總結

到這，我們完成了從Worker建立，到`doWork()`被執行的流程。整體可被簡化至以下幾個步驟：

* 建立Worker，並當成參數建立WorkerRequest，並透過Worker建立WorkSpec。
* 將WorkSpec放入資料庫。
* 在適當時機取出WorkSpec。
* 透過WorkSpec還原Worker。
* 執行Worker內的任務。

