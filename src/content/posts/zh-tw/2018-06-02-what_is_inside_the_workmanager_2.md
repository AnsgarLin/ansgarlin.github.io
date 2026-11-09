---
title: "What is inside the WorkManager - Part 2"
date: "2018-06-02"
---

在Part1介紹了WorkManager基本的運作流程，和其背後如何實作。在閱讀分析的過程中，不免會產生一些疑問，於是接下來的章節將著重在點出幾個可能的問題，並提供解答。

### When dose the WorkManager be initialized?

在看Part1的時候，會發現使用到的Executor、WorkSpec資料庫，甚至是WorkManager的instance，似乎都是在使用WorkManager進行任務排程時就已經存在。這代表WorkManager的初始化流程，必定發生更早之前，透過系統直接完成。

從Part1可以知道，WorkManager的函式都會交由WorkManagerImpl實作，所以為了找到初始化源頭，以下直接從WorkManagerImpl的初始化開始。

透過instance第一次被設值的位置，我們找到`initialize()`：

```Java
// In WorkManagerImpl
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public static void initialize(@NonNull Context context, @NonNull Configuration configuration) {
    ...
    sDefaultInstance = new WorkManagerImpl(context, configuration);
    ...
}
```

再看到WorkManagerImpl的constructor：

```Java
// In WorkManagerImpl
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public WorkManagerImpl(@NonNull Context context, @NonNull Configuration configuration, boolean useTestDatabase) {
	...
    mWorkDatabase = WorkDatabase.create(context, useTestDatabase);
    mTaskExecutor = WorkManagerTaskExecutor.getInstance();
    mProcessor = new Processor(...);
    ...
}
```

看到Executor、WorkSpec資料庫都在這裡被初始化，於是確定`WorkManagerImpl.initialize()`是整串初始化的盡頭。

找到盡頭後就可以往回追朔，並找到觸發的起點。首先如預期的回到WorkManager：

```java
// In WorkManager
public static void initialize(@NonNull Context context, @NonNull Configuration configuration) {
    WorkManagerImpl.initialize(context, configuration);
}
```

再往回走，直接進到WorkManagerInitializer：

```Java
// In WorkManagerInitializer
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public class WorkManagerInitializer extends ContentProvider {
    @Override
    public boolean onCreate() {
        // Initialize WorkManager with the default configuration.
        WorkManager.initialize(getContext(), new Configuration.Builder().build());
        return true;
    }
    ...
}
```

很明顯的，WorkManager是透過ContentProvider的機制初始化的。在這不仔細提ContentProvider的初始化流程，簡言之在App初始化並開啟的過程中，會走到`ContentProvider.attachInfo()`：

```Java
// In ContentProvider
private void attachInfo(Context context, ProviderInfo info, boolean testing) {
    ...
    if (info != null) {
        setReadPermission(info.readPermission);
        setWritePermission(info.writePermission);
        setPathPermissions(info.pathPermissions);
        mExported = info.exported;
        mSingleUser = (info.flags & ProviderInfo.FLAG_SINGLE_USER) != 0;
        setAuthorities(info.authority);
    }
    ContentProvider.this.onCreate();
}
```

最後呼叫到`onCreate()`，以WorkManager為例就是`WorkManagerInitializer.onCreate()`，並由ProviderInfo提供相關的設定。此函式會在完成啟動程序前執行，才可以於之後的App執行期間直接使用。

#### What's more

##### ProviderInfo

看到這就會好奇，用來提供ContentProvider設定的ProviderInfo是哪裡來的？回到App初始化流程中，一定會有需要解析AndroidManifest.xml的時候，於是會走到`PackageParser.parseProvider()`：

```Java
// In PackageParser
private Provider parseProvider(Package owner, Resources res, XmlResourceParser parser, int flags, String[] outError, CachedComponentArgs cachedArgs) throws XmlPullParserException, IOException {
    TypedArray sa = res.obtainAttributes(parser, 
    	com.android.internal.R.styleable.AndroidManifestProvider);
    	
    if (cachedArgs.mProviderArgs == null) {
        cachedArgs.mProviderArgs = new ParseComponentArgs(owner, outError, ...);
        cachedArgs.mProviderArgs.tag = "<provider>";
    }
    cachedArgs.mProviderArgs.sa = sa;
    cachedArgs.mProviderArgs.flags = flags;
    Provider p = new Provider(cachedArgs.mProviderArgs, new ProviderInfo());
    if (outError[0] != null) {
        sa.recycle();
        return null;
    }
}
```

在這表示會從AndroidManifest.xml內爬出指定ContentProvider的內容，然後透過Provider的constructor包入ProviderInfo。

但我們在使用WorkManager時，並不需要在AndroidManifest.xml做額外設定。而打開最後編譯出來的apk，在AndroidManifest.xml內就會有設定WorkManagerInitializer為ContentProvider的片段，代表一定是被放進去的。

所以實際上的設定在哪裡？這裡得感謝Google是一崇尚開源軟體的公司，所以MvnRepository上可直接找到WorkManager的[aar](https://mvnrepository.com/artifact/android.arch.work/work-runtime/1.0.0-alpha02)。

下載後透過AS打開並找到AndroidManifest.xml，就可以看到以下片段：

```Java
<provider
    android:name="androidx.work.impl.WorkManagerInitializer"
    android:authorities="${applicationId}.workmanager-init"
    android:exported="false"
    android:multiprocess="true" />
```

到此，我們就知道WorkManager被初始化的地點和時機，以及如何被預載到Project之中以供我們使用。

### What's more

#### Processor

還記得Part1時，有提到透過Processor的Executor所執行的Runnable，都會在不同的Thread上執行嗎？原因可以直接看回到WorkManageImpl的constructor：

```Java
// In WorkManagerImpl
@RestrictTo(RestrictTo.Scope.LIBRARY_GROUP)
public WorkManagerImpl(@NonNull Context context, @NonNull Configuration configuration, 
boolean useTestDatabase) {
	...
    mProcessor = new Processor(context, mConfiguration, mWorkDatabase, getSchedulers(), 
                               configuration.getExecutor());
    ...
}
```

看到Executor是由Configuration產生：

```Java
// In Configuration
private Configuration(@NonNull Configuration.Builder builder) {
    if (builder.mExecutor == null) {
        mExecutor = createDefaultExecutor();
    } else {
        mExecutor = builder.mExecutor;
    }
    mMinJobSchedulerId = builder.mMinJobSchedulerId;
    mMaxJobSchedulerId = builder.mMaxJobSchedulerId;
    mMaxSchedulerLimit = builder.mMaxSchedulerLimit;
}

public @NonNull Executor getExecutor() {
    return mExecutor;
}
```

根據前面WorkManagerInitializer，我們知道目前這個Configuration在透過Builder被建立時，Builder的Executor是空的，所以Executor會透過`createDefaultExecutor()`產生：

```javascript
// In Configuration
private Executor createDefaultExecutor() {
    return Executors.newFixedThreadPool(
        Math.max(2, Math.min(Runtime.getRuntime().availableProcessors() - 1, 4)));
}
```

於是Processor就會得到一個至少2條，最多4條Thread的Executor。