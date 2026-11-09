---
title: "運用Delegate Pattern進行RecyclerView重構"
date: "2017-12-22"
---
> *感謝[Benjamin Cheng](https://github.com/benjamin-cheng)想出此解法並在文章撰寫過程中給予協助。*
>
> *以下內容取自公司專案，任何相關的程式碼都已經過刪減，純粹用於表示概念而不是可執行的程式片段*。

一直以來，公司App首頁充滿著各種不同的View，而不同的View依賴於不同的資料來源，可以預料到背後的邏輯勢必會非常複雜。

首頁用到Android元件主要是：Fragment、RecyclerView。如果依照Android官方範本的實作方式，不同View的邏輯會放置在同一個Adapter裡面，且需要在各個callback內使用switch機制，但過多的switch會複雜化新增或是刪除其中一個項目時的步驟。

就算不以switch舉例，Adapter內一定會有一些自訂函示，是每個View都會使用到，但處理方式上又有些微不同。如此就必須依賴if-else來實作，則就會遇到相同的問題。

以Adapter來說以上情形主要會發生在以下幾個callback：`getItemViewType`、`onCreateViewHolder`、`onBindViewHolder`和在這些callback內呼叫的函示。

直覺的解法就是將邏輯個別拆開，在這我們選用Hannes Dorfmann的所提出的方法。

Hannes Dorfmann的解法是Delegate Pattern的一種運用，以下將從介紹Delegate Pattern開始。

### Delegate Pattern

根據[Wiki](https://en.wikipedia.org/wiki/Delegation_pattern)上的定義：

>**Delegation** is a way to make composition as powerful for reuse as inheritance [Lie86, JZ91]. In delegation, *two* objects are involved in handling a request: a receiving object delegates operations to its **delegate**. This is analogous to subclasses deferring requests to parent classes. But with inheritance, an inherited operation can always refer to the receiving object through the `this` member variable in C++ and `self` in Smalltalk. To achieve the same effect with delegation, the receiver passes itself to the delegate to let the delegated operation refer to the receiver.[[2\]](https://en.wikipedia.org/wiki/Delegation_pattern#cite_note-2)

簡言之，就是一個函式被呼叫時，會由外部傳入的物件來呼叫相同名稱的函示，進行一個換手的動作。


### Hannes Dorfmann's [JOE'S GREAT ADAPTER HELL ESCAPE](http://hannesdorfmann.com/android/adapter-delegates)

在Hannes Dorfmann的文章內所提到的問題如下：

> 一開始的Adapter只有一個View。在需要新的View時，作法則是用一個新的Adapter來繼承舊的。如此當業務邏輯調整時，會產生以下幾個情形：
>
> * 需要只呈現其中一種View時，因為Adapter是繼承而來，會造成不需要的View的邏輯也會參雜進來。
> * 需要在不同的Adapter上呈現相同的View時，會造成相同的邏輯重複出現。

上述的情境我們遇到的情境有些不同，但問題點都是不同View的邏輯互相參雜，不容易進行更動。

文章內的解法是套用Delegate Pattern，先節錄主要的兩個interface：

```java
public interface AdapterDelegate<T> {
  public boolean isForViewType(@NonNull T items, int position);
  @NonNull public RecyclerView.ViewHolder onCreateViewHolder(ViewGroup parent);
  public void onBindViewHolder(@NonNull T items, int position, @NonNull RecyclerView.ViewHolder holder);
}
```

AdapterDelegate用來封裝不同的View的邏輯

```java
public class AdapterDelegatesManager<T> {
  public AdapterDelegatesManager<T> addDelegate(@NonNull AdapterDelegate<T> delegate) {}
  public int getItemViewType(@NonNull T items, int position) {}
  public RecyclerView.ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {}
  public void onBindViewHolder(@NonNull T items, int position, @NonNull RecyclerView.ViewHolder viewHolder) {}
}
```

AdapterDelegatesManager用來存放不同View的AdapterDelegate，然後在`onCreaterViewHolder`和`onBindViewHolder`時，針對view type來呼叫對應的`AdapterDelegate.onCreaterViewHolder`和`onBindViewHolder`

### After refactor

為了將AdapterDelegatesManager當成一般的Adapter使用，我們做了一些調整，加上實作如下：

```java
public interface AdapterDelegate {
    @NonNull public RecyclerView.ViewHolder onCreateViewHolder(ViewGroup parent);
    public void onBindViewHolder(RecyclerView.ViewHolder holder, Item data);
}
```

```java
public class AdapterDelegatesManager extends Adapter<ViewHolder> {
  private Map<Integer, AdapterDelegate> adapterDelegates = new ArrayList<>();
  private List<ItemData> mItemDatas = new ArrayList<>();
  
  public AdapterDelegatesManager addDelegate(int viewType, @NonNull AdapterDelegate<T> delegate) {
    adapterDelegates.put(viewType, delegate);
  }
  
  public void setItemData(List<ItemData> itemDatas) {
    mItemDatas = itemDatas;
  }
  
  public int getItemViewType(int position) {
    mItemDatas.get(position).getViewType()
  }
  
  public RecyclerView.ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {
    return adapterDelegates.get(viewType).onCreateViewHolder(parent);
  }
  
  public void onBindViewHolder(RecyclerView.ViewHolder holder, int position) {
    adapterDelegates.get(getItemViewType(position)).onBindViewHolder(holder, mItemDatas.get(position));
  }
}
```

這邊用到的一個特殊類別ItemData，除了存放呈現View需要的資料，也用於提供對應的view type：

```java
public static class ItemData {
  private int viewType = R.layout.viewId;
  public int getViewType() { return viewType; }
}
```

整體程式執行流程如下：

1. 透過`addDelegate()`將自訂的AdapterDelegate和對應的view type加入Map。
2. 透過`setItemData()`可以將用來呈現View的ItemData傳入Adapter。
3. 透過`getItemViewType()`來從`mItemDatas`內的ItemData取得view type。
4. 透過`onCreateViewHolder()`來從`adapterDelegates`取得對應的AdapterDelegate，並執行`AdapterDelegate.onCreateViewHolder()`取得ViewHolder。
5. 透過`onBindViewHolder()`來從`adapterDelegates`和`mItemDatas`取得對應的AdapterDelegate和ItemData，並執行`AdapterDelegate.onBindViewHolder()`來將ViewHolder與ItemData綁定。

用什麼來當成Map的key值並沒有絕對，只要能拿來找到正確的AdapterDelegate即可。

### Concludsion

經過這樣的調整，我們就可以將不同View所需要的邏輯，拆分至不同的AdapterDelegate內，從而解決我們一開始遇到的問題。

### What's more

以下將另外介紹我們用相同方式所解決的問題。

#### ItemDecoration

RecyclerView用ItemDecoration來提供給外部設定View之間的間距。透過覆寫ItemDecoration的`getItemOffsets()`，我們可以在VIew原本的Layout佈局上，加上額外的間隔。

```java
public void getItemOffsets(Rect outRect, View view, RecyclerView recyclerView, RecyclerView.State state) {}
```

在執行階段，在繪製每個View的過程中都會呼叫這個函式。所以如果只提供一個ItemDecoration，針對每個View的設定就會混雜在一起，就跟文章開頭遇到的問題相同。

你可以說那就拆到不同的ItemDecoration，然後一個個加進去RecyclerView。但ItemDecoration其實並不能根據View來找到對應的ItemDecoraion，你還是得在`getItemOffsets`做判斷。如此拆成不同的ItemDecoration的效益就不大，如果又用繼承的方式實作，則又掉入Hannes Dorfmann所提到的問題中。

由於問題點跟前面的問題相同，那何不嘗試相同的解法？因此我們設計了新的ItemDecoration：

```java
public class Decoration extends RecyclerView.ItemDecoration {
  private Map<Class, CompositeDecoSpace> mSpacingMap;
  
  public Decoration() {
  	mSpacingMap.put(ItemData.class, new CompositeDecoSpace(16, 0, 16, 0, 0));
  }
  
  public void getItemOffsets(Rect outRect, View view, RecyclerView recyclerView, RecyclerView.State state) {
    int position = recyclerView.getChildAdapterPosition(view);
    Class itemDataClass = recyclerView.getAdapter().getItemData(position).getClass();
    
    CompositeDecoSpace compositeDecoSpace = mSpacingMap.get(itemDataClass);
    compositeDecoSpace.fetchSpanInfo(recyclerView, position);
    
    outRect.left = compositeDecoSpace.left();
    outRect.top = compositeDecoSpace.top();
    outRect.right = compositeDecoSpace.right();
    outRect.bottom = compositeDecoSpace.bottom();
  }
}

```

你可能會好奇為什麼key是用ItemData的類別而不是ViewHolder。這是因為看起來相同的View，可能資料類別會是不同的情況。通常會發生在不同資料來源要用相同樣式呈現的時候，所以為了保持彈性，在這就不繼續用畫面相關的值當key。和AdapterDelegate一樣，key的選用並沒有絕對，能找到正確的CompositeDecoSpace即可。

在控制View的間隔部分，我們設計了一個類別CompositeDecoSpace來處理。除了可以記錄View的預設間隔外，另外也用Locate來標記對應的View在畫面上的位置：全版面、靠左、靠右或是中間。如此就可以程式執行時，進一步依照位置來調整：

```java
private class CompositeDecoSpace {
  private int left;
  private int top;
  private int right;
  private int bottom;
  private int middle;
  private Locate locate;
  
  private enum Locate {
    FULL, LEFT, MIDDLE, RIGHT;
  }
  
  public CompositeDecoSpace(int left, int top, int right, int bottom, int middle) {
    locate = Locate.FULL;
    this.left = left;
    this.top = top;  
    this.right = right; 
    this.bottom = bottom;    
  }

  public int left() {
    if (locate == Locate.RIGHT || locate == Locate.MIDDLE) {
      return middle / 2;
    }
    return left;
  }

  public int top() {
    return top;
  }

  public int right() {
    if (locate == Locate.LEFT || locate == Locate.MIDDLE) {
      return middle / 2;
    }
    return right;
  }

  public int bottom() {
    return bottom;
  }

  public int middle() {
    return middle;
  }
  
  public void fetchSpanInfo(RecyclerView recyclerView, int position) {
    if (isLeft()) {
      locate = Locate.LEFT;
    } else if (isRight()) {
      locate = Locate.RIGHT;
    } else if (isMiddle()) {
      locate = Locate.MIDDLE;
    } else {
      locate = Locate.FULL;
    }
  }
}
```

整個執行使用的過程如下：

1. 透過Decoration的constructor來先建立View的資料類別和CompositeDecoSpace的Map。
2. 透過`getItemOffsets`傳入的參數取得呈現View的ItemData，並取得其類別來從Map找出對應的CompositeDecoSpace。
3. 透過CompositeDecoSpace的`fetchSpanInfo`來計算View在畫面上實際的位置。
4. 透過CompositeDecoSpace的`left`、`top`、`right`、`bottom`和`Locate`來取得實際需要的間隔。

最後，我們不只解決了邏輯混雜的問題，一開始就可以把每個View的間隔設定寫在一起，也提高編排時的彈性和降低複雜度。