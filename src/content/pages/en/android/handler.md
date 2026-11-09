---
title: "Handler"
updated: "2019-04-04"
---
## Update UI with handler
1. Activity 建立時會產生自己的一個 mLooper 來做無限循環監聽 msgQueue
2. 使用者建立新mHandler 來預置更新 UI 的動作，由於new Handler時會call Looper.myLooper來取得當前thread 的Looper，因此會綁定在 mLooper
3. 使用者建立新thread ，並使用 mHandler.sendMessage 傳送訊息msg
4. sendMessage 會走到 sendMassageAtTime， mHandler 和msg 會在此相互綁定，並透過 enqueueMessage 放入msgQueue 中
5. mLooper 會將 msg拉出來，並取出其中的 mHandler 並執行mHandler.handleMessage
6. 由於此時handleMessage 的 caller為 Activity 的looper ，也就是處於UI thread 下，這樣就可以進行更新UI的動作

## Summary
Handler持有looper，looper會有一個messageQueue，messageQueue有多個message。設定IdleHandler可以在MeesageQueue裡的東西還沒必要執行時，在中間的空閑時間啟動，並依照回傳值決定是否要再繼續執行，也可以用來在message處理完時作為結束looper的方式。looper結束可以用quit結束，會無法再送入訊息，並且會將佇列裡的全數刪除，如果是quitSafely則只是丟棄時間點還沒到的message。一個thread只會有一個looper且不能重複使用，所以當一個thread或looper停止後，就得再重新打開才可使用。
Handler可以處理任務訊息和一般訊息，任務訊息會直接執行，而一般訊息在message有設定callback時可以做兩層處置，並依照callback的回傳結果決定是否要繼續執行handler本身的handleMessage，message是否需要被處理是依照其設定的時間點。