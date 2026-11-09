---
title: "Parcelable"
updated: "2019-04-04"
---
實作一writeToParcel來設計封裝的方式
實作static final的CREATOR來解包

## Service
1. 客戶端與service 綁定，取得一個有實作 interface IServiceImpl 的proxy ， service端的實作類 serviceImpl(實作相同Interface IServiceImpl)會與proxy綁定，但 local 操作是由proxy 執行，所以當客戶呼叫 serviceImpl 中的函式getStudentMap 時，等同 proxy. getStudentMap
2. proxy.getStudentMap 中會將輸入的參數透過 _data.writeInt 和Student.writeToParcel(_data) 來將資料序列化，存於_data
3. 呼叫serviceImpl.transact 並傳入 _data和 _reply
4. 此時已經在Service 中， serviceImpl.transact會再呼叫 onTransact ，將_data 解包，透過 readInt 和Student.createFromParcel 重組
5. 將重組後的參數再傳入 serviceImpl的 getStudentMap ，此時才是真正 service針對使用者輸入進行動作的地方
6. getStudentMap 的回傳值會被寫入 _reply 或是經由Student. writeToParcel(_reply)將資料序列化
7. 此時由於Java 是 call by reference，所以可以從當初傳出的 _reply直接取得service 操作後的結果，並依照型態read或createFromParcel 重組
8. 以生活情境來說，產品的提供商就是 Service ，經銷店就是Sertvice.stub ，經銷店的員工就是 Service.Stub.Proxy ，onTransact 操作過程如下：
	a. 使用者先與提供商（Service）聯絡，提供商會分派一個經銷店（ Stub ）的店員（Service.Stub.Proxy ）與使用者聯繫
	b. 使用者購買（呼叫 method），提出需求（method 參數）
	c. 店員將需求寫成訂購單（由 Proxy 端的method 封裝）
	d. 店員將訂購單後送至經銷店系統（ stub 解包處理並將結果封裝傳回）
	e. 店員取得封包解包再將結果傳回給使用者

## Activity(透過ActivityManagerService 啟用 Activity並傳遞 Parceable Intent)
1. Activity.startActivity -> Activity.startActivityForResult -> Instrumentation.execStartActivity
2. 在execStartActivity 中會調用 ActivityManagerNative.getDefault 來取得proxy(ActivityManagerProxy) 並與 ActivityManagerService綁定然後執行 ActivityManagerProxy .startActivity 綁定
http://grepcode.com/file/repo1.maven.org/maven2/org.robolectric/android-all/5.0.0_r2-robolectric-0/android/app/ActivityManagerNative.java#ActivityManagerNative.0gDefault

1. ActivityManagerProxy.startActivity中會進行intent的拆解(就是啟動activity時包入的intent)，接著呼叫ActivityManagerService. transact
2. 此時已經在ActivityManagerService 端， ActivityManagerService.transact 會呼叫ActivityManagerService. onTransact ，再呼叫到 ActivityManagerNative.onTransact
http://grepcode.com/file/repo1.maven.org/maven2/org.robolectric/android-all/5.0.0_r2-robolectric-0/android/app/ActivityManagerNative.java#121

1. onTransact中會將拆解後的intent資料重組並執行startActivity，也就是ActivityManagerService中的startService(因為ActivityManagerNative沒有實作IActivityManager.startActivity，則由繼承的ActivityManagerService實作)
http://grepcode.com/file/repo1.maven.org/maven2/org.robolectric/android-all/4.4_r1-robolectric-1/com/android/server/am/ActivityManagerService.java#2953
2. 到這邊收到的intent 就是啟動 Activity 的intent ，而 ActivityManagerProxy會從 reply 中收回result 。
3. http://blog.csdn.net/caowenbin/article/details/6036726
4. http://www.cnblogs.com/zhangxinyan/p/3487842.html
