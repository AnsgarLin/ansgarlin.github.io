---
title: "About ProGuard - SP"
date: "2018-07-24"
---
Recently I adjusted the ProGuard configuration in our project, and while building it I ran into the following error messages:

```Java
Warning: com.inside.library: can't find referenced class com.android.vending.billing.IInAppBillingService
Warning: com.inside.library: can't find referenced class com.android.vending.billing.IInAppBillingService$Stub
Warning: com.inside.library: can't find referenced class com.google.android.instantapps.InstantApps
```

ProGuard said it couldn't find the classes it expected, so it stopped the build right away.

The problem is, our project doesn't use these two classes at all. Luckily the change this time was small, so I could be sure the cause was an internal library of our company. I went straight to the library's source code and found the following in the ProGuard configuration file under its root directory:

```groovy
-dontwarn com.google.android.instantapps.InstantApps
-dontwarn com.android.vending.billing.IInAppBillingService
-dontwarn com.android.vending.billing.IInAppBillingService$Stub
```

These rules tell ProGuard to ignore these two classes. But because **this ProGuard configuration file isn't published with the library**, it has no effect.

The library we use is actually one module of the whole library, so the module's ProGuard configuration file, consumer-proguard-rules.pro, can be found in the module folder. After checking `build.gradle`, I confirmed this is the configuration file the module ships with, and it doesn't contain the `-dontwarn` part above. That means we have to solve it ourselves.

### Solution

#### Use "-keep"

For a class-not-found problem, the intuitive fix is to keep the classes that are needed:

```groovy
-keep class com.google.android.instantapps.InstantApps
-keep class com.android.vending.billing.IInAppBillingService
-keep class com.android.vending.billing.IInAppBillingService$Stub
```

After building, the problem was still there. The reason is that these two classes live in separate libraries that our project doesn't use, so naturally they aren't there.

So let's add the dependencies in `build.gradle`:

```Java
implementation com.android.billingclient:billing:1.1
implementation com.google.android.instantapps:instantapps:1.1.0
```

The build succeeded. This confirms that, for some reason, ProGuard wants to find these two classes, and these two classes are missing from the project's classpath, so naturally they can't be found.

#### Use "-dontwarn"

The previous approach requires adding new dependencies, which is redundant for us because we don't use them at all. So the other approach is to tell ProGuard not to report the error.

Note that using `-dontwarn` to ask ProGuard not to emit warnings doesn't mean nothing will go wrong at runtime. It's just a compromise to let the build go through. Errors can still happen at runtime.

### Why

After solving the problem, let's look back at why these two classes are needed. Searching by string directly, I found the following in these two files:

```Java
private static final String CLASS_NAME_INSTANT_APP = "com.google.android.instantapps.InstantApps";

public void init(Context context) {
    try {
        Class.forName(CLASS_NAME_INSTANT_APP);
    } catch (ClassNotFoundException e) {
        e.printStackTrace();
        return;
    }
}
```

Simply put, it's used to check the dependency: if the project using this library doesn't have the required class, it reports the error and aborts the current operation.

The logic is fine, but we all know that after Java compilation, places using a string constant are replaced by the plain string, so what ProGuard sees is:

```Java
Class.forName("com.google.android.instantapps.InstantApps");
```

According to ProGuard's [official document](https://www.guardsquare.com/en/products/proguard/manual/introduction), this is a use of Reflection that ProGuard handles automatically, so ProGuard wants to find the class described by the string.

This causes no problem while ProGuard analyzes and processes the library itself, because renaming is the last step and the result is packaged and published right after, so the library builds fine on its own. But in a project that uses the library, ProGuard sees this string, tries to find the class, fails, and the build fails.

The lesson here: if you're developing a library, make sure all the required ProGuard rules are in the ProGuard configuration file that ships with the library.
