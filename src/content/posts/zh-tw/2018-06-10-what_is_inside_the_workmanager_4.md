---
title: "What is inside the WorkManager - Part 4"
date: "2018-06-10"
---

就如Google在IO大會上所說，WorkManager用於處理要被確保執行的任務，所以免不了的需要提供一些方式，讓Worker可以在狀況允許時重新啟動。例如在傳遞檔案時遭遇斷線或是低電量時，WorkManage可以在網路恢復或是充電狀況下，直接執行該執行的Worker。

透過設定Constraints，WorkManager可以達到預期的效果。

### How dose the Constraints work?

一樣的從簡單的使用範例出發，首先先以在充電下進行為條件建立Constraints：

```Java
Constraints myConstraints = new Constraints.Builder().setRequiresCharging(true).build();
```

Constraints的constructor很簡單，只是記錄條件設定的狀態：

```Java
// In Constraints
private Constraints(Builder builder) {
    mRequiresCharging = builder.mRequiresCharging;
    ...
}
```

接著就是透過WorkRequest存放在WorkSpec裡面：

```Java
OneTimeWorkRequest compressionWork = new OneTimeWorkRequest.Builder(CompressWorker.class)
    .setConstraints(myConstraints)
    .build();

// In WorkRequest
public B setConstraints(@NonNull Constraints constraints) {
    mWorkSpec.constraints = constraints;
    return getThis();
}
```

接著這個`constraints`會在哪裡被使用呢？在WorkSpec中只有一個函式`hasConstraints`會使用到。接著追朔使用這函式的位置，則會找到`GreedyScheduler.schedule()`：

```Java
// In GreedyScheduler
@Override
public synchronized void schedule(WorkSpec... workSpecs) {
    int originalSize = mConstrainedWorkSpecs.size();

    for (WorkSpec workSpec : workSpecs) {
        ...
        if (workSpec.hasConstraints()) {
        	...
            mConstrainedWorkSpecs.add(workSpec);
        } else {
            mWorkManagerImpl.startWork(workSpec.id);
        }
    }

    if (originalSize != mConstrainedWorkSpecs.size()) {
        mWorkConstraintsTracker.replace(mConstrainedWorkSpecs);
    }
}
```

如果WorkSpec設有Constraints，則此WorkSpec就不會被執行。而是傳給WorkConstraintsTracker，再傳給其所擁有的ConstraintController：

```Java
// In WorkConstraintsTracker
public void replace(@NonNull List<WorkSpec> workSpecs) {
    for (ConstraintController controller : mConstraintControllers) {
        controller.replace(workSpecs);
    }
}
```

以下可透過WorkConstraintsTracker的constructor得知其擁有哪些ConstraintController：

```Java
// In WorkConstraintsTracker
public WorkConstraintsTracker(Context context, @Nullable WorkConstraintsCallback callback) {	
    ...
    mConstraintControllers = new ConstraintController[] {
            new BatteryChargingController(appContext, this),
            ...
    };
}
```

由於範例設定的條件是在手機充電時，所以前面的`controller.replace()`，就是`BatteryChargingController.replace()`。

為了之後分析上流暢，在這先看一下BatteryChargingController的constructor：

```Java
// In BatteryChargingController
public BatteryChargingController(Context context, OnConstraintUpdatedCallback callback) {
	super(Trackers.getInstance(context).getBatteryChargingTracker(), callback);
}
```

所以外面的WorkConstraintsTracker變成這邊的`callback`，並透過靜態類別Trackers拿到對應的Tracker。

Trackers會在建立的階段初始化所有會被用到的Tracker：

```java
// In Trackers
private Trackers(Context context) {
    ...
    mBatteryChargingTracker = new BatteryChargingTracker(appContext);
    ...
}
```

再回到`BatteryChargingController.replace()`，由於BatteryChargingController沒有複寫這函示，所以是`ConstraintController.replace()`：

```Java
// In ConstraintController
public void replace(@NonNull List<WorkSpec> workSpecs) {
    mMatchingWorkSpecIds.clear();

    for (WorkSpec workSpec : workSpecs) {
        if (hasConstraint(workSpec)) {
            mMatchingWorkSpecIds.add(workSpec.id);
        }
    }

    if (mMatchingWorkSpecIds.isEmpty()) {
        mTracker.removeListener(this);
    } else {
        mTracker.addListener(this);
    }
    updateCallback();
}
```

