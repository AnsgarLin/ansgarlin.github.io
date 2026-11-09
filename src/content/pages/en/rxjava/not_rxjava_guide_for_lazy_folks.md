---
title: "(Transcription) NotRxJava guide for lazy folks"
updated: "2019-04-04"
---
[origin]: https://yarikx.github.io/NotRxJava/
[chinese]: ../zh-tw/rxjava/not_rxjava_guide_for_lazy_folks.html

### Note
_This is only a transcription_     
* _For English reader, please check the [origin article][origin] which is written by Yaroslav Heriatovych._
* _For Chinese reader, please check the [Chinese][chinese] version._

These days if you are an android developer, you might hear some hype about RxJava. 
RxJava is library which can help you get rid of all you complex write-only code that deals with asynchronous events. Once you start using it in your project -- you will use it everywhere.

The main pitfall here is steep learning curve. If you have never used RxJava before, it will be hard or confusing to take full advantage of it for the first time. The whole way you think about writing code is a little different.
Such learning curve creates problems for massive RxJava adoption in most projects.

Of course there are a lot of tutorials and code examples around that explain how to use RxJava. 
Developer interested in learning and using RxJava can first visit  the official [Wiki](https://github.com/ReactiveX/RxJava/wiki) that contains great explanation of what Observable is, how it's related to Iterable and Future. Another useful resource is [How To Use RxJava](https://github.com/ReactiveX/RxJava/wiki/How-To-Use-RxJava) page which shows code examples of how to emit items and `println` them.

But what one really wants to know, is what problem RxJava will solve and how it will help organize async code without actually learning what Observable is.

My goal here is to show some "prequel" to read before the official documentation in order to better understand the problems that RxJava tries to solve.
This article is positioned as a small walk-through on how to reorganize messy Async code by ourselfs to see how we can implement basic principles of RxJava without actually using RxJava.

So If you are still curious let's get started!