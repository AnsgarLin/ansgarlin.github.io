---
title: "About ProGuard - Part 5"
date: "2018-08-04"
---

In the previous chapters, we understood how ProGuard prepares the configuration files it needs and the code to be processed at the early stage of its execution.

Next comes the Shrink part. As before, let's go back to `ProGuard.execute()`:

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

Skipping the operations that aren't the main ones here, let's go straight to `shrink()`:

```Java
// In ProGuard 
private void shrink() throws IOException {
    ...
    // Perform the actual shrinking.
    programClassPool = new Shrinker(configuration).execute(programClassPool,
                                                           libraryClassPool);
}
```

From experience, the main operations happen inside `execute()`, and Shrinker is divided into two major parts: marking the code that is used, and removing the code that isn't. Below, we go in reverse and start with the removing part.

### Removing

First, only the part about removing is listed:

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

Look at `classesAccept()`:

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

Here the ProgramClasses in the ProgramClassPool are taken out one by one to call `accept()`.

Here we need to restate the concept mentioned in Part4, to make the following analysis easier to understand:

* **Executing `clazz.accept(visitor)` can be read directly as `visitor.visitXXXClass()`. Whether `clazz` is a ProgramClass or a LibraryClass decides what `XXX` is.**

Following this concept, `classesAccept()` leads to UsedClassFileter's `visitProgramClass()`:

```Java
// In UsedClassFileter
public void visitProgramClass(ProgramClass programClass) {
    if (usageMarker.isUsed(programClass)) {
        classVisitor.visitProgramClass(programClass);
    }
}
```

Here UsageMaker is used first to check whether the passed-in ProgramClass is marked as used, which means it's referenced in the code:

```Java
// In UsageMaker
protected boolean isUsed(VisitorAccepter visitorAccepter) {
    return visitorAccepter.getVisitorInfo() == USED;
}
```

If it is, `visitProgramClass()` is called again. Combined with the arguments passed in at the beginning, we know this is the MultiClassVisitor:

```Java
// In MultiClassVisitor
public void visitProgramClass(ProgramClass programClass) {
    for (int index = 0; index < classVisitorCount; index++) {
        classVisitors[index].visitProgramClass(programClass);
    }
}
```

Here it calls `visitProgramClass` through the ClassVisitors it holds, in order: ClassShrinker and ClassPoolFiller.

#### ClassShrinker

What ClassShrink's `visitProgramClass()` does is mostly the same throughout, so let's take `shrinkArray()` as the example:

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

The first loop takes out the ProgramFields in the array one by one and checks through `usageMaker` whether each is used; if it is, it's written back over the original array from the start. Then, if the new array should be shorter, the remaining part is cleared.

Overall, ClassShrinker's `visitProgramClass()` has many `shrinkXXX()` methods, used to strip the classes, methods or variables that `usageMaker` decides are unused, which achieves the removal.

### Marking

#### Create ClassVisitor

From the removing part, we can see that whether a class, method or variable stays depends on whether calling `getVisitorInfo()` on it returns USED.

Next, go back to the first half of `execute()`, which is the part that sets up the marking:

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

At the very beginning of the method, `usageMaker` is created. Here we assume `-whyAreYouKeeping` isn't set, so UsageMaker is chosen.

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

Then it's wrapped with a NamedMethodVisitor and passed into a MultiClassVisitor. Here, let's sum up the structure of `classUsageMarker` first:

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

`usageMaker` and `classUsageMaker` are then passed together into KeepClassSpecificationVisitorFactory's `createClassPoolVisitor()`, along with ProGuard's keep configuration:

```Java
    ClassPoolVisitor classPoolvisitor =
        new KeepClassSpecificationVisitorFactory(true, false, false)
            .createClassPoolVisitor(configuration.keep,
                                    classUsageMarker,
                                    usageMarker,
                                    usageMarker,
                                    usageMarker);
```

Let's pause `Shrinker.execute()` here, and first go deeper from the part that gets the ClassPoolVisitor.

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

Here a loop takes out each keep configuration in order, gets an individual ClassVisitor for each through `createClassPoolVisitor()`, and adds it to the MultiClassPoolVisitor that's returned. From the content above, apart from `classVisitor` being `classUsageMaker`, all the arguments here are `usagMaker`:

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

Next, we bring in the example from Part3, but drop the description at the end to focus on the class:

```Java
-keep class * extend com.example.classname
```

The `keepClassSpecification` obtained from the example makes `createClassPoolVisitor()` skip all the operations in between and go straight to the parent class ClassSpecificationVisitorFactory:

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

According to the analysis in Part3, `extendsClassName` is `com.example.classname`; `className` is null, and is set to `**` here.

```Java
    ...
    StringMatcher classNameMatcher =
        new ListParser(new ClassNameParser(variableStringMatchers)).parse(className);
    ...
```

We won't go into detail here; just note that `classNameMatcher` is a VariableStringMatcher, and it's recorded in `variableStringMatchers`.

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

Then `createCombinedClassVisitor()` is called, which we won't go deeper into. With this post's example, this method returns the passed-in `classVisitor` directly.

Let's keep reading:

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

Everything obtained above is wrapped into a ClassNameFilter, and `className` is set back to null at this point.

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

