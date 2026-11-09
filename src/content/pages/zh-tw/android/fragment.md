---
title: "Fragment"
updated: "2019-04-04"
---
## What
在Activity中提供畫面的組件，不同於其他組件的是其有自己的生命週期，可以當成一種子Activtiy
由於是由Activity去產生Fragment，所以其生命週期是緊緊相扣的

## 新增
在layout.xml裡面新增，或是透過FragmentTransaction新增，並呼叫commit
使用beginTransaction-> fragmentTransaction.add -> commit套用

## 替換
所有曾被加入的fragment將會被銷毀然後再加入新的
使用beginTransaction -> replace new的Fragment -> pushToBackStack 記錄替換動作(以防使用者點選返回要回復上一狀態) -> commit套用

## 取得
用FragmentManager

## 和activity溝通
getActivty

## 和Fragment溝通
Broadcast或是透過activity的interface

## 沒call onDestroy
Fragment的onDestroy是由Activity啟用，但activity的onDestroy並沒有保證一定會被call或是執行完畢，因為activity的onDestroy和onStop是可以被中斷的，也就代表Fragment的onDestroy就不一定會被執行

## Summary
一個有提供畫面的組件，有自己的lifecycle。新增或刪除都需要使用beginTransaction來取得transaction，要注意的事replace會讓整個以經被加入的fragment銷毀。可用getActivity與activity溝通，或是用local service或是handler。由於Fragment的onDestroy跟activity綁在一起，而activity的onDestroy沒有保證一定會跑完，代表Fragment的onDestroy不一定會被呼叫。

## 生命週期
```
SampleFragmentActivity: onCreate
SampleFragmentActivity: onContentChanged
SampleFragment: onAttach
     SampleFragmentActivity: onAttachFragment
SampleFragment: onCreate
SampleFragment: onCreateView
SampleFragment: onActivityCreated (onCreate return)
SampleFragment: onViewStateRestored
     SampleFragmentActivity: onStart
SampleFragment: onStart
     SampleFragmentActivity: onPostCreate
     SampleFragmentActivity: onResume
SampleFragment: onResume
     SampleFragmentActivity: onPostResume
     SampleFragmentActivity: onAttachedToWindow
     SampleFragmentActivity: onCreateOptionsMenu
     SampleFragmentActivity: onPrepareOptionsMenu

SampleFragment: onPause
     SampleFragmentActivity: onPause
SampleFragment: onStop
     SampleFragmentActivity: onStop
SampleFragment: onDestroyView
SampleFragment: onDestroy
SampleFragment: onDetach
     SampleFragmentActivity: onDestroy
     SampleFragmentActivity: onDetachedFromWindow
```

## Ref
http://stackoverflow.com/questions/17195641/fragment-lifecycle-when-ondestroy-and-ondestroyview-are-not-called
