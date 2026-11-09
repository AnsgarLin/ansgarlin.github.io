---
title: "About ProGuard - Part 5"
date: "2018-08-04"
---

在前面的篇章，我們已經理解ProGuard在執行初期，是如何預先準備好其所需要的設定檔和要處理的程式碼。

接著就要開始Shrink的部分，一樣的先看回到`ProGuard.execute()`：

```Java
// In ProGuard
public void execute() throws IOException {
	...
    readInput();
    ...
    if (configuration.shrink) {
        shrink();
    }
```

這裡省略不是主要的操作，直接看到`shrink()`：

```Java
// In ProGuard 
private void shrink() throws IOException {
    ...
    // Perform the actual shrinking.
    programClassPool = new Shrinker(configuration).execute(programClassPool,
                                                           libraryClassPool);
}
```

根據經驗，主要操作都是發生在`execute()`裡面，且Shrinker分成兩大部分：標記有使用的程式碼和刪除未使用的程式碼，以下我們反著從刪除的部分開始看起。

### 刪除

先只列出關於刪除的部分：

```Java
// In Shrinker
public ClassPool execute(ClassPool programClassPool,
                         ClassPool libraryClassPool) throws IOException {
    ...
    ClassPool newProgramClassPool = new ClassPool();
   
    programClassPool.classesAccept(
        new UsedClassFilter(usageMarker,
        new MultiClassVisitor(
            new ClassShrinker(usageMarker),
            new ClassPoolFiller(newProgramClassPool)
        )));

    programClassPool.clear();
	...
    return newProgramClassPool;
}
```

看到`classesAccept()`：

```Java
// In ClassPool
public void classesAccept(ClassVisitor classVisitor) {
    Iterator iterator = classes.values().iterator();
    while (iterator.hasNext()) {
        Clazz clazz = (Clazz)iterator.next();
        clazz.accept(classVisitor);
    }
}
```

這邊依序從取出ProgramClassPool內的ProgramClass來呼叫`accept()`。

在這需要重申Part4提過的觀念，以方便理解接下來的分析：

* **執行`clazz.accept(visitor)`，可直接看成`visitor.visitXXXClass()`。由`clazz`屬於ProgramClass或LibraryClass來決定`XXX`是什麼。**

依此觀念，`classesAccept()`會帶到UsedClassFileter的`visitProgramClass()`：

```Java
// In UsedClassFileter
public void visitProgramClass(ProgramClass programClass) {
    if (usageMarker.isUsed(programClass)) {
        classVisitor.visitProgramClass(programClass);
    }
}
```

這裡先用到UsageMaker來判斷傳入的ProgramClass是否被標記成使用，是代表在程式碼內有被引用到：

```Java
// In UsageMaker
protected boolean isUsed(VisitorAccepter visitorAccepter) {
    return visitorAccepter.getVisitorInfo() == USED;
}
```

是就再呼叫`visitProgramClass()`，搭配一開始的傳入的參數，知道這是MultiClassVisitor：

```Java
// In MultiClassVisitor
public void visitProgramClass(ProgramClass programClass) {
    for (int index = 0; index < classVisitorCount; index++) {
        classVisitors[index].visitProgramClass(programClass);
    }
}
```

這邊依序透過其所擁有的ClassVisitor：ClassShrinker和ClassPoolFiller，來呼叫`visitProgramClass`。

#### ClassShrinker

ClassShrink的`visitProgramClass()`內做的事情大致相同，以`shrinkArray()`為範例來看：

```java
// In ClassShrinker
public void visitProgramClass(ProgramClass programClass) {
	...
    int oldFieldsCount = programClass.u2fieldsCount;
    programClass.u2fieldsCount = shrinkArray(programClass.fields, 
                                             programClass.u2fieldsCount);
    ...
}

private int shrinkArray(VisitorAccepter[] array, int length) {
    int counter = 0;
    for (int index = 0; index < length; index++) {
        VisitorAccepter visitorAccepter = array[index];

        if (usageMarker.isUsed(visitorAccepter)) {
            array[counter++] = visitorAccepter;
        }
    }

    // Clear any remaining array elements.
    if (counter < length) {
        Arrays.fill(array, counter, length, null);
    }
    return counter;
}
```

