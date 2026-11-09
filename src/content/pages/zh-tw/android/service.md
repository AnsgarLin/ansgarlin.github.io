---
title: "Service"
updated: "2019-04-04"
---
## What
可以在背景執行操作並且不用提供ＵＩ界面的組件
在main thread中執行，所以需要注意卡畫面或是用其他thread分離耗時的操作

## How
在manifest宣告service，name一定要填，指定啟用的service時使用
實作onStartCommand(startService)和onBind(bindService)
bindService時給予ServiceConnectedListener，可以接受到一個IBinder為Service的instance，因此可以直接對Service做操作

## 禁用其他application
設定exported為false

## 生命週期
onCreate (startService) -> onStartCommand -> onDestroy (stopService)
onCreate (bindService) -> onBind -> onUnbind (unbindService) -> onDestroy (stopService)
onCreate (startService) -> onStartCommand -> onBind (bindService) -> onUnbind (unbindService) // Service will stay alive
如果有實作onStartCommand，則必須主動關閉service

## 使用UnRebind
實作onUnBind要傳回true

## Ref.
http://www.cnblogs.com/yejiurui/p/3429451.html
http://blog.csdn.net/guolin_blog/article/details/11952435

## Summary
沒有UI的操作物件，預設在main thread中執行，所以如果要執行長時間任務，需要自行建立thread。有分三種Service：區域、遠端和全域。區域就是在同一個process內，遠端就是在其他process，全域就是使用intent的方式呼叫執行的。實作的方法由啟動方式決定，分為startService和bindService，兩者皆需要和stopService或unbindService成對出現，並且實作onStartCommand或是onBind和onUnBind Service銷毀方式也不同，startService會經由呼叫stopSelf停止並銷毀，bindService只要沒有任何一個bind就會銷毀，除非bind之前有先用startService啟用。另外，由於Service設計就是用來處理一些長時間的任務，所以她必須要有個回復機制，也依照啟用方式分成兩種，startService的需要在onStartCommand回傳STICKY(全新重啟)、NO_STICKY(條件式重啟)和REDILIVERY(完全重啟)；而bind的則要在bindService時，以AUTO_CREATE設定。
