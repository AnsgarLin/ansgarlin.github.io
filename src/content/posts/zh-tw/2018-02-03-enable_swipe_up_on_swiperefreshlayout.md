---
title: "Enable Swipe Up On SwipeRefreshLayout"
date: "2018-02-03"
---
在Google大力推動[Material Design](https://material.io/guidelines/)，以及其[support library](https://developer.android.com/topic/libraries/support-library/index.html)日益健全的情況下，越來越多的開法者傾向於使用原生的元件。但support library在設計上勢必會傾向於高通用性的功能，所以在某些時候就會無法完美的實現設計師想要的效果。

最近團隊內的設計師給出了一個特殊的設計：在列表頁面，除了下拉更新，還需要在列表滾到最底時，提供將整個列表上提的效果。實際上的效果如下：

![](/zh-tw/news/2018/02/03/enable_swipe_up_on_swiperefreshlayout/sample_up_swipe.gif)

很不幸的，即使是官方原生元件SwipeRefreshLayout也沒有開放上拉的功能，如此有自己實作這條路。但要自己實作就得先實作SwipeRefreshLayout原本就有的功能，不用看原始碼就知道這個決策會非常不符合成本效益。最好的解法應該是：**嘗試理解原生元件的邏輯，並做出一個反向的SwipeRefreshLayout。**

### Basic rule

在理解邏輯之前，我們先帶到一段特別寫在SwipeRefreshLayout原始碼開頭註解：

 ```Java
// In SwipeRefreshLayout
This layout should be made the parent of the view that will be refreshed as a result of the gesture and can only support one direct child.
 ```

內容在於告知SwipeRefreshLayout只能支援一個child。這句話其實並不只是說它只會跟其中一個child互動，而是代表如果你加再多child都是無意義的，原因如下：

``` java
// In SwipeRefreshLayout
@Override
protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
  ...
  if (mTarget == null) {
    ensureTarget();
  }
  if (mTarget == null) {
    return;
  }
  final View child = mTarget;
  final int childLeft = getPaddingLeft();
  final int childTop = getPaddingTop();
  final int childWidth = width - getPaddingLeft() - getPaddingRight();
  final int childHeight = height - getPaddingTop() - getPaddingBottom();
  child.layout(childLeft, childTop, childLeft + childWidth, childTop + childHeight);
  int circleWidth = mCircleView.getMeasuredWidth();
  int circleHeight = mCircleView.getMeasuredHeight();
  mCircleView.layout((width / 2 - circleWidth / 2), mCurrentTargetOffsetTop,
                (width / 2 + circleWidth / 2), mCurrentTargetOffsetTop + circleHeight);
}
```

在`onLayout()`的時候，會先判斷`mTarget`有沒有值，而`mTarget`則從`ensureTarget()`取得：

```java
// In SwipeRefreshLayout
private void ensureTarget() {
  // Don't bother getting the parent height if the parent hasn't been laid
  // out yet.
  if (mTarget == null) {
    for (int i = 0; i < getChildCount(); i++) {
      View child = getChildAt(i);
      if (!child.equals(mCircleView)) {
        mTarget = child;
        break;
      }
    }
  }
}
```

SwipeRefreshLayout在建立時期就會加入一個child，也就是我們下拉時會看到的小圈圈，是一個私有的內部類CircleImageView。所以在`ensureTarget`內，`getChildAt()`得到的第一個值必然是CircleImageView。因此不管有幾個child，`mTarget`必然是`getChildAt(1)`取到的child，也就是在xml內定義在SwipeRefreashLayout內的第一個View。

回到`onLayout()`，此函式的用途在於讓ViewGroup決定所有child的位置及範圍。而在這邊只有決定了`mTarget`和CircleImageView的位置和範圍。所以結論如下：

* **不管有幾個child，SwipeRefreshLayout只會繪製CircleImageView和第一個child。**

### How it works

接著來分析整個下拉效果的實作邏輯，依照執行的過程我們可以想到以下幾個疑問點：

* 如何判斷`mTarget`已經不能再滾動？
* 如何觸發下拉？
* 如何產生下拉CircleImageView的效果？
* 如何將CircleImageView的位置還原？


> 以下分析都與NestScroll有關，建議可以先理解NestedScroll的機制再繼續閱讀。

#### 如何判斷`mTarget`已經不能再滾動？

身為一個ViewGroup，一定會有實作`onInterceptTouchEvent()`：

```java
// In SwipeRefreshLayout
@Override
public boolean onInterceptTouchEvent(MotionEvent ev) {
  ...
  if (!isEnabled() || mReturningToStart || canChildScrollUp() || mRefreshing || mNestedScrollInProgress) {
    // Fail fast if we're not in a state where a swipe is possible
    return false;
  }
  ...
}
```

除了一些Boolean的參數，還有一個特殊的函示`canChildScrollUp()`：

```java
// In SwipeRefreshLayout
public boolean canChildScrollUp() {
  if (mChildScrollUpCallback != null) {
    return mChildScrollUpCallback.canChildScrollUp(this, mTarget);
  }
  if (mTarget instanceof ListView) {
    return ListViewCompat.canScrollList((ListView) mTarget, -1);
  }
  return mTarget.canScrollVertically(-1);
}
```

從內容可以看出此函示用於判斷`mTarget`是否已經被滾到頂端。

#### 如何觸發下拉？

前段程式碼在`canChildScrollUp()`回傳true，也就是`mTarget`已經滾到頂端後，會回傳false。False對於`onInterceptTouchEvent()`來說就是此ViewGroup不會攔截任何觸控事件，直接傳遞到`mTarget`。

如果對於NestScrolling的定義熟悉，就會知道在`mTarget`接到這個觸控事件後，會在處理的過程中，呼叫`startNestedScroll()`。而SwipeRefreshLayout有實作NestedScrollingParent，於是會走到SwipeRefreshLayout實作的`onStartNestedScroll()`：

```java
// In SwipeRefreshLayout
@Override
public boolean onStartNestedScroll(View child, View target, int nestedScrollAxes) {
  return isEnabled() && !mReturningToStart && !mRefreshing && (nestedScrollAxes & ViewCompat.SCROLL_AXIS_VERTICAL) != 0;
}
```

內容很單純的判斷View的狀態、是否正在更新以及滾動方向是不是直向的。一般來說在一開始滑動時，這邊都會回傳true。

在`onStartNestedScroll()`回傳true後，會再走到`onNestedScrollAccepted()`：

```java
// In SwipeRefreshLayout
@Override
public void onNestedScrollAccepted(View child, View target, int axes) {
  // Reset the counter of how much leftover scroll needs to be consumed.
  mNestedScrollingParentHelper.onNestedScrollAccepted(child, target, axes);
  // Dispatch up to the nested parent
  startNestedScroll(axes & ViewCompat.SCROLL_AXIS_VERTICAL);
  mTotalUnconsumed = 0;
  mNestedScrollInProgress = true;
}
```

在這邊看到一個變數`mTotalUnconsumed`。此變數會貫穿整個`SwipeRefreshLayout`，用於紀錄目前已經拉動的距離，大部分下拉效果的機制都與這變數有關。

然後再走到`onNestedPreScroll`：

```java
// In SwipeRefreshLayout
@Override
public void onNestedPreScroll(View target, int dx, int dy, int[] consumed) {
  // If we are in the middle of consuming, a scroll, then we want to move the spinner back up
  // before allowing the list to scroll
  if (dy > 0 && mTotalUnconsumed > 0) {
    if (dy > mTotalUnconsumed) {
      consumed[1] = dy - (int) mTotalUnconsumed;
      mTotalUnconsumed = 0;
    } else {
      mTotalUnconsumed -= dy;
      consumed[1] = dy;
    }
    moveSpinner(mTotalUnconsumed);
  }

  // If a client layout is using a custom start position for the circle
  // view, they mean to hide it again before scrolling the child view
  // If we get back to mTotalUnconsumed == 0 and there is more to go, hide
  // the circle so it isn't exposed if its blocking content is moved
  if (mUsingCustomStart && dy > 0 && mTotalUnconsumed == 0 && Math.abs(dy - consumed[1]) > 0) {
    mCircleView.setVisibility(View.GONE);
  }
  // Now let our nested parent consume the leftovers
  final int[] parentConsumed = mParentScrollConsumed;
  if (dispatchNestedPreScroll(dx - consumed[0], dy - consumed[1], parentConsumed, null)) {
    consumed[0] += parentConsumed[0];
    consumed[1] += parentConsumed[1];
  }
}
```

在這`onNestedPreScroll()`的內容跟當前的問題無關，因此先跳過來到`onNestedScroll()`：

```java
// In SwipeRefreshLayout
@Override
public void onNestedScroll(final View target, final int dxConsumed, final int dyConsumed,   
                           final int dxUnconsumed, final int dyUnconsumed) {
  // Dispatch up to the nested parent first
  dispatchNestedScroll(dxConsumed, dyConsumed, dxUnconsumed, dyUnconsumed, mParentOffsetInWindow);

  // This is a bit of a hack. Nested scrolling works from the bottom up, and as we are
  // sometimes between two nested scrolling views, we need a way to be able to know when any
  // nested scrolling parent has stopped handling events. We do that by using the
  // 'offset in window 'functionality to see if we have been moved from the event.
  // This is a decent indication of whether we should take over the event stream or not.
  final int dy = dyUnconsumed + mParentOffsetInWindow[1];
  if (dy < 0 && !canChildScrollUp()) {
    mTotalUnconsumed += Math.abs(dy);
    moveSpinner(mTotalUnconsumed);
  }
}
```

在這裡透過判斷式判斷是否是往下滾動，且是否還能滾動。是的話就記錄下當前已滾動距離，並並呼叫`moveSpinner`：

```java
// In SwipeRefreshLayout
private void moveSpinner(float overscrollTop) {
  ...
  setTargetOffsetTopAndBottom(targetY - mCurrentTargetOffsetTop);
  ...
}
```

重點是最後一行`setTargetOffsetTopAndBottom()`。所以`moveSpinner()`就是負責移動CircleImageView的函示，被呼叫的時機是在判斷式`if (dy < 0 && !canChildScrollUp())`成立時。到此我們確定了下拉觸發的時機點。

#### 如何產生下拉CircleImageView的效果？

```java
// In SwipeRefreshLayout
void setTargetOffsetTopAndBottom(int offset) {
  mCircleView.bringToFront();
  ViewCompat.offsetTopAndBottom(mCircleView, offset);
  mCurrentTargetOffsetTop = mCircleView.getTop();
}
```

這裏SwipeRefreshLayout透過呼叫`ViewCompat.offsetTopAndBottom()`來移動CircleImageView，傳進去的`offset`就是移動距離。隨著使用者持續滾動，NestedScroll機制會不斷被觸發並傳入不同的`offset`，這些`offset`疊加起來就產生我們所看到的下拉效果。

#### 如何將CircleImageView的位置還原？

觸發還原機制的時機有兩個：

* 使用者放開手指。
* 使用者在滾動的過程中反向滾動。

##### 使用者放開手指

當使用者放開時，`onStopNestedScroll()`會被呼叫：

```java
// In SwipeRefreshLayout
@Override
public void onStopNestedScroll(View target) {
  ...
  finishSpinner(mTotalUnconsumed);
  ...
}
```

裡面用到了`finishSpinner()`：

```java
// In SwipeRefreshLayout
private void finishSpinner(float overscrollTop) {
  ...
  setRefreshing(true, true /* notify */);
  ...
  animateOffsetToStartPosition(mCurrentTargetOffsetTop, listener);
  ...
}
```

所以要不已經到達最遠的滾動位置，觸發了刷新的機制，不然就是直接呼叫`animateOffsetToStartPosition()`來將CircleImageView還原至原本位置。如果是刷新最後也會執行相同的函示將CircleImageView還原。

##### 使用者在滾動的過程中反向滾動。

這邊就得看回去`onNestedPreScroll()`最前面的一段：

```java
// In SwipeRefreshLayout
@Override
public void onNestedPreScroll(View target, int dx, int dy, int[] consumed) {
  // If we are in the middle of consuming, a scroll, then we want to move the spinner back up
  // before allowing the list to scroll
  if (dy > 0 && mTotalUnconsumed > 0) {
    if (dy > mTotalUnconsumed) {
      consumed[1] = dy - (int) mTotalUnconsumed;
      mTotalUnconsumed = 0;
    } else {
      mTotalUnconsumed -= dy;
      consumed[1] = dy;
    }
    moveSpinner(mTotalUnconsumed);
  }
  ...
}
```

透過判斷當前是不是往上滾動，且是不是已經在上移中。是的話則遞減已滾動距離，如果會超過最後還原的位置，則會直接進行歸零。

### Implement swipe up

理解整個實作的流程後，接著就可以繼承`SwipeRefreshLayout`來依樣畫葫蘆做出反向效果。實作過程中一樣會遇到前面提出的幾個問題：

- 如何判斷`mTarget`已經不能再滾動？
- 如何觸發下拉？
- 如何產生下拉CircleImageView的效果？
- 如何將CircleImageView的位置還原？

#### 如何判斷`mTarget`已經不能再滾動？

在原本的`canChildScrollUp()`內，有透過`mTarget`來呼叫`canScrollVertically(-1)`來判斷能不能再往上滾動。所以如果我們要判斷能不能再往下滾，可以直接使用`canScrollVertically(1)`實作一個`canChilScrollDown()`：

```java
// In UpSwipeRefreshLayout
public boolean canChildScrollDown() {
  return mTarget.canScrollVertically(1);
}
```

> `canScrollVercally()`會依照傳入的數值正負來決定判斷的方向。負數代表往上滾，因為上滾的手勢操作是下移，移動距離是負數，反之亦然。

#### 如何觸發下拉？

根據前面分析，觸發下拉首先要從觸控事件的處理開始。模仿原生的做法在`onInterceptTouchEvent()`內加入`canChildScrollDown()`判斷，並在確定不能往下滾動時回傳false來啟動NestScroll機制：

```java
// In UpSwipeRefreshLayout
@Override
public boolean onInterceptTouchEvent(MotionEvent ev) {
  if (!canDragTargetView()) {
    return false;
  }
  return super.onInterceptTouchEvent(ev);
}
```

接著走到`onStartNestedScroll`，原生做法內並沒有與上下滾動相關的判斷，於是這邊跳過直接進下一個callback，`onNestedScrollAccepted()`：

```java
// In UpSwipeRefreshLayout
@Override
public void onNestedScrollAccepted(View child, View target, int axes) {
  super.onNestedScrollAccepted(child, target, axes);
  mTotalDrag = 0.0f;
}
```

由於變數`mTotalUnconsumed`是私有的，且也需要與下拉的機制做切割，這邊必須得用另一個變數來儲存已經向上拉動的距離。

接著再看到觸發下拉的函示`onNestedScroll()`：

```java
// In UpSwipeRefreshLayout
@Override
public void onNestedScroll(final View target, final int dxConsumed, final int dyConsumed,
                           final int dxUnconsumed, final int dyUnconsumed) {
  // Dispatch up to the nested parent first. Check SwipeRefreshLayout.onNestedScroll for more detail.
  dispatchNestedScroll(dxConsumed, dyConsumed, dxUnconsumed, dyUnconsumed, mParentOffsetInWindow);
  final int dy = dyUnconsumed + mParentOffsetInWindow[1];
  if (dy > 0 && canDragTargetView()) {
    int adjustOffset = slowDown(dy);
    mTotalDrag += (adjustOffset);
    moveTarget(-adjustOffset);
  } 
  ...
}
```

為了保留與上層parent在NestScroll機制下的連動關係，這邊從原生函示內抽出`dispatchNestedScroll()`，再判斷滾動方向以及是否已經到底來啟動上拉的機制。

#### 如何產生下拉CircleImageView的效果？

上拉機制啟動後，接著呼叫`moveTarget()`移動`mTarget`。

```java
// In UpSwipeRefreshLayout
private static final int OVER_SCROLL_TOTAL_DISTANCE = 200;
private void moveTarget(int offset) {
  final int currentTop = mTarget.getTop();
  // Hit the max scroll distance
  if (currentTop + offset < -OVER_SCROLL_TOTAL_DISTANCE) {
    // The final offset will be more than needed, so take the limit.
    offset = -OVER_SCROLL_TOTAL_DISTANCE - currentTop;
  } else if (currentTop + offset >= 0) {
    // Scrolling back the original position during dragging the target view
    offset = -currentTop;
    mTotalDrag = 0.0f;
  }

  ViewCompat.offsetTopAndBottom(mTarget, offset);
}
```

因為`moveTarget()`會參與整段上拉過程中的操作，所以也需要處理邊際狀況。例如上拉的最大距離，以及手動下滾來還原時的邊界限制。最後和原生一樣透過呼叫`offsetTopAndBottom()`來產生移動的效果。

#### 如何將CircleImageView的位置還原？

同樣的，我們也要處理觸發還原機制的兩個時機：

- 使用者放開手指。
- 使用者在滾動的過程中反向滾動。

##### 使用者放開手指。

最後當使用者放開時，則在`onStopNestedScroll()`使用animation來還原：

```java
// In UpSwipeRefreshLayout
@Override
public void onStopNestedScroll(View target) {
  if (mTotalDrag > 0.0f) {
    Animation animation = new Animation() {
      float from = mTarget.getTop();
      float preValue = 0.0f;
      @Override
      public void applyTransformation(float interpolatedTime, Transformation t) {
        float diffValue = interpolatedTime - preValue;
        preValue = interpolatedTime;
        
        // Avoid digit lost while transforming from float to int.
        targetTop = (int) (mTarget.getTop() + (-(from * diffValue)));
        moveTarget((int) -(from * diffValue));
      }
    };
    ...
  }
}
```

實作原理就是依照每次`interpolatedTime`的差值來算出當下需要還原多少距離，並用`mTarget`當前位置來取整數的差值，避免在型態轉換時產生的誤差。

##### 使用者在滾動的過程中反向滾動。

還原動作只差在方向的差別，因此我們可以依照原本的邏輯實作如下：

```java
// In UpSwipeRefreshLayout
@Override
public void onNestedPreScroll(View target, int dx, int dy, int[] consumed) {
  // When use scroll up during target view has been dragged
  if (dy < 0 && hasTargetViewBeenDrag()) {
    if (Math.abs(dy) > mTotalDrag) {
      consumed[1] = (int) -mTotalDrag;
      mTotalDrag = 0.0f;
    } else {
      consumed[1] = dy;
      mTotalDrag += dy;
    }
    moveTarget(-consumed[1]);
  }
  super.onNestedPreScroll(target, dx, dy,consumed);
}
```

### More about swipe up 

在開頭的動畫中，除了有上拉效果以外，也有一段文字會隨之移動。由於`SwipeRefreshLayout`本身不會繪出多餘的child，因此接著將探討如何在不新增一個child的狀況下，畫出自訂的畫面。

要主動畫出自訂的畫面，有兩個問題必須要先解決：

* 如何觸發重繪機制？
* 在何處進行繪製？

##### 如何觸發重繪機制？

不論是原生的`SwipeRefreshLayout`或是我們自行設計的`UpSwipeRefreshLayout`，會觸發繪圖的函示只有`offsetTopAndBottom()`，且其中實作只有針對`mTarget`重繪。如果要觸發整個畫面的繪圖機制，則必須要透過`invalidate()`主動觸發：

```java
// In UpSwipeRefreshLayout
private void moveTarget(int offset) {
  if (currentTop + offset < -OVER_SCROLL_TOTAL_DISTANCE) {
    ...
  } else {
    if (currentTop + offset >= 0) {
      ...
    }
    invalidate();
  }
  ViewCompat.offsetTopAndBottom(mTarget, offset);
}
```

只要不是已經完全還原位置，就必須要進行重繪。

##### 在何處進行繪製？

觸發後會走到`onDrawForeground`，並實作繪製過程：

```java
// In UpSwipeRefreshLayout
@Override
public void onDrawForeground(Canvas canvas) {
  if (hasTargetViewBeenDrag()) {
    mTextHint.layout(getLeft(), mTarget.getBottom(), getRight(), getBottom());
    canvas.save();
    canvas.translate(0, mTextHint.getTop());
    mTextHint.draw(canvas);
    canvas.restore();
  }
}
```

假設`mTextHint`是我們想要繪製的View，並依照以下步驟完成繪製：

* 用`layout()`還有`mTarget`的位置來決定View的繪製範圍。
* 因為之後需要移動canvas來繪圖，所以需要先用`canvas.save()`來儲存當前畫布。
* 透過`canvas.translate()`來移動畫布到想要`mTextHint`出現的位置。
* 透過`draw()`來將`mTextHint`繪出。