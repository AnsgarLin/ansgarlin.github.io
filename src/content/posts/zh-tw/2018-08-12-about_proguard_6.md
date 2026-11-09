---
title: "About ProGuard - Part 6"
date: "2018-08-12"
---

刪除不必要的程式碼後，接著就是另一個ProGuard重點：Obfuscate。修改名字是更為複雜的操作，改了一個名字，得在整個專案內找到所有引用的位置並更改。

為了簡化分析流程，以下將只帶過修改類別名稱的部分。簡化後一樣有分成兩部分：建立新的名稱和替換舊的名稱，以下將執行依照順序說明。

### 建立新名稱

根據前面的分析，一樣直接看Obfuscator的`execute()`：

```Java
// In Obfuscator
public void execute(ClassPool programClassPool,
                    ClassPool libraryClassPool) throws IOException {
    ...
    programClassPool.classesAccept(
        new ClassObfuscator(programClassPool, libraryClassPool,
                            classNameFactory, packageNameFactory,
                            configuration.useMixedCaseClassNames,
                            configuration.keepPackageNames,
                            configuration.flattenPackageHierarchy,
                            configuration.repackageClasses,
                            configuration.allowAccessModification));
    ...
}
```

ProGuard可以額外指定Ofuscate階段要用來替換名稱的字詞。不過為了簡化分析這邊都假設沒有設定，所以一開始的`classNameFactory`和`packageNameFactory`這邊都是null。

接著就是呼叫`classesAccept`：

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

一如往常，這裡會依序將ProgramClass取出，呼叫`accept()`並傳入新建立的ClassObfuscator。

以下繼續沿用前面幾個章節使用的範例：

```java
com/example/classname
```

所以目前的ProgramClass就是代表`com/example/classname`，再直接看到`visitProgramClass()`：

```Java
// In ClassObfuscator
public void visitProgramClass(ProgramClass programClass) {
    // Does this class still need a new name?
    newClassName = newClassName(programClass);
    ...
    String newPackagePrefix = newClassName != null ? ... :
    	newPackagePrefix(ClassUtil.internalPackagePrefix(programClass.getName()));

    // Come up with a new class name, numeric or ordinary.
    newClassName = newClassName != null && numericClassName ? ... :
    	generateUniqueClassName(newPackagePrefix);

    setNewClassName(programClass, newClassName);
}
```

第一次進來，`newClassName`會是null，接著先看到`internalPackagePrefix()`，這函示用途很簡單：從輸入的字串，取到最後一個`/`，以範例來說會得到：

```Java
com/exmaple/
```

接著再傳入`newPackagePrefix()`：

```Java
// In ClassObfuscator
private String newPackagePrefix(String packagePrefix) {
    // Doesn't the package prefix have a new package prefix yet?
    String newPackagePrefix = (String)packagePrefixMap.get(packagePrefix);
    if (newPackagePrefix == null) {
        ...
        String newSuperPackagePrefix = flattenPackageHierarchy != null ?
            flattenPackageHierarchy :
            newPackagePrefix(ClassUtil.internalPackagePrefix(packagePrefix));

        // Come up with a new package prefix.
        newPackagePrefix = generateUniquePackagePrefix(newSuperPackagePrefix);

        // Remember to use this mapping in the future.
        packagePrefixMap.put(packagePrefix, newPackagePrefix);
    }

    return newPackagePrefix;
}
```

如果傳入的package還沒有新的名稱，則會透過遞迴的方式呼叫`newPackagePrefix`。

以範例來說，傳進下個遞迴的就是`com/`，則`packagePrefix`會是`com/`；而`newSuperPackagePrefix`則會變成空字串`""`。空字串會再進入下個遞迴，但因為`packagePrefixMap`內對應到的值也是空字串，所以會直接回傳`""`。

回到`com/`這個遞迴時，`""`被傳入`generateUniquePackagePrefix()`：

```Java
// In ClassObfuscator 
private String generateUniquePackagePrefix(String newSuperPackagePrefix) {
    ...
    packageNameFactory = new SimpleNameFactory(useMixedCaseClassNames);
    ...
    return generateUniquePackagePrefix(newSuperPackagePrefix, packageNameFactory);
}
```

這裡建立了SimpleNameFactory來與`""`一起傳入`generateUniquePackagePrefix()`：

```Java
// In ClassObfuscator 
private String generateUniquePackagePrefix(String      newSuperPackagePrefix,
                                           NameFactory packageNameFactory) {
	...
    newPackagePrefix = newSuperPackagePrefix + packageNameFactory.nextName() +
                           ClassConstants.PACKAGE_SEPARATOR;
    ...
    return newPackagePrefix;
}
```