Since `extendsClassName` isn't null, `combinedClassVisitor` is wrapped again into a ClassHierarchyTraveler, and the value is assigned to `className`, so `className` is now `com.example.classname`.

```Java
    // If specified, visit a single named class, otherwise visit all classes.
    return className != null ?
        new NamedClassVisitor(combinedClassVisitor, className) :
        new AllClassVisitor(combinedClassVisitor);
}
```

Finally, `className` isn't null, so it's wrapped in one more NamedClassVisitor and returned.

Here's a summary of the structure of the ClassPoolVisitor obtained, combined with the ClassVisitor passed in from Shrinker:

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

Back in Shrinker, after getting the ClassVisitor, it's passed in through `accept` to start the static analysis:

```Java
    // Mark the seeds.
    programClassPool.accept(classPoolvisitor);
	...
}
```
Below we use `programClassPool` as the example.

Seeing `accept()`, we can directly associate it with MultiClassPoolVisitor's `visitClassPool()`:

```Java
// In MultiClassPoolVisitor
public void visitClassPool(ClassPool classPool) {
    for (int index = 0; index < classPoolVisitorCount; index++) {
        classPoolVisitors[index].visitClassPool(classPool);
    }
}
```
A loop takes out the ClassPoolVisitors in order, which, compared with the structure above, is the NamedClassVisitor, and passes the ProgramClassPool in:

```Java
// In NamedClassVisitor
public void visitClassPool(ClassPool classPool) {
    classPool.classAccept(name, classVisitor);
}
```

It doesn't do much: it passes `com.example.classname` and the ClassHierarchyTraveler into the ProgramClassPool through `classAccept()`:

```Java
// In ClassPool
public void classAccept(String className, ClassVisitor classVisitor) {
    Clazz clazz = getClass(className);
    if (clazz != null) {
        clazz.accept(classVisitor);
    }
}
```

Here it tries to use the passed-in class name to take the corresponding Clazz out of the ProgramClassPool. ProGuard hasn't done any Shrink yet, so the Clazz for the class `com.example.classname` should be there.

Likewise, seeing `accept()` tells us it goes into ClassHierarchyTraveler:

```Java
// In ClassHierarchyTraveler
public void visitProgramClass(ProgramClass programClass) {
    programClass.hierarchyAccept(visitThisClass, visitSuperClass, visitInterfaces,
                                 visitSubclasses, classVisitor);
}
```

Then it goes back to ProgramClass, which is the Clazz just mentioned:

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

From the content above, we know only `visitSubclasses` is true, so the parts that won't run are omitted.

Here the subclasses of `com.example.classname` are taken out in order. Since what's obtained is also a Clazz, `hierarchyAccept()` can be called again to recurse, so all the subclasses can be analyzed one by one. This way of execution also matches the rule `* extend com.example.classname` in the example.

Next, look at the part where a subclass runs `hierarchyAccept()`; at this point `visitThisClass` is also true:

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

Seeing `accept()`, it automatically goes to ClassNameFilter:

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

Here `regularExpressionMatcher` is used to check whether what's passed in matches a specific rule. It's the VariableStringMatcher generated from the string `**` mentioned earlier, so any string passed to it matches, which also matches the `*` rule in the example.

After confirming the rule matches, it calls `visitProgramClass` with the `classVisitor` it holds. Following the structure above, the `calssVisitor` here is the MultiClassVisitor created in `Shrinker.execute()`.

MultiClassVisitor was introduced earlier, so let's go straight to the UsageMarker inside it:

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

At this point the ProgramClass is marked as USED, which ties back to the check before removal earlier.

Next, look at the other one inside MultiClassVisitor, the NamedMethodVisitor:

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

Following the structure above, `name` and `descriptor` combined are `<init>()V`, which refers to Java's default constructor. The `memverVisitor` passed in here is `usageMaker`, so let's go straight to `visitProgramMethod`:

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

The comments make it clear: it first checks whether the ProgramClass is marked. If it is, the passed-in ProgramMethod, i.e. the class's default constructor, is kept; if it isn't kept, the method is first marked as POSSIBLY_USED, and then `markMethodHierarchy` looks again through the class's parent or subclasses for whether it's referenced.

This small section also brings out a concept:

* **If a class is kept, its default constructor is always kept too**

With that, we've finished analyzing the steps of Shrink from marking to removing. It's more complex than the previous chapters, and it pushes the [Visitor Pattern](https://en.wikipedia.org/wiki/Visitor_pattern) and the [Decorator Pattern](https://en.wikipedia.org/wiki/Decorator_pattern) to the limit.

However, if you've read along from Part1, you should feel that the implementation is actually very uniform:

* **Visitors are wrapped layer by layer through the Decorator Pattern, with the decision logic each layer needs included; then the Visitors are unwrapped layer by layer through the Visitor Pattern, passing the content to be processed down layer by layer.**

To put it plainly, the layers of Visitor wrapping are just like the block layers of Java code:

```Java
ClassPool { 
    Class {
        field,
        method
    }
}
```

So when reading the ProGuard source code, keeping Java's structural rules in mind helps you understand the processing logic of each layer and the order of the wrapping.



