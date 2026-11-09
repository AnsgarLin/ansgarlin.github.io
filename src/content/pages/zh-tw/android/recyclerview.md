---
title: "RecyclerView"
updated: "2019-04-04"
---

RecyclerView是Android support library內的一個物件，和ListView一樣，專門用於列表式的佈局。不同的是RecyclerView提供了更好的效率和回收機制。

### 使用方法

### What's more

#### 提升巢狀RecyclerView的效能

> 以下內容參考此篇文章：[Optimizing Nested RecyclerView](https://medium.com/@mgn524/optimizing-nested-recyclerview-a9b7830a4ba7)

RecyclerView為了提升畫面顯示的效率，使用了Pool的概念，讓已經建立但被移出畫面的View可以被放置在Pool內暫存。如此就可以達到重複使用，又不會頻繁的建立View，使整體滾動的效果平順。

但如果是巢狀的RecyclerView，也就是如文章內所述：一個直向的列表，有複數個RecyclerView，而每個RecyclerView包含著相同樣式的View。這樣的話每個RecyclerView就會有自己的Pool，也就代表相同樣式的View，會被重複建立多次。

為了減少這種多餘的消耗，可以透過`setRecycledViewPool()`來指定有重複View的RecyclerView用相同的Pool，這樣就可以避免重複建立。