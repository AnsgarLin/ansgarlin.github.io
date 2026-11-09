---
title: "IntDef"
updated: "2019-04-04"
---
## What
Android獨有，拿來取代enum，原因是每一個enum都是一個enum type的物件，等於會佔用多餘的記憶體，而不只是單一個整數的容量

## Usage
```  
public class IceCreamFlavourManager {

    private int flavour;

    public static final int VANILLA = 0;
    public static final int CHOCOLATE = 1;
    public static final int STRAWBERRY = 2;

    @IntDef({VANILLA, CHOCOLATE, STRAWBERRY})
    public @interface Flavour {
    }

    @Flavour
    public int getFlavour() {
        return flavour;
    }

    public void setFlavour(@Flavour int flavouwr) {
        this.flavour = flavour;
    }
}
```