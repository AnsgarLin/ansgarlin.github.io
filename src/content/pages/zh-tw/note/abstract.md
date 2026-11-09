---
title: "Abstract"
updated: "2019-04-04"
---
## Definition
決定本質

## Other limitation
1. private, public, protected的變數及函式與一般class無異
2. 可extend/implement其他class
3. abstract method只需要宣告, 不需要實作
4. abstract class中也可有建構方法, 但必須在子類別中被呼叫
5. 無法透過new產生物件

## Usage
* extends
須實作父類別的abstract method, 否則這子類別還是個abstract class