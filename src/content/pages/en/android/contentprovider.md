---
title: "ContentProvider"
updated: "2019-04-04"
---
## What
一個可以讓process存取db的介面，如要讓其他processs使用，需要在manifest裡設定authorities和exported

## AsyncQueryHandler
一個包有HandlerThread的Handler由於ContentProvider是block操作，所以可以搭配AsyncQueryHandler將其從ui thread分離
