---
title: "Overview"
updated: "2019-04-04"
---
[official_observable]: http://reactivex.io/documentation/observable.html
[official_single]: http://reactivex.io/documentation/single.html
[official_subject]: http://reactivex.io/documentation/subject.html
[official_schedule]: http://reactivex.io/documentation/scheduler.html
[official_tutorial]: http://reactivex.io/tutorials.html
[official_operator]: http://reactivex.io/documentation/operators.html
[wiki_reactive_programming]: https://en.wikipedia.org/wiki/Reactive_programming
[wiki_functional_programming]: https://en.wikipedia.org/wiki/Functional_programming

### What is RxJava ?

Acrodding to the [offical documentation][official_observable]:

> In ReactiveX, many instructions may execute in parallel and their results are later captured, in arbitrary order, by “Observers”.

> You define a mechanism for retrieving and transforming the data, in the form of an “Observable”.

> And subscribe an observer to it, at which point the previously-defined mechanism fires into action.

The following chapters will focus on the basic concepts, which are nice to have as a developer who uses RxJava. But not how to use, to learn more about the usage, check the [official tutorial][official_tutorial] for more detail.

### Functional Reactive Programming (FRP)

Before starting use RxJava, we need to understand two programming paradigms: Reactive Programming and Functional Programming.

#### Reactive Programming

Based on [Wiki][wiki_reactive_programming], Reactive Programming means that a result of a statement is changed with the parameters inside it simultaneously. 

Take the following code as example:

> a = b + c

In Imperative Programming，a will be assigned a result value of b + c, and the value will not be changed even the value of b or c is changed. On the other hand, the value will be changed with b or c in Reactive Programming.

#### Functional Programming

Based on [Wiki][wiki_functional_programming], Functional Programming means to treat computation as mathematical functions. 

Which make the above code into:

> a = f ( b )

As we can see, the statement is wrapped into a function, so the same b will get the same result of a. This avoids any situations that can influence the computation inside and change the result.

Furthermore, the function is also the first-class function. It can be used not just as a function, but also a parameter. So programming can be done with expression.

As you can imagine, Function Reactive Programming means it has the characters in both programming paradigm. 

The above code will become:

> a = f ( b ) + f ( c )

Each pair of b and c will always get the same a.

### How to think in RxJava ?

Now we are going to talk about what concept should we keep in mind to use RxJava operators. But before that, we need to know about the components of Rxjava.

> Observable
> Observer
> Subscribe

#### [Observable][official_observable]

Observable represent source, an observable object. With [Operators][official_operator], we can connect multiple observables.

If we use the number to represent the situations of observable, we can get the following result:

> 0 -> no data  
> 1 -> one data  
> -1 -> error

#### Observer

Observer means the one that accept the result from the Observable from the following callback: onNext(), onError(), and onComplete().

#### Subscribe

In RaJava world, Observable and Observer are independent. Even Observable is starting to send the data, it still needs observer to fetch the data.

To connect Observable and Observer, and trigger the Observable to start sending data, we need to subscribe Observer on it:

> Observable.subscribe ( Observer )

#### The stream of data

From the previous introduction, we can get a conclusion: an observable can be trigger by subscription, or by itself. Which is like a pipeline, before opening the faucet, you will not know if there has the water inside. We can reflect the component of the following:

> Data -> Water  
> Observable -> Pipeline  
> Observer -> You  
> Subscriber -> Open the faucet

So the data is like the water, and flow in the pipeline. And the business logic is like the pipeline. And here is the concept that you can keep in mind:

> You are a plumber

Yep, a plumber, use different kinds of operators, to build an RxJava chain that fit with the business logic.

Here's the example to explain how the use the concept.

#### Situation

Here's the situation:

> We have two observables, which send the data A and B. And two observable are started one after the other. And A need to integrate with B to become C. C will pass through directly. And C will be transformed into D asynchronously.

Looks very long, let's saperate into parts:

> We have two observables, which send the data A and B. And two observable are started one after the other.  
> And A need to integrate with B to become C.  
> C will pass through directly.  
> And C will be transformed into D asynchronously.

Then remove redundent words:

> A and B, two observable are started one after the other.  
> A integrate with B to become C 
> C pass directly   
> C transform into D asynchronously

And leave the verb.:

> one after the other  
> integrate  
> pass  
> transform asynchronously