第一個迴圈是依序將陣列內的ProgramField取出，並透過`usageMaker`判斷是否有被使用，有的話就從頭依序覆蓋回原本的陣列。接著如果新的陣列應該比較短，則將餘下的部分歸零。

總的來說，ClassShrinker的`visitProgramClass()`內有很多`shrinkXXX()`的函示，用來去除`usageMaker`判斷為未使用的類別、函示或變數，以達到刪除的目的。

### 標記

#### Create ClassVisitor

從刪除的部分看得出來，一個類別、函示或變數能不能留下，端看其呼叫`getVisitorInfo()`時，回傳的是不是USED。

接著回到`execute()`的前半段，也就是建立標記的部分：

```Java
// In Shrinker
public ClassPool execute(ClassPool programClassPool,
                         ClassPool libraryClassPool) throws IOException {
    ...
    // Create a visitor for marking the seeds.
    UsageMarker usageMarker = configuration.whyAreYouKeeping == null ?
        new UsageMarker() :
        new ShortestUsageMarker();
```

在函示的一開始，就來建立`usageMaker`，這裡假設沒設定`-whyAreYouKeeping`，所以選用UsageMaker。

```Java
    // Automatically mark the parameterless constructors of seed classes,
    // mainly for convenience and for backward compatibility.
    ClassVisitor classUsageMarker =
        new MultiClassVisitor(new ClassVisitor[] {
            usageMarker,
            new NamedMethodVisitor(ClassConstants.METHOD_NAME_INIT,
                                   ClassConstants.METHOD_TYPE_INIT,
                                   usageMarker)
        });
```

接著再包一層NamedMethodVisitor，然後傳入MultiClassVisitor。在這，先總結一下`classUsageMarker`的結構：

```Java
ClassVisitor {
    MultiClassVisitor {
        UsageMarker,
        NamedMethodVisitor {
            name = "<init>",
            descriptor = "()V",
            usageMarker
        }
    }
}
```

而`usageMaker`和`classUsageMaker`會一起被傳入KeepClassSpecificationVisitorFactory的`createClassPoolVisitor()`，連同ProGuard的keep設定：

```Java
    ClassPoolVisitor classPoolvisitor =
        new KeepClassSpecificationVisitorFactory(true, false, false)
            .createClassPoolVisitor(configuration.keep,
                                    classUsageMarker,
                                    usageMarker,
                                    usageMarker,
                                    usageMarker);
```

`Shrinker.execute()`部份到這先暫停，先從取得ClassPoolVisitor這片段繼續深入。

```Java
// In KeepClassSpecificationVisitorFactory
public ClassPoolVisitor createClassPoolVisitor(List             keepClassSpecifications,
                                               ClassVisitor     classVisitor,
                                               MemberVisitor    fieldVisitor,
                                               MemberVisitor    methodVisitor,
                                               AttributeVisitor attributeVisitor) {
    MultiClassPoolVisitor multiClassPoolVisitor = new MultiClassPoolVisitor();
    ...
    for (int index = 0; index < keepClassSpecifications.size(); index++){
            KeepClassSpecification keepClassSpecification =
                (KeepClassSpecification)keepClassSpecifications.get(index);
            if ((shrinking && !keepClassSpecification.allowShrinking) || ...) {
                multiClassPoolVisitor.addClassPoolVisitor(
                    createClassPoolVisitor(keepClassSpecification,
                                           classVisitor,
                                           fieldVisitor,
                                           methodVisitor,
                                           attributeVisitor));
            }
        }
    }
    return multiClassPoolVisitor;
}
```

這裡跑了一個迴圈依序取出每條keep的設定，並再透過`createClassPoolVisitor()`逐一得到個別的ClassVisitor，來加入MultiClassPoolVisitor回傳。根據前面內容，這邊參數除了`classVisitor`是`classUsageMaker`，其餘都是`usagMaker`：

