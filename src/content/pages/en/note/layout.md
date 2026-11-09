---
title: "Layout"
updated: "2019-04-04"
---
## requestLayout()
### Layout only
```
requestLayout() -> onMeasure() -> onLayout() -> onDraw()
```

* requestLayout()

```
1. This method is typically called by a view on itself when it believes that is can no longer fit within its current bounds.
2. This should not be called while the view hierarchy is currently in a layout pass (isInLayout())
```
[Reference](http://daojin.iteye.com/blog/1860073)

* onMeasure(int widthMeasureSpec, int heightMeasureSpec)  

```
1. 用於計算Layout的邊界大小
2. 將mode和size整合至一32位元的int內
3. 前2位元代表mode
	UNSPECIFIED: 父容器沒有限制，子容器可以隨意決定大小
	EXACTLY: 父容器已設定大小，子容器強迫設定，設定match_parent時觸發
	AT_MOST: 子容器可以設定最大邊界內的任意大小，設定wrap_content時觸發
```

* onLayout(boolean changed, int l, int t, int r, int b)  

```
1. 決定Layout在畫面上的位置
```

* onDraw()

```
1. 繪製Layout
2. 只要Layout最終不會顯示在畫面上，或是沒有background，onDraw()就不會被呼叫
※只要有跑到onLayout()，不呼叫super.onDraw()，則Layout一樣會出現
3. 盡量不要在OnDraw內建立任何物件，new物件會啟動GC，造成畫面停頓
```

### Layout with child view

```
requestLayout() -> generateLayoutParams() -> checkLayoutParams() -> onMeasure() -> onLayout() -> onDraw()
```

* generateLayoutParams(AttributeSet attrs)

```
1. 依照xml中所提供的數值建構一Child View之LayoutParams
---------------------------------------------------
其他相似的Function:
generateDefaultLayoutParams()
1. 回傳一基本款的LayoutParams，依照orientation分兩種狀況執行
   Horizontal：設定LayoutParams(WRAP_CONTENT, WRAP_CONTENT)
   Vertical：設定LayoutParams(MATCH_PARENT, WRAP_CONTENT)
2. 用於呼叫addView(View)，而View中並無設置LayoutParams時

generateLayoutParams(android.view.ViewGroup.LayoutParams p)
1. 當checkLayoutParams返回false調用，代表原本的LayoutParams不屬於所屬Layout
2. 回傳一合法的新LayoutParams，並以傳進的LayoutParams為參數
    ex：new LayoutParams(p);
```

* checkLayoutParams(android.view.ViewGroup.LayoutParams p)

```
1. 檢查Child View之LayoutParams是否為合法的LayoutParams
    ex：LinearLayout的子View使用RelativeLayout.LayoutParams設定，則判定成不合法，回傳false；屬於LinearLayout的子View的Layout，就必須用LinearLayout.LayoutParams
```
