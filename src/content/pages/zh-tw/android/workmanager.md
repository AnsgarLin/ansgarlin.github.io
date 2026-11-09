---
title: "WorkManager"
updated: "2019-04-04"
---

WorkManager用於處理必須要被執行的任務，例如檔案傳輸，代表即使app被強制關閉，也會在下次開啟時被重新執行。除此之外，WorkManager也有給予設定任務執行條件的空間，讓任務可以在適當的時機啟動。

WorkManager並不是用來取代AsyncTask這些原本用於處理背景任務的類別，所以如果app關閉就可以不用執行的任務，就不適用於WorkManager。

### 基本使用

使用WorkManager有幾個基本步驟，以下透過[官方文件](https://developer.android.com/topic/libraries/architecture/workmanager)內的範例依序列出：

#### 定義Worker

自訂一個Worker類別，並繼承Worker。覆寫`doWork()`來實作要在背景執行的任務，

```java
public class CompressWorker extends Worker {
    @Override
    public Worker.WorkerResult doWork() {

        // Do the work here--in this case, compress the stored images.
        // In this example no parameters are passed; the task is
        // assumed to be "compress the whole library."
        myCompress();

        // Indicate success or failure with your return value:
        return WorkerResult.SUCCESS;

        // (Returning RETRY tells WorkManager to try this task again
        // later; FAILURE says not to try again.)
    }
}
```

#### 建立WorkRequest

Android提供兩種類型的WorkRequest：

- OneTimeWorkRequest：用於執行一次的任務
- PeriodicWorkRequest：用於重複執行的任務

這裡我們選用OneTimeWorkRequest比較單純：

```java
OneTimeWorkRequest compressionWork = OneTimeWorkRequest.from(CompressWorker.class)
```

#### 交由WorkManager

```java
WorkManager.getInstance().enqueue(compressionWork)
```

WorkManager會在其認為適當的時機執行，如果指定須滿足的特殊條件(constraints)，通常會立即執行。