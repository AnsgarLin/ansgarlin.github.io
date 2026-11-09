---
title: "Executor"
updated: "2019-04-04"
---
協助控制thread開關的框架，搭配線城池和任務佇列的使用，可以確保任務的起始，並且在需要時取得執行結果。

# ThreadPoolExecutor
ThreadPoolExecutor -> ExecutorService -> Executor
## 預設
有分成三種類型：固定執行緒、動態執行緒和單執行緒。固定執行緒代表在建立時可以指定最多幾條執行緒，並且使用的是上限為Integer.MAX容量的佇列；動態執行緒代表所有執行緒都是短期的，在等待60秒沒有新任務，閒置的執行緒就會被銷毀。

## 建立
可以設定的參數主要有以下六種：核心執行緒數量、最大執行緒數量、最大閒置時間、任務佇列類型、ThreadFactory和RejectExecutionHandler。
核心執行緒數量會決定Thread Pool內執行緒數量的下限。如果在任務加入時執行緒數量小於核心數，就會新增執行緒；反之則會等到任務佇列滿了才新增。
最大執行緒數量會決定Thread Pool內執行緒數量的上限。
最大閒置時間會決定除了核心執行緒外，其他執行緒閒置多久就將被停止並回收；如果設成0，則執行緒會與thread pool一起回收
任務佇列類型可以決定是否是有限數量的BlockingQueue。
ThreadFactory可以在新增執行緒時，做一些額外的設定。
RejectExecutionHandler則是在任務因為Thread Pool被關閉或是佇列滿時，將被拒絕送入佇列的任務做最後處理。

## 自訂
繼承ThreadPoolExecutor，可以透過beforeExecute、afterExecute和terminated來在thread pool處於各種狀態時做額外處置。

## 關閉
可透過使用shutdown和shutdownNow關閉thread pool，shutdown會拒絕新任務，並將剩下的任務處理完畢；shutdownNow不只拒絕任務，且會停止所有目前的任務，並回傳一個任務清單，讓這些任務有機會轉到其他的thread上。

## 執行緒數量
應依照CPU核心數為基準做決定，如果核心數為N，則最佳的執行緒上限則為N+1或是2N。

## 使用陷阱
1. 使用allowCoreThreadTimeOut
會使得核心執行緒也可以回收，導致核心執行緒可能會處於一直新增的狀態，造成不必要的效能浪費。
2. 預載在佇列中的任務無法執行
由於thread pool預設是在新增任務時才新增執行緒，所以預載的任務將無法自動執行，可以透過使用prestartAllCoreThread或是prestartCoreThread來開啟核心執行緒執行預設的任務。
3. 零核心執行緒
核心執行緒設置成0，基於核心執行緒在大於等於設定值，則需要等佇列滿才會新增執行緒的規則，可能會使得任務將不會被啟動而閒置到佇列滿為止。

## 任務提交
任務可以分成Runnable或是Callable兩種，差別在於Runnable沒有回傳直，而Callable有。
提交分為個別提交和群發兩種，提交後可以得到Future類的參數回傳，可以透過此參數取得結果或是取消任務，Runnable的任務取得結果會永遠是unll
個別提交的話可透過submit，而群發又可以分成invokeAll和invokeAny兩種。
invokeAll非阻塞的呼叫，會得到一個Future類的清單，可以透過Future.get依序進行組塞式呼叫來取得結果。
invokeAny為阻塞的呼叫，其內透過使用ExecutorCompletionService，可以將做完的任務存放在佇列中等待取用。利用無線迴圈，在發出下一個任務同時也確認是否也任何一個任務完成後，如果有則直接回傳結果，並用cancel結束其他任務。

## SUMMARY
ThreadPoolExecutor預設提供固定執行緒、動態執行緒和單執行緒，固定執行緒需要在建立時提供數量，則在使用過程中會永遠保持固定量的執行緒，動態執行緒則是會在執行緒閒置60秒後自動回收。
透過參數可以建立不同類型的ThreadPoolExecutor：核心執行緒可以決定thread pool在執行過程中的最小執行緒數量，最大執行緒數量可以限制執行緒在固定數量內，最大閒置時間可以決定在執行緒閒置多久時會被回收。
任務佇列類型可以決定是否需要有限數量的類型，ThreadFactory可以在thread被建立時另外修改thread的設定，RejectExecutionHandler可以在任務被拒絕加入佇列時進行額外的處置。
繼承ThreadPoolExecutor可以進一步的在thread執行的前後和thread pool被回收前做額外處置。
關閉thread pool可以透過shutdown和shutdownNow完成，兩者皆會開始拒絕任務加入，差別在shutdown會繼續完成剩下的任務，而shutdownNow則是中斷所有任務。
Thread pool接受的任務類型有分成Callable和Runnable，Callable可以有回傳值，反之Runnable則永遠都回傳null。
任務提交的方式有單發和群發：單發是使用submit，而群發則是用invokeAll和invokeAny，submit和invokeAll，都會取得Future類型的回傳，可以呼叫get阻塞程序來等帶回傳值；
invokeAny則是透過使用ExecutorCompletionService，讓任務完成時會把結果存放在結果佇列中。透過使用迴圈，在發出下一任務同時也會確認是否已經有結果存在於結果佇列，有的話會直接取出回傳，並將其他的已經啟動的任務cancel。