這函示就很簡單，首先用到SimpleNameFactory的`nextName()`取得新的名稱。這裡不再贅述其內容，總之就是英文字母的組合，如同我們平常使用ProGuard會得到的結果一樣。

假設我們得到的是`a`，則最後回傳的`newPackagePrefix`就是`""`加上`a`。於是回傳`newPackagePrefix`後就會與`com`放在`packagePrefixMap`裡，就得到第一組名稱對照：

```Java
com/ -> a
```

`com/example`的部分就會依樣畫葫蘆，可以得到以下對照：

```Java
com/example -> a/b
```

回到`visitProgramClass`，所以`newPackagePrefix`會得到`a/b`。而`newClassName`則是由`generateUniqueClassName()`產生：

```Java
// In ClassObfuscator
private String generateUniqueClassName(String newPackagePrefix) {
    ...
    classNameFactory = new SimpleNameFactory(useMixedCaseClassNames);
    ...
    return generateUniqueClassName(newPackagePrefix, classNameFactory);
}
```
這邊一樣用到SimpleNameFactory取得新名稱，假設是`c`：

```Java
// In ClassObfuscator
private String generateUniqueClassName(String      newPackagePrefix,
                                       NameFactory classNameFactory) {
    ...
    newClassName = newPackagePrefix + classNameFactory.nextName();
    ...
    return newClassName;
}
```

這邊就是將前面取得的package與新的類別名稱組合，於是範例類別的名稱會變成：

```Java
a/b/c
```

回到ClassObfuscator，取得新的名稱後，接著透過`setNewClassName()`來設定：

```Java
// In ClassObfuscator
static void setNewClassName(Clazz clazz, String name) {
    clazz.setVisitorInfo(name);
}
```

於是此時ProgramClass就存有新的名稱。但應該可以察覺，這樣的設定不會真的改變類別的名稱，如果呼叫`getName()`：

```Java
// In ClassConstant
public String getName(Clazz clazz) {
    return clazz.getString(u2nameIndex);
}
```

明顯讀取名稱的方式與剛剛設定的方式並無關係，而是與`u2nameIndex`有關。此變數與Java的Constant Pool檔案結構有關，這裡不會深入介紹，詳細可以參考[官方文件](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html)。

### 替換舊名稱

接著來看是哪裡才是真的將新的名稱，從`visitorInfo`設定到`u2nameIndex`。

回到`execute()`，繼續往下看會看到如下片段：

```Java
// In Obfuscator
public void execute(ClassPool programClassPool, ClassPool libraryClassPool) throws IOException {
    ...
    // Actually apply the new names.
    programClassPool.classesAccept(new ClassRenamer());
    libraryClassPool.classesAccept(new ClassRenamer());
    ...
}
```

根據經驗，可以直接看到ClassRenamer：

```Java
// In ClassRenamer
public void visitProgramClass(ProgramClass programClass) {
    // Rename this class.
    programClass.thisClassConstantAccept(this);
    ...
}
```

`thisClassConstantAccept()`會直接走到`visitClassConstant()`：

```Java
// In ClassRenamer
public void visitClassConstant(Clazz clazz, ClassConstant classConstant) {
    // Update the Class entry if required.
    String newName = ClassObfuscator.newClassName(clazz);
    if (newName != null) {
        // Refer to a new Utf8 entry.
        classConstant.u2nameIndex =
            new ConstantPoolEditor((ProgramClass)clazz).addUtf8Constant(newName);
    }
}
```

這裡用到ClassObfuscator的靜態函示：

```Java
// In ClassObfuscator
static String newClassName(Clazz clazz) {
    Object visitorInfo = clazz.getVisitorInfo();
    return visitorInfo instanceof String ? (String)visitorInfo : null;
}
```

沒有特殊的邏輯，就是呼叫`getVisitorInfo()`。依照前面的分析，可以確定這邊會取到`a/b/c`回傳。

回到ClassRenamer，接著用到ConstantPoolEditor來呼叫`addUtf8Constant()`，並將新的類別名稱傳入，再存入`u2nameIndex`。

如此就與前面分析連起來了，下次呼叫`getName()`回傳的就會是`a/b/c`，而不是`com/example/classname`。

### What's more

看完前面部分，應該會好奇如果類別名稱已經被替換，那有引用到此類別的函示是如何調整的。

