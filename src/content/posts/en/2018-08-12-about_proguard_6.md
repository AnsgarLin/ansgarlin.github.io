---
title: "About ProGuard - Part 6"
date: "2018-08-12"
---

After the unnecessary code is removed, next comes another key part of ProGuard: Obfuscate. Renaming is a more complex operation: change one name, and you have to find every place in the whole project that references it and change it too.

To simplify the analysis, the following only covers renaming classes. After simplifying, it's again divided into two parts: creating the new name and replacing the old name, explained below in the order they run.

### Creating the new name

Following the earlier analysis, again we go straight to Obfuscator's `execute()`:

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

ProGuard lets you additionally specify the words used to replace names in the Obfuscate stage. To simplify the analysis, we assume none are set here, so `classNameFactory` and `packageNameFactory` at the beginning are both null.

Next, `classesAccept` is called:

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

As usual, the ProgramClasses are taken out one by one here, and `accept()` is called with the newly created ClassObfuscator passed in.

Below we keep using the example from the previous chapters:

```java
com/example/classname
```

So the current ProgramClass represents `com/example/classname`. Let's go straight to `visitProgramClass()`:

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

On the first visit, `newClassName` is null. First look at `internalPackagePrefix()`. This method is simple: it takes the input string up to the last `/`. With the example, we get:

```Java
com/example/
```

Then it's passed into `newPackagePrefix()`:

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

If the passed-in package doesn't have a new name yet, `newPackagePrefix` is called recursively.

With the example, what's passed into the next recursion is `com/`, so `packagePrefix` is `com/`, and `newSuperPackagePrefix` becomes the empty string `""`. The empty string goes into the next recursion, but because the value it maps to in `packagePrefixMap` is also the empty string, `""` is returned directly.

Back in the `com/` recursion, `""` is passed into `generateUniquePackagePrefix()`:

```Java
// In ClassObfuscator 
private String generateUniquePackagePrefix(String newSuperPackagePrefix) {
    ...
    packageNameFactory = new SimpleNameFactory(useMixedCaseClassNames);
    ...
    return generateUniquePackagePrefix(newSuperPackagePrefix, packageNameFactory);
}
```

Here a SimpleNameFactory is created and passed, together with `""`, into `generateUniquePackagePrefix()`:

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

This method is simple. First, SimpleNameFactory's `nextName()` is used to get a new name. We won't go into its content here; in short, it's a combination of English letters, just like the results we usually get from ProGuard.

Assume we get `a`; then the `newPackagePrefix` returned at the end is `""` plus `a` plus `/`. After `newPackagePrefix` is returned, it's put into `packagePrefixMap` together with `com/`, giving the first name mapping:

```Java
com/ -> a/
```

The `com/example` part follows the same pattern, giving the following mapping:

```Java
com/example/ -> a/b/
```

Back in `visitProgramClass`, `newPackagePrefix` gets `a/b/`. `newClassName` is generated by `generateUniqueClassName()`:

```Java
// In ClassObfuscator
private String generateUniqueClassName(String newPackagePrefix) {
    ...
    classNameFactory = new SimpleNameFactory(useMixedCaseClassNames);
    ...
    return generateUniqueClassName(newPackagePrefix, classNameFactory);
}
```
Here SimpleNameFactory is again used to get a new name; assume it's `c`:

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

This combines the package obtained earlier with the new class name, so the name of the example class becomes:

```Java
a/b/c
```

Back in ClassObfuscator, after getting the new name, it's set through `setNewClassName()`:

```Java
// In ClassObfuscator
static void setNewClassName(Clazz clazz, String name) {
    clazz.setVisitorInfo(name);
}
```

So at this point the ProgramClass holds the new name. But you may have noticed that this setting doesn't actually change the name of the class. If `getName()` is called:

```Java
// In ClassConstant
public String getName(Clazz clazz) {
    return clazz.getString(u2nameIndex);
}
```