```Java
// In KeepClassSpecificationVisitorFactory
public ClassPoolVisitor createClassPoolVisitor(
    KeepClassSpecification keepClassSpecification, 
    ClassVisitor           classVisitor,                                           
    MemberVisitor          fieldVisitor,
    MemberVisitor          methodVisitor,
    AttributeVisitor       attributeVisitor) {
    ...
    List variableStringMatchers = new ArrayList();
    ...
    else {
        // Just parse the actual keep specification.
        return createClassPoolVisitor(keepClassSpecification,
                                      classVisitor,
                                      fieldVisitor,
                                      methodVisitor,
                                      attributeVisitor,
                                      variableStringMatchers);
    }
}
```

接著，我們引入Part3的範例，但將後面的描述拿掉，著重在類別上：

```Java
-keep class * extend com.example.classname
```

根據範例所會得到的`keepClassSpecification`，會使`createClassPoolVisitor()`直接跳過中間所有操作，直接走到父類ClassSpecificationVisitorFactory：

```Java
// In ClassSpecificationVisitorFactory
protected ClassPoolVisitor createClassPoolVisitor(ClassSpecification classSpecification,
                                                  ClassVisitor       classVisitor,
                                                  MemberVisitor      fieldVisitor,
                                                  MemberVisitor      methodVisitor,
                                                  AttributeVisitor   attributeVisitor,
                                                  List               variableStringMatchers) {
    String className             = classSpecification.className;
    ...
    String extendsClassName      = classSpecification.extendsClassName;
    if (className == null) {
        className = "**";
    }
```

依照Part3的分析，`extendsClassName`是`com.example.classname`；`className`為null，而在這被設為`**`。

```Java
    ...
    StringMatcher classNameMatcher =
        new ListParser(new ClassNameParser(variableStringMatchers)).parse(className);
    ...
```

這邊不贅述，僅說明`classNameMatcher`會是一個VariableStringMatcher，並被記錄在`variableStringMatchers`。

```Java
    // Combine both visitors.
    ClassVisitor combinedClassVisitor =
        createCombinedClassVisitor(classSpecification.attributeNames,
                                   classSpecification.fieldSpecifications,
                                   classSpecification.methodSpecifications,
                                   classVisitor,
                                   fieldVisitor,
                                   methodVisitor,
                                   attributeVisitor,
                                   variableStringMatchers);
```

接著再呼叫`createCombinedClassVisitor()`，在這不繼續深入。依照本篇範例，此函示會直接回傳傳入的`classVisitor`。

接著繼續往下看：

```Java
    // If the class name has wildcards, only visit classes with matching names.
    if (... || extendsClassName != null || containsWildCards(className)) {
        combinedClassVisitor =
            new ClassNameFilter(classNameMatcher, combinedClassVisitor);

        // We'll have to visit all classes now.
        className = null;
    }
    ...
```

以上得到的都會在包進去ClassNameFilter，`className`此時又復原回null。

```Java
    // If it's specified, start visiting from the extended class.
    if (... || extendsClassName      != null) {
        // Start visiting from the extended class.
        combinedClassVisitor =
            new ClassHierarchyTraveler(false, false, false, true, combinedClassVisitor);
        ...
        // If specified, only visit extended classes with matching names.
        if (extendsClassName != null) {
            ...
            else {
                // Start visiting from the named extended class.
                className = extendsClassName;
            }
        }
    }
```

由於`extendsClassName`不為null，所以`combinedClassVisitor`又被包進去ClassHierarchyTraveler，然後將值設給`className`，所以此時`className`為`com.example.classname`。

```Java
    // If specified, visit a single named class, otherwise visit all classes.
    return className != null ?
        new NamedClassVisitor(combinedClassVisitor, className) :
        new AllClassVisitor(combinedClassVisitor);
}
```

最後，`className`不為null，所以再包一層NamedClassVisitor回傳。

這邊總結一下取得的ClassPoolVisitor結構，並結合從Shrinker傳入的ClassVisitor：