So the most important is not what is ABCDE, is about how to connect. When to split the data flow, and when to merge back together.

Reflect the RxJava operators, we got following:

> Connect the observable: concat  
> Merge the observable: zip  
> Pass the data: map  
> Transfrom asynchronously: flatMap

### Go into deeper

Here are some the other components of RxJava.

#### [Single][official_single]

Usage is much like the Observable, the different thing is when using Single. It means it's guaranteed that there is only one data, and must have one or exception if something is wrong.

If we use the number to represent situations like Observable, we will get the following:

> 1 -> one data  
> -1 -> error or no data

As we can see, Single will see no data as an error, and throw the exception, `NoSuchElementException`.

#### [Subject][official_subject]

Different from Observable is the data source, Subject is the interface to connect Observable.

The way to do it makes Subject as an Observer to subscribe on an Observable. Then pass the received data to the other Observer. As a Subject pass the data, it becomes a data source or an Observable.

The order to pass the data is:

> Observable -> (Observer) Subject = Subject (Observable) -> Observer

There are four kinds of Subject with different behavior in RxJava, we can see them as a package of the Observable operators: 

> AsyncSubject -> doOnComplete(), doOnError()
> BehaviorSubject -> last()
> PublishSubject -> forEach()
> ReplaySubject -> replay()

For more detail, check the official document.

And because Subject can send the data, we can give Subject the data directly. Just like drill a hole in the pipeline, and you can pour the water.

Simply show below:

```Java
Subject subject = new Subject()  
subject.onNext(data)
```

The Observable after the Subject will accept the data, you can check the detail in the [official e-book](http://www.introtorx.com/Content/v1.0.10621.0/02_KeyTypes.html#Subject).

#### [Scheduler][official_schedule]

By using Scheduler, RxJava can control which thread the operators will be executed. And there is two method to do it: `observableOn` and `subscribeOn`.

##### observableOn

Use to control which thread the operators will be executed.

##### subscribeOn

Use to control which thread the data source should be sent.

Observable like the pipeline, and pipeline will be placed inside culverts, which means the thread is like the culvert. And the culverts under the city are connected with each other, the junctions between them are like `observerOn`. A pipeline will go from one culvert to another, which means switching the thread. So `observerOn` can be used multiple times.

On the contrary, `subscribeOn` is like to decide which culvert should be used to send water. And because a water source can only start from one place. So `subscribeOn` should only be used once, or only the nearest one to the source will work.

#### Disposable

This is the RxJava2 only component, which replaces the Subscription in RxJava1. There are different kinds of disposable in RaJava, the more detail is in the [official e-book](http://www.introtorx.com/Content/v1.0.10621.0/20_Disposables.html#Disposables).

Disposable is used to block data, like a water valve switch. But just close it doesn't mean water flow will stop. The operator in an Rx chain will continue to work, but the subscriber will not get any data. `OnNext() ` won't get call. 

Here is the example:

```java
Disposable disposable = Observable.just(1, 2)
	.map { i -> Log.d("In map: " + i) }
	.doOnNext { i -> Log.d("In doOnNext: " + i) }
```

Call `dispose()` after the first call on`doNoNext`, the expected log result should be:

```java
In map: 1
In doOnNext: 1
// Call dispose() from out side, and nothing will be log after.
```

But instead:

```java
In map: 1
In doOnNext: 1
// Call dispose() from out side
In map: 2
// No doOnNext: 2
```

In this case, we need to check dispose state before doing anything. Hence we modified out map as follow:

```java
Disposable disposable = Observable.just(1, 2)
	.map { i -> isDispose() ? return : Log.d("In map: " + i) }
	.doOnNext { i -> Log.d("In doOnNext: " + i) }
```

Then we will get the expected log.

But, some memory leak will occur even call `dispose()`, for example:

```java
Disposable disposable = Observable.just(1).subscribe(new Consumer() {
  @Override
  public void accept() throws Exception {
    // Do something
  }
})
```

The `Consumer` is a typical Anoymous inner class, and cause a reference cycle，which may cause an Activity can not be GC after destroying.

In RxJava, there is a method `onTerminateDetach`, the comment of it is:

> Nulls out references to the upstream producer and downstream Observer if the sequence is terminated or downstream calls dispose().

Means the Observable will be disconnected from the upstream and downstream after `dispose()`, and no reference cycle since then.


#### Appendix

Here are some information that are unrelate to the above chapters.