Clearly the way the name is read has nothing to do with how it was just set; instead it's related to `u2nameIndex`. This variable is related to the Constant Pool in Java's class file structure, which we won't go into here. For details, see the [official document](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html).

### Replacing the old name

Next, let's see where the new name is actually set from `visitorInfo` into `u2nameIndex`.

Back in `execute()`, reading further down, we see the following snippet:

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

From experience, we can go straight to ClassRenamer:

```Java
// In ClassRenamer
public void visitProgramClass(ProgramClass programClass) {
    // Rename this class.
    programClass.thisClassConstantAccept(this);
    ...
}
```

`thisClassConstantAccept()` goes straight to `visitClassConstant()`:

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

Here ClassObfuscator's static method is used:

```Java
// In ClassObfuscator
static String newClassName(Clazz clazz) {
    Object visitorInfo = clazz.getVisitorInfo();
    return visitorInfo instanceof String ? (String)visitorInfo : null;
}
```

There's no special logic; it just calls `getVisitorInfo()`. From the earlier analysis, we can be sure that `a/b/c` is obtained and returned here.

Back in ClassRenamer, ConstantPoolEditor is then used to call `addUtf8Constant()` with the new class name passed in, and the result is stored into `u2nameIndex`.

This connects with the earlier analysis: the next time `getName()` is called, it returns `a/b/c` instead of `com/example/classname`.

### What's more

After reading the above, you might wonder: if the class name has been replaced, how are the methods that reference this class adjusted?

Continuing down from `execute()`, we reach:

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

Let's go straight to ClassReferenceFixer's `visitProgramClass()`:

```Java
// In ClassReferenceFixer
public void visitProgramClass(ProgramClass programClass) {
    ...
    programClass.methodsAccept(this);
    ...
}
```

`methodsAccept()` goes straight to `visitProgramMethod()`:

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

Here the descriptor is taken out to be modified. A descriptor is how Java represents the types of a method's parameters and return value; we won't go into detail here, see the [official document](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-4.html#jvms-4.3.3) for details. You can understand it as: just by changing the descriptor, the classes referenced by the method can be replaced with the new names.

Below, assume we have a method that takes `com.example.classname` as input and has no return value. The descriptor of this method is:

```
(Lcom/example/classname;)V
```

So ClassReferenceFixer's `visitProgramMethod` first gets the old descriptor, and passes it into `newDescriptor()` together with `referencedClasses`, which is the ProgramClass representing `com/example/classname`:

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

The passed-in descriptor is first wrapped into a DescriptorClassEnumeration, whose content we won't go into here. In short, the first `nextFluff()` gets `(L`, so the current value of `newDescriptorBuffer` is `(L`.

Then, through a loop, `nextClassName()` and `nextFluff()` are called in order, with the following results respectively:

```Java
className = com/example/classname
fluff 	  = ";)V"
```

Then it goes to `newClassName()`:

```Java
private static String newClassName(String className, Clazz referencedClass) {
    ...
    // Reconstruct the class name.
    String newClassName = referencedClass.getName(); 
    ...
    return newClassName;
}
```

Here the `getName()` mentioned earlier is used. From the earlier analysis, the value obtained here is the new name `a/b/c`. After it's returned and appended to `newDescriptorBuffer`, we get the following result:

```Java
(La/b/c;)V
```

Back in ClassReferenceFixer, the new descriptor is assigned to `u2descriptorIndex`. Looking at where it's used confirms that it's the field used when getting the descriptor:

```Java
// In ProgramMethod
public String getDescriptor(Clazz clazz) {
    return clazz.getString(u2descriptorIndex);
}
```

That's the basic process from creating the new name to replacing it.

### Conclusion

With this, the introduction to ProGuard comes to an end. Although the analysis only focused on classes for the sake of smooth reading, I believe you've gained a certain understanding of ProGuard's implementation along the way. If you're interested in reading the other parts, it should be much smoother than at the beginning.