```Java
MultiClassPoolVisitor {
    NamedClassVisitor {
        name = "com.example.classname",
        classVisitor = ClassHierarchyTraveler {
            visitSubclasses = true,
            classVisitor = ClassNameFilter {
                regularExpressionMatcher = VariableStringMatcher,
                classVisitor = MultiClassVisitor {
                    UsageMarker,
                    NamedMethodVisitor {
                        name = "<init>",
                        descriptor = "()V",
                        usageMarker
                    }
                }
            }
        }
    }
}
```

#### Accept ClassVisitor

回到Shrinker，取得ClassVisitor後，接著就是透過`accept`傳入，開始進行靜態分析的動作：

```Java
    // Mark the seeds.
    programClassPool.accept(classPoolvisitor);
	...
}
```
以下我們用`programClassPool`為例。

看到`accept()`，直接聯想到MultiClassPoolVisitor的`visitClassPool()`：

```Java
// In MultiClassPoolVisitor
public void visitClassPool(ClassPool classPool) {
    for (int index = 0; index < classPoolVisitorCount; index++) {
        classPoolVisitors[index].visitClassPool(classPool);
    }
}
```
一個迴圈依照順序取出ClassPoolVisitor，對照前面結構，就是NamedClassVisitor，再將ProgramClassPool傳入：

```Java
// In NamedClassVisitor
public void visitClassPool(ClassPool classPool) {
    classPool.classAccept(name, classVisitor);
}
```

沒做什麼，就是將`com.example.classname`和ClassHierarchyTraveler，透過`classAccept()`傳入ProgramClassPool：

```Java
// In ClassPool
public void classAccept(String className, ClassVisitor classVisitor) {
    Clazz clazz = getClass(className);
    if (clazz != null) {
        clazz.accept(classVisitor);
    }
}
```

這邊嘗試使用傳入的類別名稱，來從ProgramClassPool取出對應的Clazz。這邊ProGuard還沒做任何Shrink的動作，所以應是會有`com.example.classname`這個類別的Clazz。

一樣的看到`accept()`就知道會走到ClassHierarchyTraveler內：

```Java
// In ClassHierarchyTraveler
public void visitProgramClass(ProgramClass programClass) {
    programClass.hierarchyAccept(visitThisClass, visitSuperClass, visitInterfaces,
                                 visitSubclasses, classVisitor);
}
```

然後再回到ProgramClass，也就是前面才剛提到的Clazz：

```Java
// In ProgramClass
public void hierarchyAccept(boolean      visitThisClass, boolean      visitSuperClass,
                            boolean      visitInterfaces, boolean      visitSubclasses,
                            ClassVisitor classVisitor) {
    ...
    // Then visit its subclasses, recursively.
    if (visitSubclasses) {
        if (subClasses != null) {
            for (int index = 0; index < subClasses.length; index++){
                Clazz subClass = subClasses[index];
                subClass.hierarchyAccept(true, false, false, true, classVisitor);
            }
        }
    }
}
```

由前面內容知道只有`visitSubclasses`會是true，所以省略不會執行的部份。

這邊依照順序取出`com.example.classname`的子類，由於取得的也是Clazz，可以再呼叫`hierarchyAccept()`來產生遞迴，就可以逐一分析到所有的子類。這樣的執行方式，也印證範例中`* extend com.example.classname`的規則。

接著看到子類執行`hierarchyAccept()`的部分，此時`visitThisClass`也是true：

```java
// In ProgramClass
public void hierarchyAccept(boolean      visitThisClass, boolean      visitSuperClass,
                            boolean      visitInterfaces, boolean      visitSubclasses,
                            ClassVisitor classVisitor) {
    // First visit the current classfile.
    if (visitThisClass) {
        accept(classVisitor);
}
    ...
}
```

看到`accept()`，自動走到ClassNameFilter：

```Java
// In ClassNameFilter
public void visitProgramClass(ProgramClass programClass) {
    if (accepted(programClass.getName())) {
        classVisitor.visitProgramClass(programClass);
    }
}

private boolean accepted(String name) {
    return regularExpressionMatcher.matches(name);
}
```

