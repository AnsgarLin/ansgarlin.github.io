---
title: "IntentService"
updated: "2019-04-04"
---
## What
Service的子類，執行完後自己結束，擁有自己的Thread和Looper，並在執行完後會關閉

## How
用HandlerThread建立自己的執行緒，並將thread的looper指定給handler，在handler內執行stopself，onBind回傳null
實作onHandleIntent來執行任務

## HandlerThread
一個android的class，替使用者包裝好thread和啟用所需的looper

## Ref.
http://techtej.blogspot.tw/2011/03/android-thread-constructspart-4.html
http://androidxref.com/5.0.0_r2/xref/frameworks/base/core/java/android/app/IntentService.java
 
## Summary
Service的子類，用HandlerThread建立自己的執行緒和Looper，並執行自己的Handler，開放一個call back onHandlerIntent來給使用者做額外的事情。執行完後會call selfQuit關閉。
