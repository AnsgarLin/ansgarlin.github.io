---
title: "View"
updated: "2019-04-04"
---
### What
處理畫面的基本組件

### Flow
measure計算佔用範圍，在onMeasure取得結果
layout算出在ViewGrop的位置，在onLayout取得結果
draw中的流程：drawBackground畫自身背景 -> call onDraw取得自訂的前景 -> call dispatchDraw畫子view -> call onDrawScrollBars來畫滾動條 -> 畫ViewOverlay
※如果view沒設定background drawable，則會直接跳至call dispatchDraw

### ViewOverlay
已陣列儲存drawable並且永遠覆蓋在view上

### Performance
少用RequestLayout，因為會整串view包含viewgroup都重新計算，如果有錯誤還會重算
少用invalidate，已invalidate(rect)代替，可以降低相同畫面重繪的次數

### Touch event
1. 觸碰螢幕後，觸發最大的 ViewGroup 的dispatchTouchEvent
2. ViweGrop 的 dispatchTouchEvent會啟動子 view 的dispatchTouchEvent，子 view如果是 ViewGroup 則會繼續往其子 view的 dispatchTouchEvent 進行
3. 如果任何一個ViewGoup 的 onInterceptTouchEvent回傳 true，則直接執行當前 ViewGroup的 super.dispatchTouchEvent，也就是View. dispatchTouchEvent
4. View.dispatchTouchEvent 會判斷是否有直做 onTouchListener，有則執行onTouchListener，沒有則執行 View.onTouchEvent
5. ParentView 到子 View,然后还有可能再从子 View 返回到ParentView
http://blog.csdn.net/windskier/article/details/6966264
http://blog.csdn.net/stonecao/article/details/6759189
http://blog.csdn.net/guolin_blog/article/details/9097463
http://blog.csdn.net/guolin_blog/article/details/9153747 

### Summary
呈現畫面的基本組建，最廣義的flow就是在measure計算佔位空間，layout計算位置，draw中繪製畫面，draw又可以分成drawBackground背景 -> onDraw(前景) -> dispatchDraw(子view) -> onDrawScrollBars(scrollbar) -> ViewOverlay，要注意的是如果沒有設計定背景，則會直接call dispatchDraw。少用requestLayout，因為其會重新計算view，包含viewgroup，有衝突會重新計算；少用invalidate讓view重新繪製不需要重繪的部分。

### What's more

#### Optimize

使用[`setWillNotDraw`](https://developer.android.com/reference/android/view/View.html#setWillNotDraw(boolean))控制是否要繪製背景。可搭配onDraw來控制是否需要繪製自訂的內容。

#### View id

> 以下皆出自此篇[文章](https://stackoverflow.com/questions/8460680/how-can-i-assign-an-id-to-a-view-programmatically?answertab=active#tab-top)

##### 設定id

在xml中加入

```Xml
android:id="@+id/<id name>
```

在程式中動態加入

```Java
View.setId(int);
```

##### 產生id

透過內建函示：

```Java
View.generateViewId()
```

設定id資源：

```Xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <item name="reservedNamedId" type="id"/>
</resources>
```

##### 規則

- 透過`android:id`設定的id具有唯一性。
- 程式動態設定的id不具唯一性。
- 程式動態設定的id可與`android:id`設定的id相同

由於`findViewById()`會回傳第一個id相符的View，所以基於第三條的規則，在設計layout或動態產生layout時，必須要保持layout中的id的唯一性。