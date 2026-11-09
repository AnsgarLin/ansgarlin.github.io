---
title: "Activity"
updated: "2019-04-04"
---
一個應用程式內提供畫面的組件，並且每個Activity都會有專屬的視窗。
應用程序會有一個主要的Activity，並與其他的一起放在同一個task stack中，但依照startActivity或manifest裡的設定，可以讓activity存在於不同stack

## Use
startActivity啟動activity
finish關閉activity

## Intent Filter
在manifest可以指定activity可接收什麼類型的intent，並依照action、category和type區分

## 取得回傳結果
用onActivityResult

## 交換資料
透過intent或是aidl

## 記錄狀態
用onSaveInstance(before onPause)和onRestoreInstance(before onResume)，因為不保證執行，所以只能做UI狀態保存

## 記錄資料
onPause

## 設定變更
如轉屏狀態，因為有時Activty需要重新取用不同的resource，所以會直接重開。但在manifest裡面設定好要處理的事件後就可以在onConfigurationChange裡面處理，而不會重新啟動

## 跨APP溝通
實作有aidl的service
http://blog.csdn.net/p106786860/article/details/17733223

## 生命週期
onCreate -> onStart -> onRestoreInstanceState -> onResume -> onSaveInstanceState - > onPause (visible) -> onStop (invisible) -> onDestory
            
## Summary
Activty負責應用程式的視圖部分，透過intent啟用，設定intent filter可以啟用不同的activity。使用Local Service、Messenger和AIDL可以讓Activtiy在不同process或物件內交互溝通。如果轉屏的話預設會事先Destroy原本的，再重新產生，因為有些resource需要重新讀取，但透過設定menifest可以指定在什麼情況下不要重開，而是再onConfigurationChanged裡面返回。