這邊首先會用`hasConstraint()`，也就是`BatteryChargingController.hasConstraint()`，來判斷WorkSpec是否有設置對應的`constraints`。

有則將符合條件的WorkSpec的Id存起來，並將BatteryChargingController透過`addListener()`傳入`mTracker`。

到這，我們可以簡單總結一下WorkConstraintsTracker的結構：

```Java
WorkConstraintsTracker {
    BatteryChargingController {
        mTracker = BatteryChargingTracker {
            listener = (BatteryChargingController)
        }
        callback = (WorkConstraintsTracker)
    }
}
```

接著，BatteryChargingTracker本身和其父類BroadcastReceiverConstraintTracker並沒有複寫`addListener()`，所以直接看到最上層父類ConstraintTracker：

```Java
// In ConstraintTracker
public void addListener(ConstraintListener<T> listener) {
    ...
	startTracking();
    ...
}
```

看到`startTracking`：

```Java
// In BroadcastReceiverConstraintTracker
@Override
public void startTracking() {
    ...
    mAppContext.registerReceiver(mBroadcastReceiver, getIntentFilter());
}
```

很明顯的，這代表當手機接受充電時，會發出一個Broadcast，而這邊則註冊了Receiver來接收：

```Java
// In BroadcastReceiverConstraintTracker
private final BroadcastReceiver mBroadcastReceiver = new BroadcastReceiver() {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null) {
            onBroadcastReceive(context, intent);
        }
    }
};
```

到這邊，就可以確定開始監聽手機充電的狀態，也可以帶出一個觀念：

- **整個Constraints的機制的啟動，並不是在設定Constraints的時候；而是在執行`enqueue`，且WorkSpec即將透過Scheduler進入排程的時候。**

所以當收到手機充電的Broadcast後，會直接呼叫`onBroadcastReceive()`，此函式則在BatteryChargingTracker中實作：

```Java
// In BatteryChargingTracker
@Override
public void onBroadcastReceive(Context context, @NonNull Intent intent) {
    ...
    switch (action) {
        case BatteryManager.ACTION_CHARGING:
            setState(true);
            break;
            ...
    }
}
```

不論是何種狀況，都會走到`setState()`，記錄充電狀態後，透過listener，也就是BatteryChargingController回傳：

```Java
// In BatteryChargingTracker
public void setState(T newState) {
    ...
    mCurrentState = newState;
    for (ConstraintListener<T> listener : mListeners) {
        listener.onConstraintChanged(mCurrentState);
    }
}
```

不過`onConstraintChanged`的實作是在ConstraintController：

```Java
// In ConstraintController
@Override
public void onConstraintChanged(@Nullable T newValue) {
    mCurrentValue = newValue;
    updateCallback();
}
```

一樣紀錄當前狀態，在走到`updateCallback()`，透過`mCallback`，也就是WorkConstraintsTracker，往外回傳已經滿足條件的WorkSpec的Id：

```Java
// In ConstraintController
private void updateCallback() {
    ...
    mCallback.onConstraintMet(mMatchingWorkSpecIds);
}

// In WorkConstraintsTracker
@Override
public void onConstraintMet(@NonNull List<String> workSpecIds) {
	...
    for (String workSpecId : workSpecIds) {
        if (areAllConstraintsMet(workSpecId)) {
            unconstrainedWorkSpecIds.add(workSpecId);
        }
    }
    if (mCallback != null) {
        mCallback.onAllConstraintsMet(unconstrainedWorkSpecIds);
    }
}
```

這裡會再次確認並拿出已經滿足條件的WorkSpec的Id，再透過callback傳回去。一般來說，這裡的`mCallback`會是GreedyScheduler，所以這些Id會再經由`startWork()`重新進入執行的流程中：

```Java
// In GreedyScheduler
@Override
public synchronized void onAllConstraintsMet(@NonNull List<String> workSpecIds) {
    for (String workSpecId : workSpecIds) {
        ...
        mWorkManagerImpl.startWork(workSpecId);
    }
}
```

到這分析完從建立Constraints，到如何被執行的流程。主要流程可以簡化如下：

* 建立Constraints
* 建立Worker，與Constraints一起當成參數建立WorkerRequest，並透過Worker建立WorkSpec。
* 將WorkSpec放入資料庫。
* 使用BroadcastReceiver啟動監聽程序。
* 收到Broadcast後取出WorkSpec。
* 重新使用WorkSpec來執行Worker。
