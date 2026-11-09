---
title: "Context"
updated: "2019-04-04"
---
## What
可以說適應用程式的運行環境，提供應用層級的街口，和提供各種環境變數
子類分為ContextWrapper，單純提供外殼，所有操作會再call回Context，也就是ContextImpl，是Context的實作類

## Extend Type
Application、service和activity，所以一個應用裡會有application * 1 + service count + activity count的context
Activity因為有畫面，所以會比另外兩個多了一層ContextThemeWrapper

## Flow
所有ContextWrap類型的子類啟用時，會用attachBaseContext來指定BaseContext，也就是ContextImpl，如此使

## Limitaion
所有類型的Context都會回call ContextImpl，所以再平常可以交互使用，唯獨在特殊情況，需要注意Context所屬的前後關係
例如Dialog需要Activity才能啟動，一個Activity需要另一個Activity啟動才可作返回
不建議用Application/ServiceContext去建立ActivityContext，因為沒有UI的context並不會有task stack，所以會報錯，必須設定FLAG_ACTIVITY_NEW_TASK去讓Activity自己產生一個task stack
在Application/ServiceContext去inflate layout的話，會直接採用預設的設定，自訂的不一定會被使用，因此跟UI有關的都應該用ActivityContext

## Get
View.getContext是會取得ActivityContext
Activity.getApplicationContext取得ApplicationContext，通常要引用Context時建議以這為主

## getApplication vs getApplicationContext
兩者相同，差別在可在哪裡被呼叫，getApplication僅限於Activtiy和Service中使用

## Usage
優先使用ApplicationContext
不要用ActivityContext去處理life cycle較長的物件
不要在Activity內使用anoymous inner class，因為其有隱式reference外部class，所以會讓activtiy可能無法被刪除
不要讓Activity內的物件和變數，或是任何和ActivityContext相關的，讓一個靜態變數引用，也會讓activtiy可能無法被刪除

## Summary
應用程式的運行環境，提供應用層級的接口和環境變數，子類分為ContextWrapper和ContextImpl，ContextWrapper只是Context的一層包裝，存有一個Context，其實就是ContextImpl，用於實作各個在Context定義好的接口，會在ContextWrapper的子類：ContextThemeWrapper(Activity)、Service和Application被宣告時產生。一個Application所包含的Context可以等於Activity加上Service數量加一。在使用Context操作時需要注意層級的關係，例如Activity需要另一個Activity才可以啟動。另外不建議用Application和Service的Context建立Activity，因為其沒有task stask，除非設定了new task不然會在startActivity時報錯；與之相同，也不要用這兩個去inflate layout。建議上會盡量去使用ApplicationContext，因為其lifecycle較長。
