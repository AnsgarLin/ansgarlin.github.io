---
title: "Refactor RecyclerView With Delegate Pattern"
date: "2017-12-22"
---
> *Thanks for [Benjamin Cheng](https://github.com/benjamin-cheng) coming out with the solution and big help on writing the post.*
>
> *The following contents are all from the company's project. The code in the post has been modified and not a working code, but is enough to show the concept.*

For a long time, the homepage of the company's App has kinds of View, and each View depends on the different source. It is predictable that the logic will be more complex. 

The Android components that are used to show homepage are Fragment and RecyclerView. If we follow the official sample, the logic of Views will be placed in the same adapter. The switch will be used in every callback, which may increase the complexity of the steps for implementing or removing a feature.

Even we don't take switch as the example. There must have methods that must be used for each View, but the logic will be slightly different. In this case, we will need to use if-else to implement, which may cause the same problem above. 

Here are the callbacks that will have the problem when using an Adapter: `getItemViewType`、`onCreateViewHolder`、`onBindViewHolder`, and the methods are called from them.

The direct solution is to find a way to separate the logic. We choose the solution which is introduced by Hannes Dorfmann.

The solution of Hannes Dorfmann is a usage of Delegate Pattern, so the following chapters will start from talking about the Delegate Pattern.

### Delegate Pattern

Accroding to [Wiki](https://en.wikipedia.org/wiki/Delegate_pattern):

> **Delegation** is a way to make composition as powerful for reuse as inheritance [Lie86, JZ91]. In delegation, *two* objects are involved in handling a request: a receiving object delegates operations to its **delegate**. This is analogous to subclasses deferring requests to parent classes. But with inheritance, an inherited operation can always refer to the receiving object through the `this` member variable in C++ and `self` in Smalltalk. To achieve the same effect with delegation, the receiver passes itself to the delegate to let the delegated operation refer to the receiver.[[2\]](https://en.wikipedia.org/wiki/Delegation_pattern#cite_note-2)

In short, a function call will be delegated to the other object with the same function name.

### Hannes Dorfmann's [JOE'S GREAT ADAPTER HELL ESCAPE](http://hannesdorfmann.com/android/adapter-delegates)

The problem in the Hannes Dorfmann's post is:

> At the beginning, there is only a kind of View in the Adapter. When we need to show another kind of View, the solution is to implement a new Adapter which inherits the previous one. So when something changes in the logic, the situations below will come up:
>
> - When we only need to show a View, the logic of the View will mix up with the others because the Adapter inherits the logic from the previous one, too.
> - When we need to show the same View, the logic may repeat in different Adapters.

The above situation is different from ours, but with the same problem: The View's logic is mixed together, and not easy to change.

The solution in the post is to use the Delegate Pattern, the following are the two main interfaces:

```java
public interface AdapterDelegate<T> {
  public boolean isForViewType(@NonNull T items, int position);
  @NonNull public RecyclerView.ViewHolder onCreateViewHolder(ViewGroup parent);
  public void onBindViewHolder(@NonNull T items, int position, @NonNull RecyclerView.ViewHolder holder);
}
```

AdapterDelegate is used to wrap the logic of a View.

```java
public class AdapterDelegatesManager<T> {
  public AdapterDelegatesManager<T> addDelegate(@NonNull AdapterDelegate<T> delegate) {}
  public int getItemViewType(@NonNull T items, int position) {}
  public RecyclerView.ViewHolder onCreateViewHolder(ViewGroup parent, int viewType) {}
  public void onBindViewHolder(@NonNull T items, int position, @NonNull RecyclerView.ViewHolder viewHolder) {}
}
```

AdapterDelegatesManager is using to keep the instances of the AdapterDelegate of the different kinds of Views and call `AdapterDelegate.onCreaterViewHolder`和`onBindViewHolder` by the view type in `onCreaterViewHolder` and `onBindViewHolder`.

### After refactor

To make the AdapterDelegatesManager as a normal Adapter, the following are the adjustment we do and the implementations:

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

Here we use a class ItemData, which does not only keep the information that will be used to show View but also give the view type to identify the data:

```java
public static class ItemData {
  private int viewType = R.layout.viewId;
  public int getViewType() { return viewType; }
}
```

The executive process is like below:

1. Using `addDelegate()` to add the AdapterDelegate and the view type into a Map.
2. Using `setItemata()` to add the ItemData for showing the View into the Adapter.
3. Using `getItemViewType()` to get the view type from ItemData in `mItemDatas`.
4. Using `onCreateViewHolder()` to get the AdapterDelegate from `adapterDelegates`, and call the `AdapterDelegate.onCreateViewHolder()` to get the ViewHolder。
5. Using `onBindViewHolder()` to get the AdapterDelegate and Data for `adapterDelegates` and `mItemDatas`，and call `AdapterDelegate.onBindViewHolder()` to bind the ItemData into the ViewHolder.

The key of the Map is only used for finding which AdapterDelegate to use, so it is OK to use anything you want.

### Concludsion

After the adjustment, we can separate the View's logic into different AdapterDelegates, which solve the problem we face at the beginning.

### What's more

Next, we are going to introduce the problems we solve with the same solution.

#### ItemDecoration

RecyclerView uses ItemDecoration to set the extra space between the Views. By overriding the `ItemDecoration.getItemOffsets()`, we can add extra space to the View's layout.

```java
public void getItemOffsets(Rect outRect, View view, RecyclerView recyclerView, RecyclerView.State state) {}
```

At run-time, the method will get called during every drawing View process. So if there is only an ItemDecoration, every space settings of the Views will be mixed up together. Just like the problem above.

You can say how about separate the logic into ItemDecorations, and set into the RecyclerView one by one. Unfortunately, ItemDecoration doesn't have the ability to identify which View it belongs to. You still need to check in `getItemOffsets()`, so it doesn't make many benefits to do. If we make ItemDecorations to inherit each other, we fall into the same problem that Hannes Dorfmann faces.

Why not use the same solution if the problems are the same. Hense we design a new ItemDecoration:

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

You may wonder why using the class type of ItemData as the key, not the ViewHolder. It's because there might have the Views with the same layout, but with different ItemData class types. It usually happens on different data sources that need to show in the same form. To keep the flexibility, we choose not to use the values that relate to the layout. But the same as AdapterDelegate, it's not forced, you can still use anything you want to be the key.

We design the CompositerDecoSpace to handle the extra spaces of View. Not only to record the setting of the default extra space of Views, we also use Locate to mark the position of Views when they are shown on the screen: full width, left, right or middle. We can adjust the space based on the Locate at run-time:

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

The executive process is lined below:

1. Using the constructor of Decoration to setting the Map of the item's data type the CompositeDecoSpace.
2. Using the parameters of `getItemOffsets` to get the ItemData of the View, and using the ItemData's class type to get the CompositeDecoSpace.
3. Using `fetchSpanInfo` to calculate the location of the View on the screen.
4. Using `left`、`top`、`right`、`bottom` and `Locate` of the CompositeDecoSpace to get the final space setting.

By using the same solution, we solve the problem. Furthermore, the flexibility and readability are higher because we can set the extra spaces of Views in the same place.