繼續從`execute()`往下看會走到：

```Java
// In Obfuscator
public void execute(ClassPool programClassPool, ClassPool libraryClassPool) throws IOException {
    ...
    // Update all references to these new names.
	programClassPool.classesAccept(new ClassReferenceFixer(false));
    libraryClassPool.classesAccept(new ClassReferenceFixer(false));
    ...
}
```

直接看到ClassReferenceFixer的`visitProgramClass()`：

```Java
// In ClassReferenceFixer
public void visitProgramClass(ProgramClass programClass) {
    ...
    programClass.methodsAccept(this);
    ...
}
```

`methodAccept()`會直接走到`visitProgramMethod()`：

```Java
// In ClassReferenceFixer
public void visitProgramMethod(ProgramClass programClass, ProgramMethod programMethod) {
    // Has the descriptor changed?
    String descriptor    = programMethod.getDescriptor(programClass);
    String newDescriptor = newDescriptor(descriptor,
                                         programMethod.referencedClasses);

    if (!descriptor.equals(newDescriptor)) {
        ConstantPoolEditor constantPoolEditor = new ConstantPoolEditor(programClass);

        // Update the descriptor.
        programMethod.u2descriptorIndex = 
            constantPoolEditor.addUtf8Constant(newDescriptor);
        ...
    }
    ...
}
```

這裡看到是取出descriptor來修改，descriptor是Java來表示函示輸入和回傳的參數類別，這裡不會贅述，詳情可以看[官方文件](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html#jvms-4.3.3)。可以理解成只要更改descriptor，就可以將函示有引用的類別替換成新的名稱。

以下假設我們有一個函式，其接受`com.example.classname`為輸入，然後沒有回傳值。這函示的descriptor會如下：

```
(Lcom/example/classname;)V
```

所以ClassReferenceFixer的`visitProgramClass`一開始先取得舊的descriptor，並與`referencedClasses`，也就是代表`com/exameple/classname`的ProgramClass，一起傳入`newDescriptor()`：

```Java
// In ClassReferenceFixer
private static String newDescriptor(String  descriptor, Clazz[] referencedClasses) {
    ...
    // Unravel and reconstruct the class elements of the descriptor.
    DescriptorClassEnumeration descriptorClassEnumeration =
        new DescriptorClassEnumeration(descriptor);

    StringBuffer newDescriptorBuffer = new StringBuffer(descriptor.length());
    newDescriptorBuffer.append(descriptorClassEnumeration.nextFluff());

    int index = 0;
    while (descriptorClassEnumeration.hasMoreClassNames()) {
        String  className = descriptorClassEnumeration.nextClassName();
        ...
        String  fluff = descriptorClassEnumeration.nextFluff();

        String newClassName = newClassName(className,
                                           referencedClasses[index++]);

        ...
        newDescriptorBuffer.append(newClassName);
        newDescriptorBuffer.append(fluff);
    }

    return newDescriptorBuffer.toString();
}
```

傳入的descriptor會先包入DescriptorClassEnumeration，這裡不贅述其內容。總之第一次`nextFluff()`得到的是`(L`，於是`newDescriptorBuffer`目前的值就是`(L`。

接著透過一個迴圈，裡面依照順序呼叫`nextClassName()`和`nextFluff()`，各自得到的結果如下：

```Java
className = com.example.classname
fluff 	  = ""
```

接著再走到`newClassName()`：

```Java
private static String newClassName(String className, Clazz referencedClass) {
    ...
    // Reconstruct the class name.
    String newClassName = referencedClass.getName(); 
    ...
    return newClassName;
}
```

這邊就用前面提到的`getName()`，根據前面的分析，這邊拿到的值會是新的名稱`a/b/c`。回傳後再接回到`newDescriptorBuffer`上，就會得到如下結果：

```Java
(La/b/c;)V
```

回到ClassReferenceFixer，將新的descriptor指定給`u2descriptorIndex`。透過引用，確定是取得descriptor時會使用的欄位：

```Java
// In ProgramMethod
public String getDescriptor(Clazz clazz) {
    return clazz.getString(u2descriptorIndex);
}
```

以上就是從建立新名稱，到替換新名稱的基本過程。

### Conclusion

至此，與ProGuard有關的介紹將告一段落，雖然分析時為了閱讀順暢，都只針對類別，但相信讀者已經在此過程中，對於ProGuard的實作有一定的了解。如果有興趣再去閱讀其他部分時，應該是比一開始還要順暢許多。

