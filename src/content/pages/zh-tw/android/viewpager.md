---
title: "ViewPager"
updated: "2019-04-04"
---
## What
由一連串的相同佈局，但內容相異的Fragment組成

## Usage
mOffscreenPageLimit可以設定前後預載的頁數，如直接設定當前Fragment數量，則可以保存所有Fragment狀態，而不會因為離開畫面而被destroy
如果設定為3代表前後欲載3個Fragment，也就是會有7個Fragment同時留存
