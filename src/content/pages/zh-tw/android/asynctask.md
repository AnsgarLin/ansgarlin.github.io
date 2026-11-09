---
title: "AsyncTask"
updated: "2019-04-04"
---
## What
一個用來提供背景執行的功能，以及在完成任務時修改UI的組件
其依然不是設計來當作一般thread操作，所以不建議執行須要時間的任務，因為android目前預設是一次執行一個

## How
決定三個參數的型態：輸入，輸出，結果
實作onPreExecute、doInBackground和onPostExecute

## During
實作onProgressUpdate取得當前執行結果

## Cancel
執行cancel可以關閉AsyncTask，可以實作onCancel來取得當前執行的最後結果
執行cancel仍然會繼續執行doInBackground，但不會再執行onPostExecute
建議doInBackground的開頭需要以isCancel來確認AsyncTask是否被關閉了

## Task limit
佇列裡最高是128個，依照核心數可以再加上2 * N + 1(核心thread)，所以4核心總共有137個任務

## Synchronize
Android 3.2前，一次可以執行多個Task
Android 3.2後，一次只能執行一個，如果要同時多個，則要自訂threadpool去做

## Summary
AsyncTask用來將一些需要背景操作的片段切出，並提供可以再ui thread上執行的callback，使用上一定要實作doInBackground。在4.0版後執行上由平行(5)變成照順序，但使用者依然可以使用executeOnExecutor來決定要以何種形式執行任務。任務並行的執行量為核心數 * 2 + 1，加上佇列可以存128個，所以4核心總共可以接受137個任務。如要取消可以使用cancel(boolean)，會在doInBackground結束後，直接call onCancel(Result)讓使用者可以處理結果，最後onCancel結束，會建議使用cancel(true)，因為這樣不只判斷任務被cancel，還可以強制中斷當前thread。另外AsyncTask是用相同的Executor，不論是哪裡啟動，因為其預設的executor是，AsyncTask.SERIAL_EXECUTOR為一個static變數，也因此官方才不建議執行太長的任務，會請你改用service，因為你無法預期你的任務會被誰干擾。所以如果要實作非同步，需要自訂executor和thread pool。
