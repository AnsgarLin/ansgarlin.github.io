---
title: "About Benchmark"
date: "2019-05-23"
---
We all tackle the performance issues all the time. To measure the performance, we usually need tp log timestamp before and after the code block. But actually, the result may vary from time to time, since there are still apps running at the same time. They all gonna consume the CPU cycle, the memory and the resource that your code may need, which will make the result not very correspond to the real situation and will misguide you.

Actually, Google already has a tool, **Benchmark**, to benchmark the performance for everything in the framework. Now, Google makes it can be used without root access to the production devices, which will be useful when the developer tries to find the glitch in the code.

You can check the video for more detail before jump into continue the rest part.

- [Improving App Performance with Benchmarking (Google I/O'19)](https://www.youtube.com/watch?v=ZffMCJdA5Qc)

### Setup

Check the [official document](https://developer.android.com/studio/profile/benchmark.md#samples), or just download the samples from the following links:

- [android-performance](https://github.com/googlesamples/android-performance)
- [android-architecture-components](https://github.com/googlesamples/android-architecture-components)

For short, to run Benchmark, at least you need:

- [Android studio 3.4+](https://developer.android.com/studio/?gclid=Cj0KCQjwoInnBRDDARIsANBVyATRTqaJfdfEscT1d6uAtdP_jwf3tJzgQAQnkAc_tjn4sMItxevXCv4aAliwEALw_wcB) for the samples, or [3.5](https://developer.android.com/studio/preview) if you want to setup the Benchmark module easily on your own project.
- Project which is already [integrated with AndroidX](https://developer.android.com/jetpack/androidx/migrate)

### Play

Let's take an example from BitmapBenchmark in [android-performance](https://github.com/googlesamples/android-performance):

```
/**
	* Measure the cost of a single expensive JNI call to fetch a row of 100 pixels.
  */
@Test
fun bitmapGetPixelsBenchmark() {
		val pixels = IntArray(100) { it }
        benchmarkRule.measureRepeated {
            bitmap.getPixels(pixels, 0, 100, 0, 0, 100, 1)
		}
}
```

The test will check how long will the connected device takes to do the pixel fetching. Before you click run, **make sure you plug-in a real device.** Then you will get the following message if you do everything right:

```
Started running tests
benchmark:        15,040 ns BitmapBenchmark.bitmapGetPixelsBenchmark

Tests ran to completion.
```

### Thins to consider

According to the speaker in Google I/O session above, you need to take the following into consideration before benchmarking everything:

- **Don’t benchmark everything**: start with Systrace, identify the slow part of your code, then use Benchmark to measure.
- **Measure for synchronous block:** Because it's more straight forward and stable to be measured.
- **Small block:** the target code block should better run perhaps within **50ms.**
- **Hot code:** Benchmark will run the code in loops, means it might get JITed. If the code only run once at runtime, the result may not that accurate. it’s better to benchmark the code actually run in a loop at runtime.
- **Cache:** the result of your code may get cached by you, library, or the System, which will influence the benchmark**.**
- **Don’t use parameterized:** try to use the real data in real world, not just like unit test.
- **DO NOT COMPARE DEVICES:** Benchmark is only designed for performance on one device over time.
- **Run locally, not in CI:** Benchmark means you need to do some changes, so you don’t need to benchmark after you finish the improvement. But it’s also no harm to monitor it in CI for each build.

### Troubleshoot

Benchmark also provides warnings to guide you along the way to set everything right. Like you will get the following warning if you forget to plug in a device before running:

```
Started running tests
benchmark: WARNING: Running on Emulator
benchmark:     Benchmark is running on an emulator, which is not representative of
benchmark:     real user devices. Use a physical device to benchmark. Emulator
benchmark:     benchmark improvements might not carry over to a real user's
benchmark:     experience (or even regress real device performance).
benchmark:
benchmark:         3,133 ns EMULATOR_BitmapBenchmark.bitmapGetPixelsBenchmark

Tests ran to completion.
```