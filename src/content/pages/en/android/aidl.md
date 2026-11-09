---
title: "AIDL (Android Interface Definition Language)"
updated: "2019-04-04"
---
## What
主要用於做不同Application、或是multi-thread溝通
如果只是在同一Application，官方建議使用service直接實作一個binder(等於回傳自己)，Local Service
如果是不同一個Application，但不用multi-thread，官方建議使用Messenger來產生binder

## How
先實作介面.aidl -> 系統自動生成interface -> 在service實作代理interface -> 在service onBind回傳interface實體
如果client會和server不同application，需要確保兩邊都有相同的aidl文件，才可編譯通過

## 非同步
http://givemepass.blogspot.tw/2015/11/aidl_27.html

## Ref
http://tedforum.blogspot.tw/2014/03/android-service-aidl.html
http://www.cnblogs.com/TerryBlog/archive/2010/08/24/1807605.html

## Summary
AIDL是Android裡面實作不同process交互溝通的方式，首先要實作aidl定義溝通的介面，IDE會自動生成所需的.java，接著繼承service來實作一inner class繼承interface.stub的公開操作，並設定再onBind實回傳此inner class的instance，客戶端接到後會使用asInterface取得其中的proxy，並透過proxy與server溝通。當使用者調用操作後，會call到proxy裡面進行封裝動作，然後呼叫transact，將資料往底層的Binder框架送去，Binder會進行資料傳送的動作，最後在呼叫server的onTransact裡面進行重組，才進行實際上的處置，最後將結果塞回當初一起跟過來的參數_reply，使用者在另一邊會block住直到這個操作return，取得結果。所以為了防止block的狀況，可以設定interface是oneway，這樣client呼叫操作後就會繼續執行其他任務，但同時也需要實作一個interface，並當成server端公開操作的參數傳給server，才可以讓server在處理任務完成時，主動以此callback傳回結果