這邊會透過`regularExpressionMatcher`判斷傳入的是否是符合特定規則，也就是前面提過，由字串`**`產生的VariableStringMatcher，所以任何傳給他的字串都會符合規則，這也印證了範例中`*`的規則。

確認符合規則後，再使用其所帶有的`classVisitor`呼叫`visitProgramClass`。依照前面的結構，這邊的`calssVisitor`就是在`Shrinker.execute()`產生的MultiClassVisitor。

MultiClassVisitor前面有介紹過，所以直接看到內含的UsageMarker：

```Java
// In UsageMarker
public void visitProgramClass(ProgramClass programClass) {
	if (shouldBeMarkedAsUsed(programClass)) {
        // Mark this class.
        markAsUsed(programClass);
        markProgramClassBody(programClass);
    }
}

protected void markAsUsed(VisitorAccepter visitorAccepter) {
    visitorAccepter.setVisitorInfo(USED);
}
```

到此就是將此ProgramClass標記成USED，這樣就與前面刪除前的判斷互相呼應。

接著再看到MultiClassVisitor內另一個NamedMethodVisitor：

```Java
// In NamedMethodVisitor
public void visitProgramClass(ProgramClass programClass) {
    programClass.methodAccept(name, descriptor, memberVisitor);
}

// In ProgramClass
public void methodAccept(String name, String descriptor, MemberVisitor memberVisitor) {
    Method method = findMethod(name, descriptor);
    if (method != null) {
        method.accept(this, memberVisitor);
    }
}
```

依照前面的結構，`name`和`descriptor`組起來是`<init>()V`，就是泛指Java的default constructor。這邊傳入的`memverVisitor`就是`usageMaker`，所以直接看到`visitProgramMethod`：

```Java
// In UsageMaker
public void visitProgramMethod(ProgramClass programClass, ProgramMethod programMethod) {
    if (shouldBeMarkedAsUsed(programMethod)) {
        // Is the method's class used?
        if (isUsed(programClass)) {
            markAsUsed(programMethod);
            // Mark the method body.
            markProgramMethodBody(programClass, programMethod);
            // Mark the method hierarchy.
            markMethodHierarchy(programClass, programMethod);
        }

        // Hasn't the method been marked as possibly being used yet?
        else if (shouldBeMarkedAsPossiblyUsed(programMethod)) {
            // We can't process the method yet, because the class isn't
            // marked as being used (yet). Give it a preliminary mark.
            markAsPossiblyUsed(programMethod);
            // Mark the method hierarchy.
            markMethodHierarchy(programClass, programMethod);
        }
    }
}
```

透過comment可以明確理解，這邊會先判斷ProgramClass有沒有被標記，有的話就保留傳入的ProgramMethod，也就是類別的default constructor；如果沒有被keep，則會先標記成POSSIBLY_USED，然後再透過`markMethodHierarchy`重新從類別的父類或子類裡找尋是否有被引用。

以上這一小段落同時也帶出一個觀念：

* **類別被keep，default constructor一定也會被keep**

至此，我們完成分析Shrink從標記到刪除的步驟，相較於前面章節更為複雜，也將[Visitor Pattern](https://en.wikipedia.org/wiki/Visitor_pattern)和[Decorator Pattern](https://en.wikipedia.org/wiki/Decorator_pattern)發揮到一個極限。

不過如果讀者從Part1一路看下來，應該會有感覺其實實作方式非常單一，也就是：

* **透過Decorator Pattern將Visitor一層層封裝，並將每一層所需要的判斷邏輯包含在內；再透過Visitor Pattern一層層將Visitor解開，來將要處理的內容一層層傳遞。**

講白話一點，就是Visitor封裝的階層，就如同Java程式碼的block階層：

```Java
ClassPool { 
    Class {
        field,
        method
    }
}
```

因此在閱讀ProGuard原始碼時，將Java的結構規則銘記於心，有助於理解每一層處理邏輯和包裝的順序。



