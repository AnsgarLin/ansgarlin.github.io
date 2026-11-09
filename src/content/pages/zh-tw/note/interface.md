---
title: "Interface"
updated: "2019-04-04"
---
## Definition
擴充，即spec., 完全不需要定義實作, 只需要函式原型，若要實作interface, 就必須follow它的spec.

## Other limitation
1. 變數及函式不許有public、protected等前綴詞
2. 只可extends其他interface
3. 變數等同public static，且必須要有初始值
4. 函式等同public abstract，不可實作
5. 沒有建構式，只可被implement

## Usage
* implement
繼承static變數，函式必須實作
